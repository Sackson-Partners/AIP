"""Authentication router."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    decode_access_token, decode_supabase_token
)
from app.core.config import settings
from app.models.user import User
from app.models.organization import OrgMember
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user from JWT token (internal or Supabase)."""
    if not token:
        return None

    # Try internal JWT first
    payload = decode_access_token(token)
    if payload:
        user_id = payload.get("sub")
        if user_id:
            try:
                user = db.query(User).filter(User.id == int(user_id)).first()
                if user:
                    return user
            except (ValueError, TypeError):
                pass

    # Try Supabase JWT (frontend sends Supabase tokens)
    supabase_payload = decode_supabase_token(token)
    if supabase_payload:
        email = supabase_payload.get("email")
        if email:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                # Auto-provision user from Supabase data
                user_meta = supabase_payload.get("user_metadata", {})
                full_name = (
                    user_meta.get("full_name") or
                    user_meta.get("name") or
                    email.split("@")[0]
                )
                user = User(
                    email=email,
                    full_name=full_name,
                    phone=user_meta.get("phone", ""),
                    password_hash="supabase_managed",
                    status="active",
                    is_email_verified=bool(supabase_payload.get("email_confirmed_at")),
                )
                db.add(user)
                try:
                    db.commit()
                    db.refresh(user)
                except Exception:
                    db.rollback()
                    user = db.query(User).filter(User.email == email).first()
            elif user.status != "active":
                user.status = "active"
                db.commit()
            return user

    return None


def require_auth(
    current_user: Optional[User] = Depends(get_current_user)
) -> User:
    """Require authenticated user."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )
    return current_user


def get_user_role(current_user: User, db: Session) -> str:
    """Get user's primary role from organization membership."""
    membership = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id,
        OrgMember.status == "active"
    ).first()
    return membership.role if membership else "viewer"


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user with internal auth."""
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        phone=getattr(user_data, "phone", ""),
        password_hash=get_password_hash(user_data.password),
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login with email/password and get internal JWT."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    user.last_login_at = datetime.utcnow()
    db.commit()
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """Login with email/password."""
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    user.last_login_at = datetime.utcnow()
    db.commit()
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(require_auth)):
    """Get current user profile."""
    return current_user
