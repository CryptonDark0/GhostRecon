from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import jwt, JWTError
from pydantic import BaseModel
from pathlib import Path
from typing import List, Optional, Dict, Set
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os, uuid, secrets, hashlib, json, asyncio, logging, traceback

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
    except JWTError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

# ------------------------------
# Logging
# ------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ------------------------------
# FastAPI App & Router
# ------------------------------
app = FastAPI(title="GhostRecon API")
api_router = APIRouter(prefix="/api")

# ------------------------------
# Global Exception Handler
# ------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error(f"Unhandled exception: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )

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

# (Other models remain the same as your original code...)
# For brevity, assume all models are copied here unchanged

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
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        ws_manager.disconnect(user_id, websocket)

# ------------------------------
# Status Endpoints
# ------------------------------
@api_router.get("/", tags=["Status"])
async def root(): 
    return {"status": "operational", "app": "GhostRecon", "version": "2.0.0"}

@api_router.get("/health", tags=["Status"])
async def health(): 
    return {"status": "ok"}

# ------------------------------
# Auth Endpoints
# ------------------------------
@api_router.post("/auth/register/anonymous", tags=["Auth"])
async def register_anonymous(data: AnonymousRegister):
    try:
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
    except Exception as e:
        logger.error(f"Anonymous registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# (Other auth endpoints like pseudonym register & login should also have try/except with logging)
# Copy same pattern for safety

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
# Shutdown Hook
# ------------------------------
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
