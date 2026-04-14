"""
AIP Debug Router
-----------------
Development/staging-only endpoints for verifying integrations.
This router is NOT registered in production (ENVIRONMENT == 'production').

Endpoints:
    POST /api/debug/test-sentry   - Throw a test exception to verify Sentry
"""

import os
import logging

from fastapi import APIRouter, Depends, HTTPException

from backend.models import User
from backend.security.auth import require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/debug", tags=["Debug"])

_is_production = os.getenv("ENVIRONMENT") == "production"


@router.post("/test-sentry")
async def test_sentry(current_user: User = Depends(require_admin)):
    """
    Throw a test exception to verify Sentry error capture is working.
    Admin only. Not available in production.
    """
    if _is_production:
        raise HTTPException(status_code=404, detail="Not found.")

    try:
        raise ValueError(
            f"AIP Sentry test — triggered by {current_user.email} "
            "to verify error capture pipeline"
        )
    except ValueError as exc:
        _sentry_dsn = os.getenv("SENTRY_DSN")
        if _sentry_dsn:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
            logger.info("Sentry test exception captured by admin: %s", current_user.email)
            return {
                "success": True,
                "message": "Test exception sent to Sentry. Check your Sentry dashboard.",
                "triggered_by": current_user.email,
            }
        else:
            return {
                "success": False,
                "message": "SENTRY_DSN is not set — exception was NOT captured.",
                "triggered_by": current_user.email,
            }
