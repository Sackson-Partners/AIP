"""Authentication and security utilities."""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt  # PyJWT
import bcrypt
import httpx
from jose import jwt as jose_jwt, JWTError
from .config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    if hashed_password == "supabase_managed":
        return False
    truncated = (plain_password[:72] if plain_password else "").encode('utf-8')
    return bcrypt.checkpw(truncated, hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    """Hash a password for storage."""
    truncated = (password[:72] if password else "").encode('utf-8')
    hashed = bcrypt.hashpw(truncated, bcrypt.gensalt())
    return hashed.decode('utf-8')


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.JWT_EXPIRATION_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify an internal JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


# Cache for Supabase JWKS
_supabase_jwks_cache: Optional[Dict] = None


def get_supabase_jwks() -> Dict:
    """Fetch and cache Supabase JWKS for JWT verification."""
    global _supabase_jwks_cache
    if _supabase_jwks_cache is not None:
        return _supabase_jwks_cache
    try:
        if settings.SUPABASE_URL:
            resp = httpx.get(
                f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
                timeout=5.0
            )
            if resp.status_code == 200:
                _supabase_jwks_cache = resp.json()
                return _supabase_jwks_cache
    except Exception:
        pass
    _supabase_jwks_cache = {"keys": []}
    return _supabase_jwks_cache


def decode_supabase_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and verify a Supabase JWT token.
    Supports ECC P-256 (current) and HS256 (legacy) signing keys.
    """
    # Try JWKS-based verification (ECC P-256 / asymmetric keys)
    try:
        jwks = get_supabase_jwks()
        if jwks.get("keys"):
            header = jose_jwt.get_unverified_header(token)
            kid = header.get("kid")
            alg = header.get("alg", "ES256")
            key = None
            for k in jwks["keys"]:
                if not kid or k.get("kid") == kid:
                    key = k
                    break
            if key:
                payload = jose_jwt.decode(
                    token,
                    key,
                    algorithms=[alg, "ES256", "RS256"],
                    options={"verify_aud": False}
                )
                return payload
    except Exception:
        pass

    # Try legacy HS256 shared secret
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jose_jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return payload
        except Exception:
            pass

    return None
