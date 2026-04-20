"""AIP Platform - FastAPI Backend (Africa Infrastructure Projects)"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.database import engine
from backend.models import Base
from backend.routers.analytics import router as analytics_router
from backend.routers.airtable import router as airtable_router
from backend.routers.auth import router as auth_router
from backend.routers.data_rooms import router as data_rooms_router
from backend.routers.deal_rooms import router as deal_rooms_router
from backend.routers.events import router as events_router
from backend.routers.introductions import router as introductions_router
from backend.routers.investors import router as investors_router
from backend.routers.projects import router as projects_router
from backend.routers.verifications import router as verifications_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("aip")

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AIP API starting up")
    db_url = os.getenv("DATABASE_URL", "sqlite:///./aip.db")
    if db_url.startswith("sqlite"):
        # SQLite only: auto-create tables for local dev.
        # Use checkfirst=True and swallow "already exists" from multi-worker race.
        try:
            Base.metadata.create_all(bind=engine, checkfirst=True)
            logger.info("SQLite tables created/verified")
        except Exception as exc:  # noqa: BLE001
            logger.warning("DB init skipped (race or schema issue): %s", exc)
    else:
        logger.info("PostgreSQL: skipping create_all (managed by Supabase/Alembic)")
    yield
    logger.info("AIP API shutting down")


def _get_cors_origins():
    env_origins = [
        o.strip()
        for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if o.strip()
    ]
    # Only add localhost default in non-production to avoid leaking dev access
    defaults = ["https://aip-plum.vercel.app"]
    if os.getenv("NODE_ENV") != "production" and os.getenv("ENVIRONMENT") != "production":
        defaults.append("http://localhost:3000")
    return list(dict.fromkeys(env_origins + defaults))


app = FastAPI(
    title="AIP API",
    description="Africa Infrastructure Projects",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Explicit header list — wildcard ("*") allows dangerous CSRF headers
    allow_headers=[
        "authorization",
        "content-type",
        "x-requested-with",
        "accept",
        "origin",
        "x-supabase-auth",
        "apikey",
    ],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log with full traceback for observability, but never expose it to the client
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred.",
            "requestId": request.headers.get("x-request-id", ""),
        },
    )


@app.get("/", tags=["Health"])
def root():
    return {"status": "AIP API is running", "version": "2.0.0"}


@app.get("/health", tags=["Health"])
def health_check():
    import datetime
    return {
        "status": "healthy",
        "service": "aip-api",
        "version": "2.0.0",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "environment": os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development")),
    }


@app.get("/health/live", tags=["Health"])
def health_live():
    """Liveness probe — confirms the process is running."""
    return {"live": True}


@app.get("/health/ready", tags=["Health"])
def health_ready():
    """Readiness probe — confirms the app is ready to serve traffic."""
    from backend.database import engine
    from sqlalchemy import text as _text
    try:
        with engine.connect() as conn:
            conn.execute(_text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    if not db_ok:
        return JSONResponse(status_code=503, content={"ready": False, "reason": "database unavailable"})
    return {"ready": True}


@app.get("/ping", tags=["Health"])
def ping():
    return {"pong": True}


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(investors_router)
app.include_router(introductions_router)
app.include_router(data_rooms_router)
app.include_router(deal_rooms_router)
app.include_router(analytics_router)
app.include_router(events_router)
app.include_router(verifications_router)
app.include_router(airtable_router)

_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount(
        "/static",
        StaticFiles(directory=str(_static_dir), html=True),
        name="frontend",
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
    )
