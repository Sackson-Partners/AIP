"""AIP Platform - Database configuration (SQLite dev / PostgreSQL prod)"""
import logging
import os
import time
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger("aip.database")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aip.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")
logger.info("Database: %s", "SQLite" if IS_SQLITE else "PostgreSQL")


def _build_engine(url: str, max_retries: int = 3):
    """Create SQLAlchemy engine with retry logic and exponential backoff."""
    if url.startswith("sqlite"):
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )

    kwargs = {
        # Pooling: min 2 always-open, max 10 total (min:2, max_overflow:8 → total 10)
        "pool_size": int(os.getenv("DB_POOL_SIZE", "2")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "8")),
        "pool_pre_ping": True,
        # Recycle connections after 30 s idle to avoid Azure TCP timeout drops
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "30")),
        # Wait at most 2 s for a connection from the pool before raising
        "pool_timeout": float(os.getenv("DB_POOL_TIMEOUT", "2")),
        # Per-statement execution timeout (30 s)
        "connect_args": {
            "connect_timeout": 10,
            "sslmode": "require",    # Required for Azure PostgreSQL
            "options": "-c statement_timeout=30000",
        },
    }

    for attempt in range(max_retries):
        try:
            eng = create_engine(url, **kwargs)
            # Validate connectivity before returning
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Database connection established (attempt %d)", attempt + 1)
            return eng
        except OperationalError as exc:
            if attempt < max_retries - 1:
                wait = 2 ** attempt  # 1 s, 2 s, 4 s …
                logger.warning(
                    "DB connection attempt %d/%d failed — retrying in %ds: %s",
                    attempt + 1, max_retries, wait, exc,
                )
                time.sleep(wait)
            else:
                logger.error("DB connection failed after %d attempts", max_retries)
                raise


engine = _build_engine(DATABASE_URL)

if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()
else:
    # Pool health/error monitoring — prevents silent crashes on connection loss
    @event.listens_for(engine, "invalidate")
    def receive_invalidate(dbapi_conn, connection_record, exception):
        logger.warning("DB connection invalidated: %s", exception)

    @event.listens_for(engine, "soft_invalidate")
    def receive_soft_invalidate(dbapi_conn, connection_record):
        logger.debug("DB connection soft-invalidated (will be recycled)")


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as exc:
        logger.warning("Rolling back DB session due to exception: %s", exc)
        db.rollback()
        raise
    finally:
        db.close()
