# security.py
# This file encapsulates security dependencies and utilities for the AIP platform.
# It includes JWT authentication logic, password hashing, and role-based access controls.
# This enhances AIP's secure data rooms and deal workflows by ensuring role-based access,
# protecting sensitive project intelligence and reducing risks in connecting African infrastructure
# projects with global capital.

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import InvalidTokenError as JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from backend.models import User
from backend.database import get_db
from dotenv import load_dotenv
load_dotenv()  # Must run before os.getenv

from backend.schemas import User as UserSchema

SECRET_KEY = "your-secret-key"  # Load from env in production: os.getenv('SECRET_KEY')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    # Truncate to 72 bytes for bcrypt limit
    truncated = plain_password[:72] if plain_password else ""
    return pwd_context.verify(truncated, hashed_password)

def get_password_hash(password):
    # Truncate to 72 bytes for bcrypt limit
    truncated = password[:72] if password else ""
    return pwd_context.hash(truncated)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserSchema:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return UserSchema.from_orm(user)

def get_current_admin(current_user: UserSchema = Depends(get_current_user)) -> UserSchema:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user