# auth.py - supports both Supabase JWTs and internal AIP JWTs
import os
import bcrypt
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from backend.models import User as UserModel
from backend.database import get_db
from backend.schemas import Token, User as UserSchema

# Internal AIP JWT secret (legacy)
SECRET_KEY = os.environ.get("SECRET_KEY", "aip-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Supabase credentials for verifying frontend tokens via API
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
http_bearer = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_exception
    token = credentials.credentials

    # 1. Try Supabase API verification (reliable, no JWT secret encoding issues)
    if SUPABASE_URL and SUPABASE_ANON_KEY:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{SUPABASE_URL}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": SUPABASE_ANON_KEY,
                    },
                    timeout=5.0,
                )
            if response.status_code == 200:
                user_data = response.json()
                email = user_data.get("email")
                supabase_uuid = user_data.get("id", "")
                full_name = (user_data.get("user_metadata") or {}).get("full_name", "")
                if email:
                    # Try to find user in local DB by email
                    user = db.query(UserModel).filter(UserModel.email == email).first()
                    if user:
                        return user
                    # User exists in Supabase but not in local DB — create them so
                    # write operations (created_by_id, etc.) have a valid integer ID.
                    new_user = UserModel(
                        uuid=supabase_uuid or email,
                        email=email,
                        password_hash="",  # Supabase handles authentication
                        full_name=full_name or None,
                        is_email_verified=True,
                        is_phone_verified=False,
                        status="active",
                    )
                    db.add(new_user)
                    db.commit()
                    db.refresh(new_user)
                    return new_user
        except Exception:
            pass  # Fall through to legacy JWT check

    # 2. Fall back to legacy internal AIP JWT
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    try:
        user = db.query(UserModel).filter(UserModel.id == int(username)).first()
    except (ValueError, TypeError):
        user = db.query(UserModel).filter(UserModel.email == username).first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: UserModel = Depends(get_current_user)):
    return current_user
