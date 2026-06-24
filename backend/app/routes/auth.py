from fastapi import APIRouter, HTTPException, status, Depends, Header
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import Optional
from app.models import UserRegister, UserLogin, UserResponse, AuthResponse
from app.db import db
from app.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.access_token_expire_days)
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract user_id from Authorization header (Bearer token)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization
    if token.startswith("Bearer "):
        token = token[7:]
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.post("/register", response_model=AuthResponse)
def register(data: UserRegister):
    """Register a new user."""
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    existing = db.query("SELECT id FROM users WHERE email = %s", (data.email.lower(),))
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    
    password_hash = hash_password(data.password)
    user = db.query_one(
        "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id, name, email, created_at",
        (data.name, data.email.lower(), password_hash)
    )
    
    token = create_access_token(user["id"])
    return {
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "created_at": user["created_at"]
        },
        "token": token
    }

@router.post("/login", response_model=AuthResponse)
def login(data: UserLogin):
    """Log in an existing user."""
    user = db.query_one("SELECT * FROM users WHERE email = %s", (data.email.lower(),))
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    token = create_access_token(user["id"])
    return {
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "created_at": user["created_at"]
        },
        "token": token
    }

@router.get("/me", response_model=dict)
def get_current_user(user_id: str = Depends(get_current_user_id)):
    """Get current authenticated user."""
    user = db.query_one("SELECT id, name, email, created_at FROM users WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"user": user}
