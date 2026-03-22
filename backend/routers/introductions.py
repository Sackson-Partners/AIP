"""
AIP Introductions Router
-------------------------
Manages connections between investors and infrastructure projects.

Endpoints:
    GET  /api/introductions           - List introductions for current user
    POST /api/introductions           - Request or create an introduction
    PUT  /api/introductions/{id}      - Update introduction status
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Introduction, InfrastructureProject, Investor
from backend.security.auth import get_current_user
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/introductions", tags=["Introductions"])


class IntroductionCreate(BaseModel):
    project_id: str
    investor_id: Optional[str] = None
    notes: Optional[str] = None
    initiated_by: Optional[str] = "investor"


class IntroductionUpdate(BaseModel):
    status: str  # pending | active | completed | declined
    notes: Optional[str] = None


@router.get("")
async def list_introductions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all introductions associated with the current user."""
    introductions = (
        db.query(Introduction).filter(Introduction.user_id == current_user.id).all()
    )
    return {"introductions": introductions, "count": len(introductions)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_introduction(
    intro_in: IntroductionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request an introduction between an investor and a project."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == intro_in.project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    intro = Introduction(
        project_id=intro_in.project_id,
        investor_id=intro_in.investor_id,
        user_id=current_user.id,
        notes=intro_in.notes,
        initiated_by=intro_in.initiated_by,
    )
    db.add(intro)
    db.commit()
    db.refresh(intro)
    return intro


@router.put("/{intro_id}")
async def update_introduction(
    intro_id: str,
    update: IntroductionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the status of an introduction."""
    intro = db.query(Introduction).filter(Introduction.id == intro_id).first()
    if not intro:
        raise HTTPException(status_code=404, detail="Introduction not found.")
    intro.status = update.status
    if update.notes:
        intro.notes = update.notes
    db.commit()
    db.refresh(intro)
    return intro
