"""
backend/app/main.py
Secondary app entry – legacy path kept for backward compatibility.
Production entry point is backend/main.py
"""
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

from backend.database import engine, Base
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
from backend.routers.petfel import router as petfel_router
from backend.routers.ein import router as ein_router
from backend.routers.pipeline import router as pipeline_router
from backend.routers.ic import router as ic_router
from backend.routers.ai import router as ai_router
from backend.routers.matching import router as matching_router
from backend.routers.documents import router as documents_router
from backend.routers.users import router as users_router
from backend.routers.radar import router as radar_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("aip")

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info("AIP API starting up")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("SQLite tables created/verified")
    except Exception as exc:
        logger.warning("DB init skipped (race or schema issue): %s", exc)
    yield
    logger.info("AIP API shutting down")


app = FastAPI(
    title="AIP Platform API",
    version="2.0.0",
    description="Africa Infrastructure Platform – backend API",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────
_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://www.app.africa-infra.com,https://www.africa-infra.com")
origins = [o.strip() for o in _raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────────────────────
_static = Path(__file__).parent.parent / "static"
if _static.exists():
    app.mount("/static", StaticFiles(directory=str(_static)), name="static")

# ── Routers ───────────────────────────────────────────────────────────────
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
app.include_router(petfel_router)
app.include_router(ein_router)
app.include_router(pipeline_router)
app.include_router(ic_router)
app.include_router(matching_router)
app.include_router(radar_router)
app.include_router(documents_router)


# ── Core endpoints ────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "healthy", "service": "aip-api"}


@app.get("/", tags=["system"])
async def root():
    return {"message": "AIP Platform API", "docs": "/docs", "health": "/health"}
