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
from backend.models import ProjectEvent, User
from backend.security.auth import get_current_user, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/events", tags=["Project Events"])


class EventCreate(BaseModel):
    project_id:   str
    event_type:   str            # milestone | financing | tender | delay | completion
    title:        str
    description:  Optional[str] = None
    event_date:   Optional[datetime] = None
    source_url:   Optional[str] = None
    location:     Optional[str] = None
    is_public:    bool = True
    image_url:    Optional[str] = None
    max_attendees:Optional[int] = None


def _event_to_dict(e: ProjectEvent) -> dict:
    """Serialise a ProjectEvent with both native and frontend-aliased field names."""
    return {
        "id":           e.id,
        # Frontend-expected aliases
        "name":         e.title,
        "type":         e.event_type,
        # Original field names (backward compat)
        "title":        e.title,
        "event_type":   e.event_type,
        # Common fields
        "description":  e.description,
        "event_date":   e.event_date.isoformat() if e.event_date else None,
        "project_id":   e.project_id,
        "source_url":   e.source_url,
        "location":     e.location,
        "is_public":    e.is_public if e.is_public is not None else True,
        "image_url":    e.image_url,
        "max_attendees":e.max_attendees,
        "created_at":   e.created_at.isoformat() if e.created_at else None,
    }


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
    return {"events": [_event_to_dict(e) for e in events], "count": len(events)}


@router.get("/{event_id}")
async def get_event(event_id: str, db: Session = Depends(get_db)):
    """Return a single project event."""
    event = db.query(ProjectEvent).filter(ProjectEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    return _event_to_dict(event)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_event(
    event_in: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new project timeline event (admin only)."""
    event = ProjectEvent(
        **event_in.model_dump(),
        created_by=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_to_dict(event)
