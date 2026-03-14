from dotenv import load_dotenv
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

"""
Database configuration - SQLite (dev) or PostgreSQL (prod).
"""
import logging
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("aip.database")

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./aip.db")
if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
IS_SQLITE = DATABASE_URL.startswith("sqlite")
IS_POSTGRES = DATABASE_URL.startswith("postgresql")
logger.info("Database backend: %s", "SQLite" if IS_SQLITE else "PostgreSQL")

_engine_kwargs: dict = {}
if IS_SQLITE:
        _engine_kwargs = {"connect_args": {"check_same_thread": False}, "pool_pre_ping": True}
elif IS_POSTGRES:
        _engine_kwargs = {
                    "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
                    "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "10")),
                    "pool_pre_ping": True,
                    "pool_recycle": 1800,
        }
    
engine = create_engine(DATABASE_URL, **_engine_kwargs)

if IS_SQLITE:
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
                    cursor = dbapi_connection.cursor()
                    cursor.execute("PRAGMA journal_mode=WAL")
                    cursor.execute("PRAGMA foreign_keys=ON")
                    cursor.close()
            
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
        db = SessionLocal()
        try:
                    yield db
        except Exception:
                    db.rollback()
                    raise
        finally:
                    db.close()load_dotenv()

# Use aip_platform.db as the default database
db_path = os.path.join(os.path.dirname(__file__), 'aip_platform.db')
default_db_url = f"sqlite:///{db_path}"

# Support both SQLALCHEMY_DATABASE_URL and DATABASE_URL (Railway standard)
SQLALCHEMY_DATABASE_URL = (
    os.getenv("SQLALCHEMY_DATABASE_URL")
    or os.getenv("DATABASE_URL", default_db_url)
)

# Railway provides postgres:// but SQLAlchemy needs postgresql://
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
