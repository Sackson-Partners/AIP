"""
AIP Executive Investment Notes (EIN) Router
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


@router.get("/templates")
async def get_ein_templates(current_user: User = Depends(get_current_user)):
    """Return the 9 EIN section templates with objectives and guidance."""
    templates = [
        {
            "code": 0,
            "name": "Cover & Executive Summary",
            "objective": "Provide a high-level overview of the opportunity for senior decision-makers.",
            "key_questions": [
                "What is the recommended decision (go / hold / no-go)?",
                "What is the headline PETFEL score and rating?",
                "What are the 3 most material risks?",
            ],
            "output_guidance": "1–2 pages max. Lead with the recommendation and PETFEL score. Summarise sector, country, cost, and timeline.",
        },
        {
            "code": 1,
            "name": "Strategy Perspective",
            "objective": "Assess alignment with the fund's investment thesis and strategic priorities.",
            "key_questions": [
                "Does this project align with the fund's sector and geography mandates?",
                "What is the fund's competitive advantage in this deal?",
                "How does this fit within portfolio construction strategy?",
            ],
            "output_guidance": "Reference specific fund strategy documents. Identify any mandate extension required.",
        },
        {
            "code": 2,
            "name": "Political Perspective",
            "objective": "Evaluate political risk, sponsor credibility, and stakeholder dynamics.",
            "key_questions": [
                "Is there a clear legal mandate and government authorization?",
                "What is the sponsor's track record in similar projects?",
                "Are there unresolved stakeholder conflicts?",
            ],
            "output_guidance": "Include political risk rating. Map key political actors and their positions.",
        },
        {
            "code": 3,
            "name": "Economic Perspective",
            "objective": "Assess demand fundamentals, affordability, and macroeconomic exposure.",
            "key_questions": [
                "Is demand validated with credible data?",
                "Are tariffs or user fees economically realistic?",
                "What is the FX and macro exposure?",
            ],
            "output_guidance": "Reference independent demand studies where available. Quantify FX risk.",
        },
        {
            "code": 4,
            "name": "Financial Perspective",
            "objective": "Evaluate CAPEX/OPEX realism, revenue model, and bankability.",
            "key_questions": [
                "Are cost estimates independently verified?",
                "Is the revenue model and offtaker credit credible?",
                "Does the financing plan demonstrate bankability?",
            ],
            "output_guidance": "Include IRR, NPV, and DSCR ranges from the financial model. Note key sensitivities.",
        },
        {
            "code": 5,
            "name": "Legal & Regulatory Perspective",
            "objective": "Assess the legal framework, permits, land rights, and enforceability.",
            "key_questions": [
                "Is the PPP/concession framework fit for purpose?",
                "What is the status of all required permits?",
                "Are land titles clear and enforceable?",
            ],
            "output_guidance": "List all permits with status. Flag any unresolved legal impediments.",
        },
        {
            "code": 6,
            "name": "Risk Register & Mitigation Plan",
            "objective": "Identify, rate, and assign mitigants to all material project risks.",
            "key_questions": [
                "What are the top 5 risks by severity?",
                "Are credible mitigants in place for each critical risk?",
                "Are any risks unmitigated red flags?",
            ],
            "output_guidance": "Use a structured table: Risk | Probability | Impact | Mitigation | Owner. Flag PETFEL red flags explicitly.",
        },
        {
            "code": 7,
            "name": "Required Next Steps (30/60/90 Days)",
            "objective": "Define the specific actions required before investment committee.",
            "key_questions": [
                "What are the 30-day priority actions?",
                "What third-party reports are outstanding?",
                "What conditions must be satisfied before final commitment?",
            ],
            "output_guidance": "Format as a clear action plan with owners and deadlines. Distinguish deal-breakers from nice-to-haves.",
        },
        {
            "code": 8,
            "name": "Annexes",
            "objective": "Attach supporting documents, data sources, and reference materials.",
            "key_questions": [
                "What source documents underpin the analysis?",
                "Are all referenced reports accessible to the IC?",
            ],
            "output_guidance": "List documents with titles, dates, and sources. Include financial model version reference.",
        },
    ]
    return templates


@router.get("/note/{ein_id}")
async def get_ein_by_id(
    ein_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Get a specific EIN by its own ID (not project ID)."""
    ein = _get_ein_or_404(ein_id, db)
    sections = db.query(EINSection).filter(
        EINSection.ein_id == ein_id
    ).order_by(EINSection.section_code).all()
    return {
        "id":                ein.id,
        "project_id":        ein.project_id,
        "title":             ein.title,
        "version":           ein.version,
        "status":            ein.status,
        "recommendation":    ein.recommendation,
        "executive_summary": ein.executive_summary,
        "key_gaps":          ein.key_gaps,
        "next_steps":        ein.next_steps,
        "petfel_score":      float(ein.petfel_score) if ein.petfel_score else None,
        "red_flags_count":   ein.red_flags_count or 0,
        "export_ready":      ein.export_ready,
        "created_at":        str(ein.created_at),
        "sections": [
            {
                "id":           s.id,
                "section_code": s.section_code,
                "section_name": s.section_name,
                "content":      s.content,
                "generated_by": s.generated_by,
                "is_reviewed":  s.is_reviewed,
                "updated_at":   str(s.updated_at) if s.updated_at else None,
            }
            for s in sections
        ],
    }


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


