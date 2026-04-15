"""
AIP Authentication Router
--------------------------
Authentication is handled by Supabase. The backend validates Supabase JWTs
and auto-provisions users in the local DB on first login.

Endpoints:
    GET  /api/auth/me     - Get current authenticated user profile
    POST /api/auth/sync   - Sync Supabase user to local DB (idempotent)
    POST /api/auth/logout - Logout hint (client discards JWT)
"""

import logging

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from backend.models import User
from backend.security.auth import get_current_user, limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@limiter.limit("20/minute")
@router.post("/sync", response_model=UserResponse)
async def sync_user(request: Request, current_user: User = Depends(get_current_user)):
    """
    Sync the authenticated Supabase user to the local AIP profile.

    Call this after login to ensure the local user record exists and is
    up to date. The auto-provisioning in get_current_user handles creation;
    this endpoint is a no-op if the user already exists.
    """
    return current_user


@router.post("/logout")
async def logout():
    """
    Client-side logout — instruct the client to discard the JWT token.
    Supabase session invalidation must be performed on the client using
    supabase.auth.signOut().
    """
    return {"success": True, "message": "Logged out. Please discard your access token."}
