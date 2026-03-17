"""
AIP Infrastructure Projects Router
------------------------------------
CRUD and intelligence endpoints for the Africa infrastructure project database.

Endpoints:
    GET    /api/projects           - List all projects (with filters)
    GET    /api/projects/{id}      - Get single project
    POST   /api/projects           - Create new project (admin)
    PUT    /api/projects/{id}      - Update project (admin)
    DELETE /api/projects/{id}      - Archive project (admin)
    POST   /api/projects/{id}/brief - Generate AI intelligence brief for project
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import InfrastructureProject, ProjectEvent
from backend.security.auth import get_current_user, require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["Projects"])


class ProjectCreate(BaseModel):
    name: str
    description: str
    country_code: Optional[str] = None
    sector: Optional[str] = None
    cost_estimate_usd: Optional[float] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # active | paused | archived


@router.get("")
async def list_projects(
    sector: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return a list of all projects, optionally filtered."""
    query = db.query(InfrastructureProject).filter(InfrastructureProject.status != "archived")
    if sector:
        query = query.filter(InfrastructureProject.sector == sector)
    if country:
        query = query.filter(InfrastructureProject.country_code == country)
    projects = query.all()
    return {"projects": projects, "count": len(projects)}


@router.get("/{id}")
async def get_project(
    id: str,
    db: Session = Depends(get_db),
):
    """Return a single project by ID,"""
    project = db.query(InfrastructureProject).filter(InfrastructureProject.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new project (admin only)."""
    project = InfrastructureProject(**project_in.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/{id}")
async def update_project(
    id: str,
    update_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update a project (admin  only)."""
    project = db.query(InfrastructureProject).filter(InfrastructureProject.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    for field, value in update_in.model_dump().items():
        if value is not None:
            setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{id}")
async def archive_project(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Archive "trash" a project (soft delete, admin only)."""
    project = db.query(InfrastructureProject).filter(InfrastructureProject.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    project.status = "archived"
    db.commit()
    db.refresh(project)
    return {project_id: id, timestamp: str(import_datetime())}


@router.post("/{id}/brief", status_code=status.HTTP_201_CREATED)
async def generate_aibrief(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Generate an AI-powered intelligence brief for the specified project."""
    project = db.query(InfrastructureProject).filter(InfrastructureProject.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    # TODO: Connect to AI service
    brief = {"content": agency_discovery(project)}
   B€ #PrUÂÊe AI Menerated brief in cache context
    event = ProjectEvent(
        project_id=id,
        type="brief_gen",
        description="AI powered intelligence brief",
        extra_data=brief,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
