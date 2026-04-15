import os
import time
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

logger = logging.getLogger("aip")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Set it to a PostgreSQL connection string, e.g. "
        "postgresql+psycopg2://user:pass@host:5432/aip"
    )

# Strip surrounding quotes if present (Azure CLI sometimes adds them)
DATABASE_URL = DATABASE_URL.strip('"').strip("'")

# Fix URL scheme for SQLAlchemy compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

logger.info(f"Database backend: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")

connect_args = {}
if "sqlite" in DATABASE_URL:
    # SQLite is only used in automated tests — not supported in production.
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=300,
        pool_timeout=30,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ---------------------------------------------------------------------------
# Query performance logging
# ---------------------------------------------------------------------------

@event.listens_for(engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.monotonic())


@event.listens_for(engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    elapsed = time.monotonic() - conn.info["query_start_time"].pop()
    if elapsed >= 2.0:
        try:
            import sentry_sdk
            sentry_sdk.capture_message(
                f"Slow DB query ({elapsed:.2f}s): {statement[:200]}",
                level="warning",
            )
        except Exception:
            pass
        logger.warning("SLOW QUERY (%.2fs): %.200s", elapsed, statement)
    elif elapsed >= 0.5:
        logger.info("QUERY (%.2fs): %.200s", elapsed, statement)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
