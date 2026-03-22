"""
AIP Authentication & Authorization Middleware
---------------------------------------------
JWT-based authentication for the AIP FastAPI backend.
Integrates with the User model and protects sensitive routes.

Usage:
    from backend.security.auth import get_current_user, require_admin

    @router.get("/protected")
    async def protected_route(current_user: User = Depends(get_current_user)):
        ...
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

if not SECRET_KEY:
    logger.warning(
        "SECRET_KEY is not set! Using an insecure default. "
        "Set SECRET_KEY in Azure Key Vault before deploying to production."
    )
    SECRET_KEY = "INSECURE_DEFAULT_KEY_REPLACE_IN_PRODUCTION"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


# ---------------------------------------------------------------------------
# Token Models
# ---------------------------------------------------------------------------


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Password Utilities
# ---------------------------------------------------------------------------


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(password)


# ---------------------------------------------------------------------------
# JWT Utilities
# ---------------------------------------------------------------------------


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.

    Args:
        data:          Payload to encode (e.g. {'sub': email, 'user_id': id}).
        expires_delta: Token lifetime. Defaults to ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        Signed JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenData:
    """
    Decode and validate a JWT token.

    Raises:
        HTTPException 401 if token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: str = payload.get("user_id")
        if email is None:
            raise credentials_exception
        return TokenData(email=email, user_id=user_id)
    except JWTError:
        raise credentials_exception


# ---------------------------------------------------------------------------
# FastAPI Dependencies
# ---------------------------------------------------------------------------


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency: decode JWT, look up the user, return active User object.

    Raises:
        HTTPException 401 if token invalid.
        HTTPException 403 if user is inactive.
    """
    token_data = decode_token(token)
    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    return user


async def get_current_verified_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the user to have completed identity verification."""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account verification required to access this resource.",
        )
    return current_user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the user to have the 'admin' role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


async def require_analyst(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the user to be an admin or analyst."""
    if current_user.role not in ("admin", "analyst"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst access required.",
        )
    return current_user


async def require_ic_member(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the user to be an IC member or admin."""
    if current_user.role not in ("admin", "ic_member"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IC Member access required.",
        )
    return current_user


def require_roles(allowed_roles: list[str]):
    """
    Factory that returns a FastAPI dependency enforcing a set of allowed roles.

    Usage:
        @router.post("/endpoint")
        async def endpoint(user = Depends(require_roles(["admin", "analyst"]))):
            ...
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these roles required: {allowed_roles}",
            )
        return current_user
    return _check


# ---------------------------------------------------------------------------
# User Authentication Helper
# ---------------------------------------------------------------------------


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Look up a user by email and verify their password.

    Returns:
        The User object if credentials are valid, None otherwise.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
