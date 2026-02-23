from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
import secrets
import json
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Set
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'ghostrecon_db')]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

app = FastAPI(title="GhostRecon API")
api_router = APIRouter(prefix="/api")

# ============ MODELS ============

class AnonymousRegister(BaseModel):
    device_fingerprint: str
    alias: Optional[str] = None

class PseudonymRegister(BaseModel):
    alias: str
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str

class LoginRequest(BaseModel):
    identifier: str  # email, phone, or device_fingerprint
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    alias: str
    registration_type: str
    trust_level: int = 0
    encryption_key_hash: str
    created_at: str
    is_online: bool = False
    last_seen: Optional[str] = None

class ContactAdd(BaseModel):
    target_user_id: str
    trust_level: int = 1  # 1-5

class ConversationCreate(BaseModel):
    participant_ids: List[str]
    name: Optional[str] = None
    is_group: bool = False

class MessageCreate(BaseModel):
    conversation_id: str
    content: str
    self_destruct_seconds: Optional[int] = None
    forward_protected: bool = True

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_alias: str
    content: str
    encrypted: bool = True
    self_destruct_seconds: Optional[int] = None
    forward_protected: bool = True
    created_at: str
    expires_at: Optional[str] = None

class CallCreate(BaseModel):
    target_user_id: str
    call_type: str = "voice"  # voice or video

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
    signal_type: str  # offer, answer, ice-candidate
    signal_data: str

# ============ AUTH HELPERS ============

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

def generate_encryption_key_hash():
    key = secrets.token_bytes(32)
    return hashlib.sha256(key).hexdigest()

# ============ AUTH ROUTES ============

@api_router.post("/auth/register/anonymous")
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
    user.pop("_id", None)
    token = create_token(user_id, alias)
    return {"token": token, "user": user}

