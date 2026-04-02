"""
AIP Authentication & Authorization Middleware
---------------------------------------------
JWT-based authentication for the AIP FastAPI backend.
Supports three token types in priority order:
  1. Local HS256 JWTs issued by /api/auth/token       (existing backend users)
  2. Supabase JWTs verified offline via SUPABASE_JWT_SECRET  (fast, no network)
  3. Supabase JWTs verified via Supabase REST API     (fallback — uses SUPABASE_URL)

When a Supabase token arrives, the user is looked up or auto-provisioned in the
local DB so that every protected endpoint works transparently.

Usage:
    from backend.security.auth import get_current_user, require_admin

    @router.get("/protected")
    async def protected_route(current_user: User = Depends(get_current_user)):
        ...
"""

from dotenv import load_dotenv
load_dotenv()

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from passlib.context import CryptContext
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User

# Shared rate limiter — imported by main.py and routers/auth.py
limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

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


# Maps Supabase role names → backend RBAC roles
SUPABASE_TO_BACKEND_ROLE: dict[str, str] = {
    "super_admin": "admin",
    "admin": "admin",
    "ic_member": "ic_member",
    "private_fund": "analyst",
    "dfi": "analyst",
    "epc_contractor": "analyst",
    "government": "analyst",
    "academic": "analyst",
    "journalist_analyst": "analyst",
    "investor": "analyst",
}
DEFAULT_ROLE = "analyst"


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None
    role: Optional[str] = None


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


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
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


def _decode_local_token(token: str) -> Optional[TokenData]:
    """
    Try to decode as a locally-issued HS256 JWT.
    Returns None on failure — does NOT raise.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: str = payload.get("user_id")
        if email is None:
            return None
        return TokenData(email=email, user_id=user_id)
    except JWTError:
        return None


def _decode_supabase_token_offline(token: str) -> Optional[TokenData]:
    """
    Try to verify a Supabase JWT offline using SUPABASE_JWT_SECRET.
    Fast: no network call. Returns None if secret not set or token is invalid.
    """
    if not SUPABASE_JWT_SECRET:
        return None
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        email: str = payload.get("email")
        user_id: str = payload.get("sub")
        if not email and user_id and "@" in user_id:
            email = user_id
        raw_role = (
            (payload.get("user_metadata") or {}).get("role")
            or (payload.get("app_metadata") or {}).get("role")
            or payload.get("role")
        )
        backend_role = SUPABASE_TO_BACKEND_ROLE.get(raw_role or "", DEFAULT_ROLE)
        if email:
            return TokenData(email=email, user_id=user_id, role=backend_role)
    except JWTError:
        pass
    return None


async def _verify_supabase_token_api(token: str) -> Optional[TokenData]:
    """
    Verify a Supabase token via the Supabase Auth REST API.
    Fallback when SUPABASE_JWT_SECRET is not set.
    Requires SUPABASE_URL and SUPABASE_ANON_KEY env vars.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        logger.warning(
            "Supabase token cannot be verified: SUPABASE_JWT_SECRET and "
            "SUPABASE_URL/SUPABASE_ANON_KEY are not set. "
            "Add at least one of these to the Azure Container App env vars."
        )
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_ANON_KEY,
                },
            )
        if resp.status_code == 200:
            data = resp.json()
            email: str = data.get("email")
            user_id: str = data.get("id")
            raw_role = (
                (data.get("user_metadata") or {}).get("role")
                or (data.get("app_metadata") or {}).get("role")
            )
            backend_role = SUPABASE_TO_BACKEND_ROLE.get(raw_role or "", DEFAULT_ROLE)
            if email:
                return TokenData(email=email, user_id=user_id, role=backend_role)
        else:
            logger.debug(
                "Supabase API token check: %s %s",
                resp.status_code,
                resp.text[:200],
            )
    except Exception as exc:
        logger.debug("Supabase API token check failed: %s", exc)
    return None


def decode_token(token: str) -> TokenData:
    """
    Synchronous decode — tries local JWT then Supabase offline.
    Raises HTTPException 401 on failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    result = _decode_local_token(token) or _decode_supabase_token_offline(token)
    if result is None:
        raise credentials_exception
    return result


# ---------------------------------------------------------------------------
# FastAPI Dependencies
# ---------------------------------------------------------------------------


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Resolve the current user from any supported token type.

    Priority order:
      1. Local HS256 JWT  (offline, fast)
      2. Supabase JWT via SUPABASE_JWT_SECRET  (offline, fast)
      3. Supabase JWT via REST API  (network fallback)

    Supabase users are auto-provisioned in the local DB on first login.

    Raises:
        HTTPException 401 if no token type validates.
        HTTPException 403 if the user account is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Try local JWT (fast, offline)
    token_data = _decode_local_token(token)

    # 2. Try Supabase offline (fast, no network)
    if token_data is None:
        token_data = _decode_supabase_token_offline(token)

    # 3. Fall back to Supabase REST API (network call)
    if token_data is None:
        token_data = await _verify_supabase_token_api(token)

    if token_data is None or not token_data.email:
        raise credentials_exception

    # 4. Look up user in local DB
    user = db.query(User).filter(User.email == token_data.email).first()

    # 5. Auto-provision Supabase users on first login (role from JWT claims)
    if user is None:
        provisioned_role = token_data.role or DEFAULT_ROLE
        logger.info(
            "Auto-provisioning local user for Supabase account: %s (role: %s)",
            token_data.email,
            provisioned_role,
        )
        user = User(
            email=token_data.email,
            full_name=token_data.email.split("@")[0],
            hashed_password=hash_password(os.urandom(32).hex()),
            role=provisioned_role,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except Exception as e:
            db.rollback()
            logger.warning("Race condition on user provision: %s", e)
            user = db.query(User).filter(
                User.email == token_data.email
            ).first()
    elif token_data.role and user.role != token_data.role:
        # Keep backend role in sync with Supabase role changes
        logger.info(
            "Syncing role for %s: %s → %s",
            token_data.email,
            user.role,
            token_data.role,
        )
        user.role = token_data.role
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning("Role sync failed: %s", e)

    if user is None:
        raise credentials_exception

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
    async def _check(
        current_user: User = Depends(get_current_user),
    ) -> User:
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


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> Optional[User]:
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
