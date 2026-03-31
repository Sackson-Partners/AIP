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
from backend.database import Base
from backend.routers.analytics import router as analytics_router
from backend.routers.airtable import router as airtable_router
from backend.routers.auth import router as auth_router
from backend.routers.data_rooms import router as data_rooms_router
from backend.routers.deal_rooms import router as deal_rooms_router
from backend.routers.events import router as events_router
from backend.routers.introductions import router as introductions_router
from backend.routers.investors import router as investors_router
from backend.routers.projects import router as projects_router
from backend.routers.ai import router as ai_router
from backend.routers.verifications import router as verifications_router
# AIP v2 — PETFEL DD Engine, EIN, Pipeline, IC Governance, Matching, Radar, Documents
from backend.routers.petfel import router as petfel_router
from backend.routers.ein import router as ein_router
from backend.routers.pipeline import router as pipeline_router
from backend.routers.ic import router as ic_router
from backend.routers.matching import router as matching_router
from backend.routers.radar import router as radar_router
from backend.routers.documents import router as documents_router
from backend.routers.users import router as users_router

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
    defaults = ["https://www.app.africa-infra.com", "https://www.africa-infra.com", "http://localhost:3000"]
    return list(dict.fromkeys(env_origins + defaults))


app = FastAPI(
    redirect_slashes=False,
    title="AIP API — African Infrastructure Partners",
    description=(
        "Institutional-grade deal origination, PETFEL due diligence, EIN generation, "
        "and AI-powered capital matching for African infrastructure investment. "
        "v2.1 adds PETFEL Engine, Executive Investment Notes, Pipeline Audit Trail, "
        "IC Governance, Investor Matching, and Infrastructure Radar (Kazi)."
    ),
    version="2.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred."},
    )


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "AIP API is running",
        "version": "2.1.0",
        "features": ["petfel", "ein", "pipeline", "ic_governance", "matching", "radar"],
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy", "service": "aip-api"}


@app.get("/ping", tags=["Health"])
def ping():
    return {"pong": True}


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(investors_router)
app.include_router(introductions_router)
app.include_router(data_rooms_router)
app.include_router(deal_rooms_router)
app.include_router(analytics_router)
app.include_router(events_router)
app.include_router(verifications_router)
app.include_router(ai_router)
app.include_router(airtable_router)
# AIP v2 routers
app.include_router(petfel_router)
app.include_router(ein_router)
app.include_router(pipeline_router)
app.include_router(ic_router)
app.include_router(matching_router)
app.include_router(radar_router)
app.include_router(documents_router)

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
