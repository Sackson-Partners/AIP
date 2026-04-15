"""AIP Platform - FastAPI Backend (Africa Infrastructure Projects)"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import uuid as _uuid_module
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from sqlalchemy import text as _sa_text
from backend.database import engine
from backend.database import Base
from backend.security.auth import limiter
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
from backend.routers.notifications import router as notifications_router
from backend.routers.users import router as users_router
from backend.routers.debug import router as debug_router
from backend.middleware.security_headers import SecurityHeadersMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("aip")

# ── Sentry — initialise only when DSN is present ─────────────────────────────
_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.getenv("ENVIRONMENT", "production"),
        release=os.getenv("APP_VERSION", "aip@1.0.0"),
        traces_sample_rate=1.0,
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )
    logger.info("Sentry initialised (env=%s)", os.getenv("ENVIRONMENT", "production"))



@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AIP API starting up")
    logger.info("Database: skipping create_all (managed by Alembic migrations)")
    yield
    logger.info("AIP API shutting down")


def _get_cors_origins():
    env_origins = [
        o.strip()
        for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if o.strip()
    ]
    defaults = ["https://www.app.africa-infra.com", "https://www.africa-infra.com", "http://localhost:3000"]
    origins = list(dict.fromkeys(env_origins + defaults))
    if os.getenv("ENVIRONMENT") == "production":
        assert env_origins, (
            "ALLOWED_ORIGINS must be set in production — refusing to start with default origins only"
        )
    return origins


_is_production = os.getenv("ENVIRONMENT") == "production"
_is_staging = os.getenv("ENVIRONMENT") == "staging"

# Docs config: off in production, HTTP-Basic-protected in staging, open in development
_docs_url   = None if _is_production else "/docs"
_redoc_url  = None if _is_production else "/redoc"
_openapi_url = None if _is_production else "/openapi.json"

app = FastAPI(
    redirect_slashes=False,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
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

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    # Origin and X-Requested-With removed — they are CSRF-enabling headers
    # and must not be allowed when credentials=True
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# ── Staging: protect /docs and /redoc with HTTP Basic Auth ───────────────────
if _is_staging:
    import base64

    _STAGING_DOCS_USER = os.getenv("STAGING_DOCS_USER", "aip")
    _STAGING_DOCS_PASS = os.getenv("STAGING_DOCS_PASS", "")

    @app.middleware("http")
    async def staging_docs_auth(request: Request, call_next):
        if request.url.path in ("/docs", "/redoc", "/openapi.json"):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Basic "):
                return Response(
                    status_code=401,
                    headers={"WWW-Authenticate": 'Basic realm="AIP Staging Docs"'},
                    content="Unauthorized",
                )
            try:
                decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
                user, password = decoded.split(":", 1)
                if user != _STAGING_DOCS_USER or password != _STAGING_DOCS_PASS:
                    raise ValueError("wrong credentials")
            except Exception:
                return Response(
                    status_code=401,
                    headers={"WWW-Authenticate": 'Basic realm="AIP Staging Docs"'},
                    content="Unauthorized",
                )
        return await call_next(request)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if _sentry_dsn:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
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


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Attach a unique X-Request-ID to every response for log correlation."""
    request_id = str(_uuid_module.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log each request with method, path, status code, and duration."""
    import time
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    logger.info(
        "%s %s %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Structured health check with connectivity probes.
    Returns 200 (healthy), 200 with degraded checks, or 503 on hard failures.
    """
    from datetime import datetime, timezone
    checks: dict[str, str] = {}
    overall = "healthy"

    # Database check
    try:
        from backend.database import engine
        with engine.connect() as conn:
            conn.execute(_sa_text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        logger.warning("Health check — database error: %s", exc)
        checks["database"] = "error"
        overall = "degraded"

    # Supabase connectivity check (lightweight, non-blocking)
    _supabase_url = os.getenv("SUPABASE_URL", "")
    if _supabase_url:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{_supabase_url}/rest/v1/")
            checks["supabase"] = "ok" if resp.status_code < 500 else "error"
        except Exception:
            checks["supabase"] = "error"
            overall = "degraded"
    else:
        checks["supabase"] = "not_configured"

    # Azure Blob Storage check
    _azure_conn = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
    if _azure_conn:
        try:
            from azure.storage.blob import BlobServiceClient
            svc = BlobServiceClient.from_connection_string(_azure_conn)
            list(svc.list_containers(max_results=1))
            checks["storage"] = "ok"
        except Exception:
            checks["storage"] = "error"
            overall = "degraded"
    else:
        checks["storage"] = "not_configured"

    payload = {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }
    status_code = 503 if overall == "unhealthy" else 200
    return JSONResponse(content=payload, status_code=status_code)


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
app.include_router(notifications_router)
# Debug router: only active outside production
if not _is_production:
    app.include_router(debug_router)

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
