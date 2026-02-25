from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel
from pathlib import Path
from typing import List, Optional, Dict, Set
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os, uuid, secrets, hashlib, json, asyncio, logging

# ------------------------------
# Environment & Config
# ------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "ghostrecon_db")
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

# ------------------------------
# MongoDB Connection
# ------------------------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ------------------------------
# Security & Auth
# ------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

def generate_encryption_key_hash():
    return hashlib.sha256(secrets.token_bytes(32)).hexdigest()

def create_token(user_id: str, alias: str) -> str:
    payload = {
        "sub": user_id,
        "alias": alias,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ------------------------------
# FastAPI App & Router
# ------------------------------
app = FastAPI(title="GhostRecon API")
api_router = APIRouter(prefix="/api")

# ------------------------------
# Models
# ------------------------------
class AnonymousRegister(BaseModel):
    device_fingerprint: str
    alias: Optional[str] = None

class PseudonymRegister(BaseModel):
    alias: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str

class LoginRequest(BaseModel):
    identifier: str
    password: Optional[str] = None

class ContactAdd(BaseModel):
    target_user_id: str
    trust_level: int = 1

class ConversationCreate(BaseModel):
    participant_ids: List[str]
    name: Optional[str] = None
    is_group: bool = False

class MessageCreate(BaseModel):
    conversation_id: str
    content: str
    self_destruct_seconds: Optional[int] = None
    forward_protected: bool = True

class CallCreate(BaseModel):
    target_user_id: str
    call_type: str = "voice"

class SecuritySettings(BaseModel):
    screenshot_protection: bool = True
    read_receipts: bool = False
    typing_indicators: bool = False
    link_previews: bool = False
    auto_delete_days: Optional[int] = None

class PanicWipeRequest(BaseModel):
    confirm_code: str

class PublicKeyUpdate(BaseModel):
    public_key: str

class CallSignal(BaseModel):
    call_id: str
    signal_type: str
    signal_data: str

class GroupKeyDistribution(BaseModel):
    conversation_id: str
    encrypted_keys: dict

class ProfilePhotoUpload(BaseModel):
    photo_data: str
    disappear_after_views: int = 1
    disappear_after_seconds: Optional[int] = None

class PushTokenRegister(BaseModel):
    push_token: str

# ------------------------------
# WebSocket Manager
# ------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active_connections.setdefault(user_id, set()).add(ws)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
        )

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(ws)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                asyncio.create_task(db.users.update_one(
                    {"id": user_id},
                    {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
                ))

    async def send_to_user(self, user_id: str, data: dict):
        if user_id in self.active_connections:
            dead = set()
            for ws in self.active_connections[user_id]:
                try: await ws.send_json(data)
                except: dead.add(ws)
            for ws in dead: self.active_connections[user_id].discard(ws)

    async def broadcast_to_conversation(self, conv_id: str, data: dict, exclude_user: str = None):
        conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
        if conv:
            for pid in conv.get("participants", []):
                if pid != exclude_user:
                    await self.send_to_user(pid, data)

ws_manager = ConnectionManager()

@app.websocket("/api/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id: return await websocket.close(code=4001)
    except JWTError:
        return await websocket.close(code=4001)

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping": await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)

# ------------------------------
# Status Endpoints
# ------------------------------
@api_router.get("/", tags=["Status"])
async def root(): return {"status": "operational", "app": "GhostRecon", "version": "2.0.0"}

@api_router.get("/health", tags=["Status"])
async def health(): return {"status": "ok"}

# ------------------------------
# Auth Endpoints
# ------------------------------
@api_router.post("/auth/register/anonymous", tags=["Auth"])
async def register_anonymous(data: AnonymousRegister):
    existing = await db.users.find_one({"device_fingerprint": data.device_fingerprint}, {"_id": 0})
    if existing:
        token = create_token(existing["id"], existing["alias"])
        return {"token": token, "user": existing}
    user_id = str(uuid.uuid4())
    alias = data.alias or f"Ghost-{secrets.token_hex(3).upper()}"
    user = {
        "id": user_id,
        "alias": alias,
        "registration_type": "anonymous",
        "device_fingerprint": data.device_fingerprint,
        "trust_level": 0,
        "encryption_key_hash": generate_encryption_key_hash(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_online": True,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "security_settings": {
            "screenshot_protection": True,
            "read_receipts": False,
            "typing_indicators": False,
            "link_previews": False,
            "auto_delete_days": None
        }
    }
    await db.users.insert_one(user)
    token = create_token(user_id, alias)
    return {"token": token, "user": user}

@api_router.post("/auth/register/pseudonym", tags=["Auth"])
async def register_pseudonym(data: PseudonymRegister):
    if data.email and await db.users.find_one({"email": data.email}): raise HTTPException(400, "Email already registered")
    if data.phone and await db.users.find_one({"phone": data.phone}): raise HTTPException(400, "Phone already registered")
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "alias": data.alias,
        "registration_type": "pseudonym",
        "email": data.email,
        "phone": data.phone,
        "password_hash": pwd_context.hash(data.password),
        "trust_level": 1,
        "encryption_key_hash": generate_encryption_key_hash(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_online": True,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "security_settings": {
            "screenshot_protection": True,
            "read_receipts": False,
            "typing_indicators": False,
            "link_previews": False,
            "auto_delete_days": None
        }
    }
    await db.users.insert_one(user)
    token = create_token(user_id, data.alias)
    user.pop("password_hash", None)
    return {"token": token, "user": user}

@api_router.post("/auth/login", tags=["Auth"])
async def login(data: LoginRequest):
    user = await db.users.find_one(
        {"$or": [{"email": data.identifier}, {"phone": data.identifier}, {"device_fingerprint": data.identifier}]},
        {"_id": 0}
    )
    if not user: raise HTTPException(401, "Invalid credentials")
    if user.get("registration_type") == "pseudonym" and not pwd_context.verify(data.password or "", user.get("password_hash","")):
        raise HTTPException(401, "Invalid credentials")
    await db.users.update_one({"id": user["id"]},{"$set":{"is_online":True,"last_seen":datetime.now(timezone.utc).isoformat()}})
    token = create_token(user["id"], user["alias"])
    user.pop("password_hash", None)
    return {"token": token, "user": user}

# ------------------------------
# Include Router & Middleware
# ------------------------------
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------
# Logging
# ------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ------------------------------
# Shutdown Hook
# ------------------------------
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
