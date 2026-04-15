"""
AIP Infrastructure Projects Router
------------------------------------
CRUD and intelligence endpoints for the Africa infrastructure project database.

Endpoints:
    GET    /api/projects              - List all projects (with filters)
    GET    /api/projects/{id}         - Get single project
    POST   /api/projects              - Create new project (analyst or admin)
    PUT    /api/projects/{id}         - Update project (analyst or admin)
    DELETE /api/projects/{id}         - Delete project (analyst or admin)
    POST   /api/projects/{id}/brief   - Generate AI intelligence brief
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import InfrastructureProject
from backend.security.auth import get_current_user, limiter, require_admin, require_analyst
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["Infrastructure Projects"])


def _safe_json(value: Optional[str]) -> list:
    """Parse a JSON string field, returning [] on missing or malformed input."""
    if not value:
        return []
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return []


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    project_name: str = Field(..., min_length=1, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    sector: Optional[str] = Field(None, max_length=100)
    project_type: Optional[str] = Field(None, max_length=100)
    estimated_cost: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field("planned", max_length=50)
    investors: Optional[list[str]] = None
    developers: Optional[list[str]] = None
    description: Optional[str] = Field(None, max_length=5000)
    strategic_notes: Optional[str] = Field(None, max_length=5000)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    source_url: Optional[str] = Field(None, max_length=500)


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
    current_user: User = Depends(get_current_user),
):
    """List infrastructure projects with optional filtering."""
    try:
        query = db.query(InfrastructureProject)
        if country:
            # Prefix search (no leading wildcard) so a B-tree index on `country` can be used.
            # Leading wildcards (%term%) prevent index usage and cause full table scans.
            query = query.filter(
                InfrastructureProject.country.ilike(f"{country}%")
            )
        if sector:
            # Exact sector values are short enumerations — prefix search is sufficient.
            query = query.filter(
                InfrastructureProject.sector.ilike(f"{sector}%")
            )
        if status:
            query = query.filter(
                InfrastructureProject.status == status
            )
        if region:
            query = query.filter(
                InfrastructureProject.region.ilike(f"{region}%")
            )
        projects = query.offset(offset).limit(limit).all()
        return [
            ProjectResponse(
                **{
                    c.key: getattr(p, c.key)
                    for c in p.__table__.columns
                    if c.key not in ("investors", "developers")
                },
                has_ai_brief=bool(p.ai_brief),
            )
            for p in projects
        ]
    except Exception as e:
        logger.error("Failed to list projects: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while listing projects.",
        )


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full details for a single project including AI brief if available."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    return project


@limiter.limit("30/minute")
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    request: Request,
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
            detail="An unexpected error occurred while creating the project.",
        )


@limiter.limit("30/minute")
@router.put("/{project_id}")
async def update_project(
    request: Request,
    project_id: str,
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Update an existing infrastructure project (analyst or admin)."""
    try:
        project = db.query(InfrastructureProject).filter(
            InfrastructureProject.id == project_id
        ).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found.",
            )
        for k, v in project_in.model_dump(exclude_unset=True).items():
            if k in ("investors", "developers"):
                setattr(project, k, json.dumps(v or []))
            else:
                setattr(project, k, v)
        db.commit()
        db.refresh(project)
        logger.info(
            "Project updated: %s by %s (role: %s)",
            project.project_name,
            current_user.email,
            current_user.role,
        )
        return project

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "Failed to update project %s. Error: %s",
            project_id,
            str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating the project.",
        )


@limiter.limit("30/minute")
@router.patch("/{project_id}")
async def patch_project(
    request: Request,
    project_id: str,
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Partially update an existing infrastructure project (analyst or admin)."""
    return await update_project(
        request=request,
        project_id=project_id,
        project_in=project_in,
        db=db,
        current_user=current_user,
    )


@limiter.limit("10/minute")
@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    request: Request,
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst),
):
    """Delete an infrastructure project (analyst or admin)."""
    try:
        project = db.query(InfrastructureProject).filter(
            InfrastructureProject.id == project_id
        ).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found.",
            )
        db.delete(project)
        db.commit()
        logger.info(
            "Project deleted: %s by %s (role: %s)",
            project_id,
            current_user.email,
            current_user.role,
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "Failed to delete project %s. Error: %s",
            project_id,
            str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting the project.",
        )


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
    from backend.services.claude_service import (
        call_claude_structured,
        INFRASTRUCTURE_ANALYST_SYSTEM,
    )
    from backend.services.prompt_service import build_prompt
    from datetime import datetime, timezone
    import json as _json

    try:
        project = db.query(InfrastructureProject).filter(
            InfrastructureProject.id == project_id
        ).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found.",
            )

        project_data = {
            "project_name":   project.project_name,
            "country":        project.country,
            "region":         project.region,
            "sector":         project.sector,
            "estimated_cost": project.estimated_cost,
            "status":         project.status,
            "investors":      _safe_json(project.investors),
            "developers":     _safe_json(project.developers),
            "description":    project.description,
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

        logger.info(
            "AI brief generated for project: %s by %s",
            project_id,
            current_user.email,
        )

        return {
            "success": True,
            "project_id": project_id,
            "brief": brief,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            "Failed to generate brief for project %s. Error: %s",
            project_id,
            str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating the project brief.",
        )
