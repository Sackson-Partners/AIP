"""
AIP Project Events Router
--------------------------
Timeline events and milestones for infrastructure projects.

Endpoints:
    GET  /api/events                - List events (with project filter)
    POST /api/events                - Create a project event (admin)
    GET  /api/events/{id}           - Get single event
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ProjectEvent
from backend.security.auth import get_current_user, require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/events", tags=["Project Events"])


class EventCreate(BaseModel):
    project_id: str
    event_type: str  # milestone | financing | tender | delay | completion
    title: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    source_url: Optional[str] = None


@router.get("")
async def list_events(
    project_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    """List project events with optional filtering."""
    query = db.query(ProjectEvent)
    if project_id:
        query = query.filter(ProjectEvent.project_id == project_id)
    if event_type:
        query = query.filter(ProjectEvent.event_type == event_type)
    events = query.order_by(ProjectEvent.event_date.desc()).limit(limit).all()
    return {"events": events, "count": len(events)}


@router.get("/{event_id}")
async def get_event(event_id: str, db: Session = Depends(get_db)):
    """Return a single project event."""
    event = db.query(ProjectEvent).filter(ProjectEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    return event


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_event(
    event_in: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new project timeline event (admin only)."""
    event = ProjectEvent(**event_in.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
