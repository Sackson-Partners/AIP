"""
AIP Executive Investment Notes (EIN) Router
=============================================
Manages the full lifecycle of investor-grade EINs:
  Create → Draft → AI Generate → Review → Approve → Export

Endpoints:
    POST /api/ein/{project_id}               Create new EIN
    GET  /api/ein/{project_id}               Latest approved EIN
    PUT  /api/ein/{ein_id}/section/{code}    Update section content
    POST /api/ein/{ein_id}/ai-generate       AI-generate all 9 sections
    POST /api/ein/{ein_id}/approve           Approve EIN for investor distribution
    GET  /api/ein/{ein_id}/export            Full EIN in structured JSON
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    InfrastructureProject,
    ExecutiveNote,
    EINSection,
    PetfelAssessment,
    User,
)
from backend.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ein", tags=["Executive Investment Notes"])

# ---------------------------------------------------------------------------
# EIN Section Definitions (9 sections, codes 0–8)
# ---------------------------------------------------------------------------

EIN_SECTIONS = [
    (0, "Cover & Executive Summary"),
    (1, "Strategy Perspective"),
    (2, "Political Perspective"),
    (3, "Economic Perspective"),
    (4, "Financial Perspective"),
    (5, "Legal & Regulatory Perspective"),
    (6, "Risk Register & Mitigation Plan"),
    (7, "Required Next Steps (30/60/90 Days)"),
    (8, "Annexes"),
]


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class EINCreateRequest(BaseModel):
    recommendation:    Optional[str] = None   # go | hold | no_go
    executive_summary: Optional[str] = None
    key_gaps:          Optional[str] = None
    next_steps:        Optional[str] = None


class SectionUpdateRequest(BaseModel):
    content:      str
    generated_by: Optional[str] = "analyst"  # ai | analyst | hybrid


class EINResponse(BaseModel):
    id:                str
    project_id:        str
    title:             Optional[str]
    version:           int
    status:            str
    recommendation:    Optional[str]
    executive_summary: Optional[str]
    petfel_score:      Optional[float]
    red_flags_count:   int
    export_ready:      bool
    created_at:        datetime
    section_count:     int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_project_or_404(project_id: str, db: Session) -> InfrastructureProject:
    proj = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


def _get_ein_or_404(ein_id: str, db: Session) -> ExecutiveNote:
    ein = db.query(ExecutiveNote).filter(ExecutiveNote.id == ein_id).first()
    if not ein:
        raise HTTPException(status_code=404, detail="EIN not found")
    return ein


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/{project_id}", response_model=EINResponse, status_code=201)
async def create_ein(
    project_id:   str,
    payload:      EINCreateRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Create a new Executive Investment Note for a project."""
    project = _get_project_or_404(project_id, db)

    # Get latest PETFEL score to pre-populate
    latest_petfel = (
        db.query(PetfelAssessment)
        .filter(PetfelAssessment.project_id == project_id)
        .order_by(PetfelAssessment.version.desc())
        .first()
    )

    # Version increment
    version = (
        db.query(ExecutiveNote)
        .filter(ExecutiveNote.project_id == project_id)
        .count()
        + 1
    )

    petfel_score  = float(latest_petfel.overall_score) if latest_petfel and latest_petfel.overall_score else None
    red_flags_count = 0
    if latest_petfel:
        from backend.models import PetfelFlag
        red_flags_count = db.query(PetfelFlag).filter(
            PetfelFlag.assessment_id == latest_petfel.id,
            PetfelFlag.is_resolved   == False,  # noqa: E712
        ).count()

    ein = ExecutiveNote(
        project_id        = project_id,
        title             = f"{project.project_name} — EIN v{version}",
        version           = version,
        status            = "draft",
        author_id         = current_user.id,
        recommendation    = payload.recommendation,
        executive_summary = payload.executive_summary,
        key_gaps          = payload.key_gaps,
        next_steps        = payload.next_steps,
        petfel_score      = petfel_score,
        red_flags_count   = red_flags_count,
    )
    db.add(ein)
    db.flush()

    # Create empty section stubs
    for code, name in EIN_SECTIONS:
        section = EINSection(
            ein_id       = ein.id,
            section_code = code,
            section_name = name,
            content      = "",
            generated_by = "analyst",
        )
        db.add(section)

    db.commit()
    db.refresh(ein)
    logger.info("EIN created | project=%s version=%s", project_id, version)

    return EINResponse(
        id                = ein.id,
        project_id        = ein.project_id,
        title             = ein.title,
        version           = ein.version,
        status            = ein.status,
        recommendation    = ein.recommendation,
        executive_summary = ein.executive_summary,
        petfel_score      = petfel_score,
        red_flags_count   = ein.red_flags_count,
        export_ready      = ein.export_ready,
        created_at        = ein.created_at,
        section_count     = len(EIN_SECTIONS),
    )


