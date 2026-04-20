import re
import sys
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
import httpx
import os
from typing import Optional

logger = logging.getLogger("aip.auth")

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Validate required Supabase credentials at startup — fail fast
_missing = [k for k, v in {"SUPABASE_URL": SUPABASE_URL, "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY}.items() if not v]
if _missing:
    logger.critical("Missing required environment variables: %s — exiting", ", ".join(_missing))
    sys.exit(1)


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email format")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify Supabase JWT token and return the user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase credentials not configured",
        )
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_ANON_KEY,
                },
            )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication failed",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )
    return response.json()


@router.post("/register")
async def register(request: RegisterRequest):
    """Register a new user via Supabase Auth."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase credentials not configured",
        )
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            json={
                "email": request.email,
                "password": request.password,
                "data": {
                    "full_name": request.full_name,
                    "phone": request.phone,
                },
            },
        )
    data = response.json()
    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=response.status_code,
            detail=data.get("msg", data.get("message", "Registration failed")),
        )
    return {
        "user": data.get("user"),
        "session": data.get("session"),
        "access_token": (data.get("session") or {}).get("access_token"),
        "message": "Registration successful. Please check your email to confirm your account.",
    }


@router.post("/token")
async def login(username: str = Form(...), password: str = Form(...)):
    """Login with email/password via Supabase Auth."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase credentials not configured",
        )
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            json={
                "email": username,
                "password": password,
            },
        )
    data = response.json()
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=data.get("error_description", data.get("msg", "Invalid credentials")),
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "access_token": data.get("access_token"),
        "token_type": "bearer",
        "expires_in": data.get("expires_in"),
        "refresh_token": data.get("refresh_token"),
        "user": data.get("user"),
    }


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "full_name": user.get("user_metadata", {}).get("full_name"),
        "phone": user.get("user_metadata", {}).get("phone"),
        "created_at": user.get("created_at"),
    }