@api_router.post("/auth/register/pseudonym")
async def register_pseudonym(data: PseudonymRegister):
    if data.email:
        existing = await db.users.find_one({"email": data.email}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    if data.phone:
        existing = await db.users.find_one({"phone": data.phone}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Phone already registered")

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
    user.pop("_id", None)
    user.pop("password_hash", None)
    token = create_token(user_id, data.alias)
    return {"token": token, "user": user}

@api_router.post("/auth/login")
async def login(data: LoginRequest):
    user = await db.users.find_one(
        {"$or": [
            {"email": data.identifier},
            {"phone": data.identifier},
            {"device_fingerprint": data.identifier}
        ]},
        {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("registration_type") == "pseudonym":
        if not data.password or not pwd_context.verify(data.password, user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Invalid credentials")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc).isoformat()}}
    )
    user.pop("password_hash", None)
    token = create_token(user["id"], user["alias"])
    return {"token": token, "user": user}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    safe_user = {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}
    return safe_user

# ============ CONTACTS ROUTES ============

@api_router.post("/contacts")
async def add_contact(data: ContactAdd, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": data.target_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.contacts.find_one(
        {"user_id": user["id"], "contact_id": data.target_user_id},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Contact already exists")

    contact = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "contact_id": data.target_user_id,
        "contact_alias": target["alias"],
        "trust_level": data.trust_level,
        "verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.contacts.insert_one(contact)
    contact.pop("_id", None)
    return contact

@api_router.get("/contacts")
async def get_contacts(user=Depends(get_current_user)):
    contacts = await db.contacts.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    enriched = []
    for c in contacts:
        target = await db.users.find_one({"id": c["contact_id"]}, {"_id": 0, "password_hash": 0})
        if target:
            c["contact_info"] = {
                "alias": target.get("alias"),
                "is_online": target.get("is_online", False),
                "last_seen": target.get("last_seen"),
                "trust_level": c.get("trust_level", 0)
            }
        enriched.append(c)
    return enriched

@api_router.put("/contacts/{contact_id}/trust")
async def update_trust_level(contact_id: str, trust_level: int, user=Depends(get_current_user)):
    if trust_level < 0 or trust_level > 5:
        raise HTTPException(status_code=400, detail="Trust level must be 0-5")
    result = await db.contacts.update_one(
        {"id": contact_id, "user_id": user["id"]},
        {"$set": {"trust_level": trust_level}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "updated", "trust_level": trust_level}

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user=Depends(get_current_user)):
    result = await db.contacts.delete_one({"id": contact_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "deleted"}

# ============ CONVERSATIONS ROUTES ============

@api_router.post("/conversations")
async def create_conversation(data: ConversationCreate, user=Depends(get_current_user)):
    all_participants = list(set([user["id"]] + data.participant_ids))

    if not data.is_group and len(all_participants) == 2:
        existing = await db.conversations.find_one(
            {"participants": {"$all": all_participants, "$size": 2}, "is_group": False},
            {"_id": 0}
        )
        if existing:
            return existing

    conv = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "is_group": data.is_group,
        "participants": all_participants,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_message": None,
        "last_message_at": datetime.now(timezone.utc).isoformat(),
        "encryption_protocol": "AES-256-GCM + X25519",
        "key_rotation_count": 0
    }
    await db.conversations.insert_one(conv)
    conv.pop("_id", None)
    return conv

@api_router.get("/conversations")
async def get_conversations(user=Depends(get_current_user)):
    convs = await db.conversations.find(
        {"participants": user["id"]},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)

    enriched = []
    for c in convs:
        participant_info = []
        for pid in c.get("participants", []):
            if pid != user["id"]:
                p = await db.users.find_one({"id": pid}, {"_id": 0, "password_hash": 0})
                if p:
                    participant_info.append({
                        "id": p["id"],
                        "alias": p["alias"],
                        "is_online": p.get("is_online", False)
                    })
        c["participant_info"] = participant_info
        unread = await db.messages.count_documents({
            "conversation_id": c["id"],
            "sender_id": {"$ne": user["id"]},
            "read": False
        })
        c["unread_count"] = unread
        enriched.append(c)
    return enriched

@api_router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user=Depends(get_current_user)):
    conv = await db.conversations.find_one(
        {"id": conv_id, "participants": user["id"]},
        {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

# ============ MESSAGES ROUTES ============

@api_router.post("/messages")
async def send_message(data: MessageCreate, user=Depends(get_current_user)):
    conv = await db.conversations.find_one(
        {"id": data.conversation_id, "participants": user["id"]},
        {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    now = datetime.now(timezone.utc)
    expires_at = None
    if data.self_destruct_seconds:
        expires_at = (now + timedelta(seconds=data.self_destruct_seconds)).isoformat()

    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": data.conversation_id,
        "sender_id": user["id"],
        "sender_alias": user["alias"],
        "content": data.content,
        "encrypted": True,
        "self_destruct_seconds": data.self_destruct_seconds,
        "forward_protected": data.forward_protected,
        "created_at": now.isoformat(),
        "expires_at": expires_at,
        "read": False,
        "recalled": False
    }
    await db.messages.insert_one(message)
    message.pop("_id", None)

    await db.conversations.update_one(
        {"id": data.conversation_id},
        {"$set": {
            "last_message": data.content[:50],
            "last_message_at": now.isoformat()
        }}
    )

    # Broadcast via WebSocket
    await ws_manager.broadcast_to_conversation(
        data.conversation_id,
        {"type": "new_message", "message": message},
        exclude_user=user["id"]
    )

    return message

@api_router.get("/messages/{conv_id}")
async def get_messages(conv_id: str, user=Depends(get_current_user)):
    conv = await db.conversations.find_one(
        {"id": conv_id, "participants": user["id"]},
        {"_id": 0}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    now = datetime.now(timezone.utc)
    await db.messages.delete_many({
        "conversation_id": conv_id,
        "expires_at": {"$ne": None, "$lt": now.isoformat()}
    })

    messages = await db.messages.find(
        {"conversation_id": conv_id, "recalled": False},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)

    await db.messages.update_many(
        {"conversation_id": conv_id, "sender_id": {"$ne": user["id"]}, "read": False},
        {"$set": {"read": True}}
    )
    return messages

@api_router.delete("/messages/{message_id}")
async def recall_message(message_id: str, user=Depends(get_current_user)):
    result = await db.messages.update_one(
        {"id": message_id, "sender_id": user["id"]},
        {"$set": {"recalled": True, "content": "[Message Recalled]"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found or not yours")
    return {"status": "recalled"}

# ============ CALLS ROUTES ============

@api_router.post("/calls")
async def initiate_call(data: CallCreate, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": data.target_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    call = {
        "id": str(uuid.uuid4()),
        "caller_id": user["id"],
        "caller_alias": user["alias"],
        "receiver_id": data.target_user_id,
        "receiver_alias": target["alias"],
        "call_type": data.call_type,
        "status": "initiated",
        "encryption": "SRTP + ZRTP",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "duration_seconds": None
    }
    await db.calls.insert_one(call)
    call.pop("_id", None)
    return call

@api_router.get("/calls")
async def get_call_history(user=Depends(get_current_user)):
    calls = await db.calls.find(
        {"$or": [{"caller_id": user["id"]}, {"receiver_id": user["id"]}]},
        {"_id": 0}
    ).sort("started_at", -1).to_list(100)
    return calls

@api_router.put("/calls/{call_id}/end")
async def end_call(call_id: str, user=Depends(get_current_user)):
    call = await db.calls.find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    now = datetime.now(timezone.utc)
    started = datetime.fromisoformat(call["started_at"])
    duration = int((now - started).total_seconds())

    await db.calls.update_one(
        {"id": call_id},
        {"$set": {
            "status": "ended",
            "ended_at": now.isoformat(),
            "duration_seconds": duration
        }}
    )
    return {"status": "ended", "duration_seconds": duration}

# ============ SECURITY ROUTES ============

@api_router.put("/security/settings")
async def update_security_settings(settings: SecuritySettings, user=Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"security_settings": settings.dict()}}
    )
    return {"status": "updated", "settings": settings.dict()}

@api_router.get("/security/settings")
async def get_security_settings(user=Depends(get_current_user)):
    return user.get("security_settings", {})

@api_router.post("/security/rotate-keys")
async def rotate_keys(user=Depends(get_current_user)):
    new_key_hash = generate_encryption_key_hash()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"encryption_key_hash": new_key_hash}}
    )
    return {"status": "keys_rotated", "new_key_hash": new_key_hash}

@api_router.post("/security/panic-wipe")
async def panic_wipe(data: PanicWipeRequest, user=Depends(get_current_user)):
    if data.confirm_code != "WIPE-CONFIRM":
        raise HTTPException(status_code=400, detail="Invalid confirmation code")

    user_id = user["id"]
    await db.messages.delete_many({"sender_id": user_id})
    await db.conversations.delete_many({"created_by": user_id})
    await db.contacts.delete_many({"user_id": user_id})
    await db.calls.delete_many({"$or": [{"caller_id": user_id}, {"receiver_id": user_id}]})

    return {"status": "wiped", "message": "All data has been permanently destroyed"}

@api_router.get("/security/session-info")
async def session_info(user=Depends(get_current_user)):
    return {
        "user_id": user["id"],
        "alias": user["alias"],
        "encryption_key_hash": user.get("encryption_key_hash", ""),
        "public_key": user.get("public_key", ""),
        "registration_type": user.get("registration_type"),
        "trust_level": user.get("trust_level", 0),
        "key_rotation_available": True,
        "active_conversations": await db.conversations.count_documents({"participants": user["id"]}),
        "total_contacts": await db.contacts.count_documents({"user_id": user["id"]})
    }

# ============ PUBLIC KEY EXCHANGE ============

@api_router.post("/keys/publish")
async def publish_public_key(data: PublicKeyUpdate, user=Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"public_key": data.public_key}}
    )
    return {"status": "published"}

@api_router.get("/keys/{user_id}")
async def get_public_key(user_id: str, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "public_key": 1, "alias": 1, "id": 1})
    if not target or not target.get("public_key"):
        raise HTTPException(status_code=404, detail="Public key not found")
    return {"user_id": target["id"], "alias": target.get("alias"), "public_key": target["public_key"]}

# ============ CALL SIGNALING ============

@api_router.post("/calls/signal")
async def call_signal(data: CallSignal, user=Depends(get_current_user)):
    call = await db.calls.find_one({"id": data.call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    # Determine target user
    target_id = call["receiver_id"] if call["caller_id"] == user["id"] else call["caller_id"]

    # Send signal via WebSocket
    await ws_manager.send_to_user(target_id, {
        "type": "call_signal",
        "call_id": data.call_id,
        "signal_type": data.signal_type,
        "signal_data": data.signal_data,
        "from_user_id": user["id"]
    })

    return {"status": "signaled"}

@api_router.put("/calls/{call_id}/accept")
async def accept_call(call_id: str, user=Depends(get_current_user)):
    call = await db.calls.find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    await db.calls.update_one({"id": call_id}, {"$set": {"status": "connected"}})

    # Notify caller via WebSocket
    await ws_manager.send_to_user(call["caller_id"], {
        "type": "call_accepted",
        "call_id": call_id,
        "accepted_by": user["id"]
    })

    return {"status": "accepted"}

@api_router.put("/calls/{call_id}/reject")
async def reject_call(call_id: str, user=Depends(get_current_user)):
    call = await db.calls.find_one({"id": call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    await db.calls.update_one({"id": call_id}, {"$set": {"status": "rejected"}})

    # Notify caller via WebSocket
    await ws_manager.send_to_user(call["caller_id"], {
        "type": "call_rejected",
        "call_id": call_id
    })

    return {"status": "rejected"}

# ============ USERS SEARCH ============

@api_router.get("/users/search")
async def search_users(q: str, user=Depends(get_current_user)):
    users = await db.users.find(
        {"alias": {"$regex": q, "$options": "i"}, "id": {"$ne": user["id"]}},
        {"_id": 0, "password_hash": 0, "device_fingerprint": 0}
    ).to_list(20)
    return users

# ============ SEED DATA ============

@api_router.post("/seed")
async def seed_data():
    existing = await db.users.count_documents({})
    if existing > 0:
        return {"status": "already_seeded"}

    agents = [
        {"alias": "Agent Phoenix", "type": "anonymous"},
        {"alias": "Shadow Wolf", "type": "anonymous"},
        {"alias": "Cipher Zero", "type": "pseudonym"},
        {"alias": "Ghost Hawk", "type": "anonymous"},
        {"alias": "Viper Six", "type": "pseudonym"},
        {"alias": "Night Owl", "type": "anonymous"},
    ]

    created_users = []
    for a in agents:
        uid = str(uuid.uuid4())
        user = {
            "id": uid,
            "alias": a["alias"],
            "registration_type": a["type"],
            "device_fingerprint": secrets.token_hex(16) if a["type"] == "anonymous" else None,
            "email": f"{a['alias'].lower().replace(' ', '.')}@ghost.net" if a["type"] == "pseudonym" else None,
            "password_hash": pwd_context.hash("ghost123") if a["type"] == "pseudonym" else None,
            "trust_level": secrets.randbelow(5) + 1,
            "encryption_key_hash": generate_encryption_key_hash(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_online": secrets.randbelow(2) == 1,
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
        user.pop("_id", None)
        created_users.append(user)

    return {"status": "seeded", "users": len(created_users)}

# ============ WEBSOCKET CONNECTION MANAGER ============

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        await db.users.update_one({"id": user_id}, {"$set": {"is_online": True, "last_seen": datetime.now(timezone.utc).isoformat()}})

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # Schedule DB update in background
                try:
                    asyncio.create_task(
                        db.users.update_one(
                            {"id": user_id}, 
                            {"$set": {"is_online": False, "last_seen": datetime.now(timezone.utc).isoformat()}}
                        )
                    )
                except Exception:
                    pass  # Ignore errors in background task

    async def send_to_user(self, user_id: str, data: dict):
        if user_id in self.active_connections:
            dead = set()
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.active_connections[user_id].discard(ws)

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
        if not user_id:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg.get("type") == "typing":
                await ws_manager.broadcast_to_conversation(
                    msg.get("conversation_id", ""),
                    {"type": "typing", "user_id": user_id, "conversation_id": msg.get("conversation_id")},
                    exclude_user=user_id
                )
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)

# ============ PUSH NOTIFICATION TOKEN ============

class PushTokenRegister(BaseModel):
    push_token: str

@api_router.post("/notifications/register")
async def register_push_token(data: PushTokenRegister, user=Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"push_token": data.push_token}}
    )
    return {"status": "registered"}

# ============ STATUS ============

@api_router.get("/")
async def root():
    return {"status": "operational", "app": "GhostRecon", "version": "2.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "ok"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
