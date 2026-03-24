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
from backend.models import InfrastructureProject
from backend.security.auth import get_current_user, require_admin, require_analyst
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["Infrastructure Projects"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    project_name: str
    country: Optional[str] = None
    region: Optional[str] = None
    sector: Optional[str] = None
    project_type: Optional[str] = None
    estimated_cost: Optional[str] = None
    status: Optional[str] = "planned"
    investors: Optional[list[str]] = None
    developers: Optional[list[str]] = None
    description: Optional[str] = None
    strategic_notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_url: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    project_name: str
    country: Optional[str]
    region: Optional[str]
    sector: Optional[str]
    project_type: Optional[str]
    estimated_cost: Optional[str]
    status: Optional[str]
    description: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    has_ai_brief: bool

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    country: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """List infrastructure projects with optional filtering."""
    query = db.query(InfrastructureProject)
    if country:
        query = query.filter(InfrastructureProject.country.ilike(f"%{country}%"))
    if sector:
        query = query.filter(InfrastructureProject.sector.ilike(f"%{sector}%"))
    if status:
        query = query.filter(InfrastructureProject.status == status)
    if region:
        query = query.filter(InfrastructureProject.region.ilike(f"%{region}%"))
    projects = query.offset(offset).limit(limit).all()
    return [
        ProjectResponse(
            **{c.key: getattr(p, c.key) for c in p.__table__.columns if c.key != "investors"},
            has_ai_brief=bool(p.ai_brief),
        )
        for p in projects
    ]


@router.get("/{project_id}")
async def get_project(project_id: str, db: Session = Depends(get_db)):
    """Return full details for a single project including AI brief if available."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return project


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Create a new infrastructure project record (analyst or admin)."""
    try:
        project = InfrastructureProject(
            **{
                k: v
                for k, v in project_in.model_dump().items()
                if k not in ("investors", "developers")
            },
            investors=json.dumps(project_in.investors or []),
            developers=json.dumps(project_in.developers or []),
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        logger.info(
            "Project created: %s by %s (role: %s)",
            project.project_name,
            current_user.email,
            current_user.role,
        )
        return project

    except Exception as e:
        db.rollback()
        logger.error(
            "Failed to create project. User: %s Role: %s Error: %s",
            current_user.email,
            current_user.role,
            str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}",
        )


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Update an existing infrastructure project (analyst or admin)."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    for k, v in project_in.model_dump(exclude_unset=True).items():
        if k in ("investors", "developers"):
            setattr(project, k, json.dumps(v or []))
        else:
            setattr(project, k, v)
    db.commit()
    db.refresh(project)
    logger.info("Project updated: %s by %s", project.project_name, current_user.email)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Delete an infrastructure project (analyst or admin)."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    db.delete(project)
    db.commit()
    logger.info("Project deleted: %s by %s", project_id, current_user.email)


@router.post("/{project_id}/brief")
async def generate_project_brief(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate or refresh the AI intelligence brief for a project.
    Caches the result on the project record for subsequent requests.
    """
    from backend.services.claude_service import call_claude_structured, INFRASTRUCTURE_ANALYST_SYSTEM
    from backend.services.prompt_service import build_prompt
    from datetime import datetime, timezone
    import json as _json

    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    project_data = {
        "project_name": project.project_name,
        "country": project.country,
        "region": project.region,
        "sector": project.sector,
        "estimated_cost": project.estimated_cost,
        "status": project.status,
        "investors": _json.loads(project.investors or "[]"),
        "developers": _json.loads(project.developers or "[]"),
        "description": project.description,
        "strategic_notes": project.strategic_notes,
    }

    populated_prompt = build_prompt(
        "infrastructure_project_analysis",
        {"project_data": _json.dumps(project_data, indent=2)},
    )
    brief = await call_claude_structured(
        prompt=populated_prompt,
        system_prompt=INFRASTRUCTURE_ANALYST_SYSTEM,
        max_tokens=2500,
    )

    project.ai_brief = brief
    project.ai_brief_generated_at = datetime.now(timezone.utc)
    db.commit()

    return {"success": True, "project_id": project_id, "brief": brief}
