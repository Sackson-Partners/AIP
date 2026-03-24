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
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AnalyticsEvent
from backend.security.auth import get_current_user, require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


class TrackEvent(BaseModel):
    event_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    metadata: Optional[dict] = None


@router.get("/")
async def list_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List analytics reports (returns summary stats for the current user)."""
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
        "reports": [],
    }


@router.post("/track", status_code=201)
async def track_event(
    event_in: TrackEvent,
    request: Request,
    db: Session = Depends(get_db),
):
    """Track a platform analytics event (no authentication required)."""
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
