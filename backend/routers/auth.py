"""
AIP Authentication Router
--------------------------
Handles user registration, login, and token management.

Endpoints:
    POST /api/auth/register   - Register a new user account
    POST /api/auth/token      - Login and receive JWT access token
    GET  /api/auth/me         - Get current authenticated user profile
    POST /api/auth/logout     - Invalidate session (client-side token removal)
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.security.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    Token,
    authenticate_user,
    create_access_token,
    get_current_user,
    hash_password,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Min 8 characters")
    full_name: str | None = None
    organisation: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    organisation: str | None
    role: str
    is_active: bool
    is_verified: bool

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new AIP platform user."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )
    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        organisation=user_in.organisation,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New user registered: %s", user.email)
    return user


@router.post("/token", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate with email/password and receive a JWT access token."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        data={"sub": user.email, "user_id": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(
        access_token=token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.post("/logout")
async def logout():
    """
    Client-side logout — instruct the client to discard the JWT token.
    Server-side token invalidation is handled via token expiry.
    """
    return {"success": True, "message": "Logged out. Please discard your access token."}


# Alias: /login → same as /token (frontend compatibility)
@router.post("/login", response_model=Token, include_in_schema=True)
async def login_alias(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Alias for /token — accepts username/password form data."""
    from backend.routers.auth import login as _login
    return await _login(form_data=form_data, db=db)
