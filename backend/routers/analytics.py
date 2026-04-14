"""
AIP Analytics Router
---------------------
Platform usage and engagement analytics.

Endpoints:
    POST /api/analytics/track   - Track an analytics event
    GET  /api/analytics/summary - Summary stats (admin)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AnalyticsEvent
from backend.security.auth import get_current_user, require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

_MAX_METADATA_KEYS = 10
_MAX_METADATA_VALUE_LEN = 255


class TrackEvent(BaseModel):
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    metadata: Optional[dict] = None

    @field_validator("metadata")
    @classmethod
    def validate_metadata(cls, v: Optional[dict]) -> Optional[dict]:
        if v is None:
            return v
        if len(v) > _MAX_METADATA_KEYS:
            raise ValueError(
                f"metadata must not exceed {_MAX_METADATA_KEYS} keys"
            )
        for key, value in v.items():
            str_value = str(value)
            if len(str_value) > _MAX_METADATA_VALUE_LEN:
                raise ValueError(
                    f"metadata value for '{key}' exceeds {_MAX_METADATA_VALUE_LEN} characters"
                )
        return v


@router.post("/track", status_code=201)
async def track_event(
    event_in: TrackEvent,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Track a platform analytics event."""
    import json, hashlib

    # Hash the IP address — never store raw IPs
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]

    event = AnalyticsEvent(
        event_type=event_in.event_type,
        entity_type=event_in.entity_type,
        entity_id=event_in.entity_id,
        event_metadata=json.dumps(event_in.metadata) if event_in.metadata else None,
        ip_hash=ip_hash,
    )
    db.add(event)
    db.commit()
    return {"success": True}


@router.get("/summary")
async def analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Return aggregate analytics summary (admin only)."""
    from sqlalchemy import func

    total_events = db.query(AnalyticsEvent).count()
    by_type = (
        db.query(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id))
        .group_by(AnalyticsEvent.event_type)
        .all()
    )
    return {
        "total_events": total_events,
        "by_type": {event_type: count for event_type, count in by_type},
    }

@router.get("")
async def analytics_root(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy import func
    total = db.query(AnalyticsEvent).count()
    return {"total_events": total, "reports": []}