@router.put("/{ein_id}/summary")
async def update_ein_summary(
    ein_id:       str,
    payload:      dict,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Update executive summary, recommendation, key gaps and next steps."""
    ein = _get_ein_or_404(ein_id, db)
    if "executive_summary" in payload:
        ein.executive_summary = payload["executive_summary"]
    if "recommendation" in payload:
        ein.recommendation = payload["recommendation"]
    if "key_gaps" in payload:
        ein.key_gaps = payload["key_gaps"]
    if "next_steps" in payload:
        ein.next_steps = payload["next_steps"]
    ein.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "updated", "ein_id": ein_id}


@router.post("/{ein_id}/submit")
async def submit_ein(
    ein_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Submit the EIN for review / approval."""
    ein = _get_ein_or_404(ein_id, db)
    if ein.status != "draft":
        return {"status": ein.status, "ein_id": ein_id, "message": "Already submitted"}
    ein.status     = "submitted"
    ein.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("EIN submitted | ein_id=%s by %s", ein_id, current_user.email)
    return {"status": "submitted", "ein_id": ein_id}


@router.post("/{ein_id}/section/{code}/review")
async def review_section(
    ein_id:       str,
    code:         int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Mark a specific EIN section as analyst-reviewed."""
    _get_ein_or_404(ein_id, db)
    section = db.query(EINSection).filter(
        EINSection.ein_id       == ein_id,
        EINSection.section_code == code,
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail=f"Section {code} not found")
    section.is_reviewed = True
    section.updated_at  = datetime.now(timezone.utc)
    db.commit()
    return {"status": "reviewed", "ein_id": ein_id, "section_code": code}


@router.post("/{ein_id}/send")
async def mark_ein_sent(
    ein_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Mark an approved EIN as sent to investors."""
    ein = _get_ein_or_404(ein_id, db)
    ein.status     = "sent"
    ein.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("EIN marked sent | ein_id=%s by %s", ein_id, current_user.email)
    return {"status": "sent", "ein_id": ein_id}


@router.get("/{ein_id}/validate")
async def validate_ein(
    ein_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Validate EIN completeness before submission or export."""
    ein      = _get_ein_or_404(ein_id, db)
    sections = db.query(EINSection).filter(EINSection.ein_id == ein_id).all()
    issues   = []
    if not ein.executive_summary:
        issues.append("Executive summary is empty")
    if not ein.recommendation:
        issues.append("Recommendation (go/hold/no-go) is not set")
    empty_sections = [s.section_name for s in sections if not s.content]
    if empty_sections:
        issues.append(f"Sections with no content: {', '.join(empty_sections)}")
    return {"is_valid": len(issues) == 0, "issues": issues, "ein_id": ein_id}


# ── Root route fix ─────────────────────────────────────
@router.get("", tags=["EIN"])
async def ein_root(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List all Executive Investment Notes."""
    from backend.models import ExecutiveNote
    notes = db.query(ExecutiveNote).limit(50).all()
    return {"notes": notes, "count": len(notes)}


@router.get("", tags=["Executive Investment Notes"])
async def ein_root(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List all Executive Investment Notes."""
    from backend.models import ExecutiveNote
    try:
        notes = db.query(ExecutiveNote).limit(50).all()
        return {"notes": [{"id": str(n.id)} for n in notes], "count": len(notes)}
    except Exception as e:
        return {"notes": [], "count": 0, "note": str(e)}
