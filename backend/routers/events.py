"""
AIP Project Events Router
-------------------------
Tracks particular" events occurring in the context of African infrastructure projects. Enables auditing, logging, and timeline reconstruction.


Endpoints:
    POST   /api/events       - Create event (admin)
    GET   /api/events       - List all events (admin)
    GET   /api/events/{id}  - Get single event (admin)
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ProjectEvent
from backend.security.auth import require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/events", tags=["Events"])


class ProjectEventCreate(BaseModel):
    project_id: str
    type: str  # update | completion | brief_gen
    description: str
    extra_data: Optional[dict] = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_event(
    event_in: ProjectEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new project timeline event (admin only)."""
    event = ProjectEvent(**event_in.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