@router.get("/{project_id}", response_model=EINResponse)
async def get_latest_ein(
    project_id:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return the latest EIN for a project."""
    _get_project_or_404(project_id, db)
    ein = (
        db.query(ExecutiveNote)
        .filter(ExecutiveNote.project_id == project_id)
        .order_by(ExecutiveNote.version.desc())
        .first()
    )
    if not ein:
        raise HTTPException(status_code=404, detail="No EIN found for this project")

    section_count = db.query(EINSection).filter(EINSection.ein_id == ein.id).count()
    return EINResponse(
        id                = ein.id,
        project_id        = ein.project_id,
        title             = ein.title,
        version           = ein.version,
        status            = ein.status,
        recommendation    = ein.recommendation,
        executive_summary = ein.executive_summary,
        petfel_score      = float(ein.petfel_score) if ein.petfel_score else None,
        red_flags_count   = ein.red_flags_count or 0,
        export_ready      = ein.export_ready,
        created_at        = ein.created_at,
        section_count     = section_count,
    )


@router.put("/{ein_id}/section/{code}")
async def update_section(
    ein_id:       str,
    code:         int,
    payload:      SectionUpdateRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Update content of a specific EIN section."""
    _get_ein_or_404(ein_id, db)
    section = db.query(EINSection).filter(
        EINSection.ein_id       == ein_id,
        EINSection.section_code == code,
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail=f"Section {code} not found")

    section.content      = payload.content
    section.generated_by = payload.generated_by
    section.updated_at   = datetime.now(timezone.utc)
    db.commit()
    return {"status": "updated", "ein_id": ein_id, "section_code": code}


@router.post("/{ein_id}/ai-generate")
async def ai_generate_ein(
    ein_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    AI-generate all 9 EIN sections using Claude.
    Uses project data + PETFEL scores as context.
    """
    from backend.services.aip_claude_service import generate_ein_sections

    ein     = _get_ein_or_404(ein_id, db)
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == ein.project_id
    ).first()
    petfel = (
        db.query(PetfelAssessment)
        .filter(PetfelAssessment.project_id == ein.project_id)
        .order_by(PetfelAssessment.version.desc())
        .first()
    )

    project_context = {
        "project_name":  project.project_name,
        "country":       project.country,
        "sector":        project.sector,
        "project_type":  project.project_type,
        "estimated_cost":project.estimated_cost,
        "description":   project.description,
        "status":        project.status,
    }
    petfel_context = {
        "overall_score": float(petfel.overall_score) if petfel and petfel.overall_score else None,
        "rating":        petfel.rating if petfel else None,
        "gating_result": petfel.gating_result if petfel else None,
        "recommendation":petfel.recommendation if petfel else None,
    }

    generated = await generate_ein_sections(project_context, petfel_context)

    # Persist generated sections
    for code, name in EIN_SECTIONS:
        key = f"section_{code}"
        content = generated.get(key, "")
        section = db.query(EINSection).filter(
            EINSection.ein_id       == ein_id,
            EINSection.section_code == code,
        ).first()
        if section:
            section.content      = content
            section.generated_by = "ai"
            section.updated_at   = datetime.now(timezone.utc)

    # Update executive summary from section 0
    if generated.get("section_0"):
        ein.executive_summary = generated["section_0"]

    db.commit()
    logger.info("AI-generated EIN sections | ein_id=%s", ein_id)
    return {"status": "generated", "ein_id": ein_id, "sections_generated": len(EIN_SECTIONS)}


@router.post("/{ein_id}/approve")
async def approve_ein(
    ein_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Approve EIN and mark as export-ready for investor distribution."""
    ein = _get_ein_or_404(ein_id, db)
    if ein.status == "approved":
        return {"status": "already_approved", "ein_id": ein_id}

    ein.status       = "approved"
    ein.export_ready = True
    ein.updated_at   = datetime.now(timezone.utc)
    db.commit()
    logger.info("EIN approved | ein_id=%s", ein_id)
    return {"status": "approved", "ein_id": ein_id, "export_ready": True}


@router.get("/{ein_id}/export")
async def export_ein(
    ein_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Export full EIN with all 9 sections as structured JSON."""
    ein      = _get_ein_or_404(ein_id, db)
    project  = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == ein.project_id
    ).first()
    sections = db.query(EINSection).filter(
        EINSection.ein_id == ein_id
    ).order_by(EINSection.section_code).all()

    return {
        "ein": {
            "id":              ein.id,
            "title":           ein.title,
            "version":         ein.version,
            "status":          ein.status,
            "recommendation":  ein.recommendation,
            "petfel_score":    float(ein.petfel_score) if ein.petfel_score else None,
            "red_flags_count": ein.red_flags_count,
            "export_ready":    ein.export_ready,
            "created_at":      str(ein.created_at),
        },
        "project": {
            "id":           project.id,
            "name":         project.project_name,
            "country":      project.country,
            "sector":       project.sector,
            "project_type": project.project_type,
            "cost":         project.estimated_cost,
        },
        "sections": [
            {
                "code":         s.section_code,
                "name":         s.section_name,
                "content":      s.content,
                "generated_by": s.generated_by,
            }
            for s in sections
        ],
    }
