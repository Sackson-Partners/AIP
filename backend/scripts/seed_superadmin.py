"""
Seed a superadmin user in the local AIP database.

Usage:
    SUPERADMIN_EMAIL=admin@example.com \
    SUPERADMIN_FULL_NAME="AIP Admin" \
    python -m backend.scripts.seed_superadmin

The script is idempotent — running it twice on the same email is safe.

Environment variables:
    SUPERADMIN_EMAIL     (required) Email of the superadmin account
    SUPERADMIN_FULL_NAME (optional) Display name, defaults to "AIP Superadmin"
    DATABASE_URL         (required) PostgreSQL connection string
    SECRET_KEY           (required) JWT signing key
"""

import os
import sys
import logging

# Ensure project root is on the path when run as a module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    email = os.getenv("SUPERADMIN_EMAIL")
    full_name = os.getenv("SUPERADMIN_FULL_NAME", "AIP Superadmin")

    if not email:
        logger.error("SUPERADMIN_EMAIL environment variable is required.")
        sys.exit(1)

    # Import after env vars are guaranteed to be set (DATABASE_URL, SECRET_KEY)
    from backend.database import SessionLocal
    from backend.models import User
    from backend.security.auth import hash_password

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            if user.role != "admin":
                user.role = "admin"
                user.is_active = True
                user.is_verified = True
                db.commit()
                logger.info("Updated existing user %s → role=admin", email)
            else:
                logger.info("User %s already exists with role=admin. Nothing to do.", email)
        else:
            user = User(
                email=email,
                full_name=full_name,
                # Random password — actual login is via Supabase.
                hashed_password=hash_password(os.urandom(32).hex()),
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info("Created superadmin user: %s (id=%s)", email, user.id)
    finally:
        db.close()


if __name__ == "__main__":
    main()
