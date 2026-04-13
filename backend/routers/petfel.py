"""
AIP PETFEL Due Diligence Engine Router
Full 30-sub-criterion scoring engine across 6 pillars:
  Political | Economic | Technical | Financial | Environmental | Legal

Endpoints:
    POST /api/petfel/assess/{project_id}       Create new assessment
    GET  /api/petfel/{project_id}              Latest assessment + score
    PUT  /api/petfel/{assessment_id}           Update scores & evidence
    GET  /api/petfel/{assessment_id}/flags     List red flags
    POST /api/petfel/{assessment_id}/flags/{flag_id}/resolve  Resolve a flag
    POST /api/petfel/{assessment_id}/ai-augment  Claude augments qualitative scores
    GET  /api/petfel/{assessment_id}/scorecard   Full scorecard export
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
    PetfelAssessment,
    PetfelScore,
    PetfelFlag,
    User,
)
from backend.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/petfel", tags=["PETFEL DD Engine"])

# ---------------------------------------------------------------------------
# PETFEL Configuration — 30 sub-criteria
# ---------------------------------------------------------------------------

PETFEL_SUBCRITERIA = {
    "political": [
        {"code": "P1", "name": "Mandate / authorization clear",          "weight": 0.25},
        {"code": "P2", "name": "Sponsor credibility & capacity",         "weight": 0.20},
        {"code": "P3", "name": "Stakeholder alignment & governance",     "weight": 0.20},
        {"code": "P4", "name": "Policy stability / reversal risk",       "weight": 0.20},
        {"code": "P5", "name": "Social license / community acceptance",  "weight": 0.15},
    ],
    "economic": [
        {"code": "E1", "name": "Demand validation / need proof",         "weight": 0.25},
        {"code": "E2", "name": "Affordability & tariff realism",         "weight": 0.20},
        {"code": "E3", "name": "Competitive landscape / alternatives",   "weight": 0.15},
        {"code": "E4", "name": "Macro & FX exposure",                    "weight": 0.20},
        {"code": "E5", "name": "Local value chain & jobs",               "weight": 0.20},
    ],
    "technical": [
        {"code": "T1", "name": "Design maturity (pre-FS / FS)",          "weight": 0.25},
        {"code": "T2", "name": "Site readiness (land, access, utilities)","weight": 0.20},
        {"code": "T3", "name": "Technology risk & performance",          "weight": 0.20},
        {"code": "T4", "name": "Implementation plan & schedule realism", "weight": 0.20},
        {"code": "T5", "name": "O&M concept and lifecycle costs",        "weight": 0.15},
    ],
    "financial": [
        {"code": "F1", "name": "CAPEX / OPEX realism",                   "weight": 0.20},
        {"code": "F2", "name": "Revenue model credibility",              "weight": 0.20},
        {"code": "F3", "name": "Offtaker credit & payment security",     "weight": 0.25},
        {"code": "F4", "name": "Financing plan & bankability",           "weight": 0.20},
        {"code": "F5", "name": "Financial model maturity & sensitivities","weight": 0.15},
    ],
    "environmental": [
        {"code": "V1", "name": "E&S screening and EIA status",           "weight": 0.25},
        {"code": "V2", "name": "Land acquisition & resettlement plan",   "weight": 0.25},
        {"code": "V3", "name": "Biodiversity and critical habitats",     "weight": 0.15},
        {"code": "V4", "name": "Climate risk & resilience",              "weight": 0.15},
        {"code": "V5", "name": "HSE management capacity",               "weight": 0.20},
    ],
    "legal": [
        {"code": "L1", "name": "PPP / concession framework fit",         "weight": 0.20},
        {"code": "L2", "name": "Permits pathway and status",             "weight": 0.20},
        {"code": "L3", "name": "Land title and rights enforceability",   "weight": 0.25},
        {"code": "L4", "name": "Contract enforceability & security package","weight": 0.20},
        {"code": "L5", "name": "Dispute resolution / arbitration",       "weight": 0.15},
    ],
}

PILLAR_WEIGHTS = {
    "political":     0.15,
    "economic":      0.15,
    "technical":     0.20,
    "financial":     0.20,
    "environmental": 0.15,
    "legal":         0.15,
}

GATING_RULES = [
    "Land rights unresolved or active litigation",
    "No legal mandate — no legal opinion available",
    "No credible offtake and no alternative revenue pathway",
    "EIA requires resettlement with no approved plan or budget",
]


def _compute_overall_score(scores: list[PetfelScore]) -> tuple[float, str, str]:
    """
    Compute the overall PETFEL score (0-100), rating (A-D), and gating result.
    Returns (score, rating, gating_result).
    """
    pillar_scores: dict[str, list[float]] = {p: [] for p in PILLAR_WEIGHTS}
    critical_flags = False

    for s in scores:
        if s.score is not None and s.pillar in pillar_scores:
            # Normalise 1-5 score to 0-100 range using weight
            normalised = ((s.score - 1) / 4) * 100  # 1→0, 5→100
            weighted   = normalised * float(s.sub_weight or 0.20)
            pillar_scores[s.pillar].append(weighted)
            if s.score <= 2 and s.mitigation is None:
                critical_flags = True

    overall = 0.0
    for pillar, pw in PILLAR_WEIGHTS.items():
        pscores = pillar_scores.get(pillar, [])
        if pscores:
            pillar_avg = sum(pscores) / sum(
                (c["weight"] for c in PETFEL_SUBCRITERIA.get(pillar, [])), 0
            )
            overall += pillar_avg * pw

    # Rating bands
    if overall >= 80:
        rating = "A"
    elif overall >= 65:
        rating = "B"
    elif overall >= 50:
        rating = "C"
    else:
        rating = "D"

    gating = "HOLD" if (rating in ("C", "D") or critical_flags) else "GO"
    return round(overall, 2), rating, gating


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class ScoreInput(BaseModel):
    pillar:         str
    sub_criterion:  str
    score:          int = Field(..., ge=1, le=5)
    sub_weight:     Optional[float] = None
    evidence_notes: Optional[str]   = None
    mitigation:     Optional[str]   = None
    owner:          Optional[str]   = None


class AssessmentCreateRequest(BaseModel):
    scores: list[ScoreInput] = Field(
        ..., description="All 30 sub-criterion scores (partial accepted)"
    )
    notes: Optional[str] = None


class FlagResolveRequest(BaseModel):
    notes: Optional[str] = None


class AssessmentResponse(BaseModel):
    id:             str
    project_id:     str
    version:        int
    status:         str
    overall_score:  Optional[float]
    rating:         Optional[str]
    gating_result:  Optional[str]
    recommendation: Optional[str]
    red_flags:      int
    ai_augmented:   bool
    assessed_at:    datetime

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


def _get_assessment_or_404(assessment_id: str, db: Session) -> PetfelAssessment:
    a = db.query(PetfelAssessment).filter(PetfelAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/criteria")
async def get_petfel_criteria(current_user: User = Depends(get_current_user)):
    """Return the full PETFEL criteria definition grouped by pillar."""
    return {
        pillar: [
            {"pillar": pillar, "code": c["code"], "name": c["name"], "weight": c["weight"]}
            for c in criteria
        ]
        for pillar, criteria in PETFEL_SUBCRITERIA.items()
    }


@router.get("/assessments")
async def list_assessments(
    project_id:   str       = None,
    db:           Session   = Depends(get_db),
    current_user: User      = Depends(get_current_user),
):
    """List PETFEL assessments, optionally filtered by project."""
    query = db.query(PetfelAssessment)
    if project_id:
        query = query.filter(PetfelAssessment.project_id == project_id)
    assessments = query.order_by(PetfelAssessment.created_at.desc()).all()
    return [
        {
            "id":             a.id,
            "project_id":     a.project_id,
            "version":        a.version,
            "status":         a.status,
            "overall_score":  float(a.overall_score) if a.overall_score else None,
            "rating":         a.rating,
            "gating_result":  a.gating_result,
            "recommendation": a.recommendation,
            "created_at":     str(a.created_at),
        }
        for a in assessments
    ]


@router.get("/assessment/{assessment_id}")
async def get_assessment_by_id(
    assessment_id: str,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_user),
):
    """Get a PETFEL assessment by its own ID."""
    assessment = db.query(PetfelAssessment).filter(
        PetfelAssessment.id == assessment_id
    ).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    scores = db.query(PetfelScore).filter(PetfelScore.assessment_id == assessment_id).limit(100).all()
    flags  = db.query(PetfelFlag).filter(PetfelFlag.assessment_id == assessment_id).limit(100).all()
    return {
        "id":             assessment.id,
        "project_id":     assessment.project_id,
        "version":        assessment.version,
        "status":         assessment.status,
        "overall_score":  float(assessment.overall_score) if assessment.overall_score else None,
        "rating":         assessment.rating,
        "gating_result":  assessment.gating_result,
        "recommendation": assessment.recommendation,
        "pillar_scores":  assessment.pillar_scores,
        "created_at":     str(assessment.created_at),
        "scores": [
            {
                "id":             s.id,
                "pillar":         s.pillar,
                "sub_criterion":  s.sub_criterion,
                "score":          s.score,
                "evidence_notes": s.evidence_notes,
                "mitigation":     s.mitigation,
                "owner":          s.owner,
            }
            for s in scores
        ],
        "flags": [
            {
                "id":          f.id,
                "flag_type":   f.flag_type,
                "pillar":      f.pillar,
                "description": f.description,
                "is_resolved": f.is_resolved,
            }
            for f in flags
        ],
    }


@router.post("/assess/{project_id}", response_model=AssessmentResponse, status_code=201)
async def create_assessment(
    project_id:  str,
    payload:     AssessmentCreateRequest,
    db:          Session       = Depends(get_db),
    current_user: User         = Depends(get_current_user),
):
    """Create a new PETFEL assessment for a project."""
    _get_project_or_404(project_id, db)

    # Determine next version number
    latest_version = (
        db.query(PetfelAssessment)
        .filter(PetfelAssessment.project_id == project_id)
        .count()
    )

    assessment = PetfelAssessment(
        project_id  = project_id,
        version     = latest_version + 1,
        assessed_by = current_user.id,
        notes       = payload.notes,
    )
    db.add(assessment)
    db.flush()

    # Persist individual sub-criterion scores
    for s in payload.scores:
        # Look up default weight if not provided
        default_weight = next(
            (
                c["weight"]
                for c in PETFEL_SUBCRITERIA.get(s.pillar.lower(), [])
                if c["name"] == s.sub_criterion
            ),
            0.20,
        )
        weight = s.sub_weight or default_weight
        weighted_score = ((s.score - 1) / 4) * 100 * weight

        score_row = PetfelScore(
            assessment_id  = assessment.id,
            pillar         = s.pillar.lower(),
            sub_criterion  = s.sub_criterion,
            score          = s.score,
            sub_weight     = weight,
            weighted_score = round(weighted_score, 4),
            evidence_notes = s.evidence_notes,
            mitigation     = s.mitigation,
            owner          = s.owner,
        )
        db.add(score_row)

        # Auto-create red flag for critical scores without mitigation
        if s.score <= 2:
            flag = PetfelFlag(
                assessment_id = assessment.id,
                flag_type     = "pillar_low",
                pillar        = s.pillar.lower(),
                description   = (
                    f"Sub-criterion '{s.sub_criterion}' scored {s.score}/5. "
                    f"Mitigation: {s.mitigation or 'NONE — action required.'}"
                ),
            )
            db.add(flag)

    db.flush()

    # Compute overall score
    all_scores = db.query(PetfelScore).filter(
        PetfelScore.assessment_id == assessment.id
    ).limit(100).all()
    overall, rating, gating = _compute_overall_score(all_scores)
    assessment.overall_score = overall
    assessment.rating        = rating
    assessment.gating_result = gating
    assessment.status        = "submitted"

    # Count red flags
    flag_count = db.query(PetfelFlag).filter(
        PetfelFlag.assessment_id == assessment.id,
        PetfelFlag.is_resolved   == False,  # noqa: E712
    ).count()

    db.commit()
    db.refresh(assessment)

    logger.info(
        "PETFEL assessment created | project=%s version=%s score=%.1f rating=%s",
        project_id, assessment.version, overall, rating,
    )

    return AssessmentResponse(
        id            = assessment.id,
        project_id    = assessment.project_id,
        version       = assessment.version,
        status        = assessment.status,
        overall_score = float(assessment.overall_score),
        rating        = assessment.rating,
        gating_result = assessment.gating_result,
        recommendation= assessment.recommendation,
        red_flags     = flag_count,
        ai_augmented  = assessment.ai_augmented,
        assessed_at   = assessment.assessed_at,
    )


@router.get("/{project_id}", response_model=AssessmentResponse)
async def get_latest_assessment(
    project_id:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return the latest approved/submitted assessment for a project."""
    _get_project_or_404(project_id, db)
    assessment = (
        db.query(PetfelAssessment)
        .filter(PetfelAssessment.project_id == project_id)
        .order_by(PetfelAssessment.version.desc())
        .first()
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="No PETFEL assessment found")

    flag_count = db.query(PetfelFlag).filter(
        PetfelFlag.assessment_id == assessment.id,
        PetfelFlag.is_resolved   == False,  # noqa: E712
    ).count()

    return AssessmentResponse(
        id            = assessment.id,
        project_id    = assessment.project_id,
        version       = assessment.version,
        status        = assessment.status,
        overall_score = float(assessment.overall_score) if assessment.overall_score else None,
        rating        = assessment.rating,
        gating_result = assessment.gating_result,
        recommendation= assessment.recommendation,
        red_flags     = flag_count,
        ai_augmented  = assessment.ai_augmented,
        assessed_at   = assessment.assessed_at,
    )


@router.get("/{assessment_id}/scorecard")
async def get_scorecard(
    assessment_id: str,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_user),
):
    """Return full 30-criterion scorecard for an assessment."""
    assessment = _get_assessment_or_404(assessment_id, db)
    scores     = db.query(PetfelScore).filter(
        PetfelScore.assessment_id == assessment_id
    ).limit(100).all()
    flags      = db.query(PetfelFlag).filter(
        PetfelFlag.assessment_id == assessment_id
    ).limit(100).all()

    scorecard: dict = {pillar: [] for pillar in PETFEL_SUBCRITERIA}
    for s in scores:
        scorecard[s.pillar].append({
            "sub_criterion":  s.sub_criterion,
            "score":          s.score,
            "sub_weight":     float(s.sub_weight) if s.sub_weight else None,
            "weighted_score": float(s.weighted_score) if s.weighted_score else None,
            "evidence_notes": s.evidence_notes,
            "mitigation":     s.mitigation,
            "owner":          s.owner,
        })

    return {
        "assessment_id": assessment.id,
        "overall_score": float(assessment.overall_score) if assessment.overall_score else None,
        "rating":        assessment.rating,
        "gating_result": assessment.gating_result,
        "version":       assessment.version,
        "scorecard":     scorecard,
        "red_flags": [
            {
                "id":          f.id,
                "pillar":      f.pillar,
                "flag_type":   f.flag_type,
                "description": f.description,
                "is_resolved": f.is_resolved,
            }
            for f in flags
        ],
        "gating_rules": GATING_RULES,
    }


@router.get("/{assessment_id}/flags")
async def list_flags(
    assessment_id: str,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_user),
):
    """List all red flags for an assessment."""
    _get_assessment_or_404(assessment_id, db)
    flags = db.query(PetfelFlag).filter(
        PetfelFlag.assessment_id == assessment_id
    ).limit(100).all()
    return [
        {
            "id":          f.id,
            "pillar":      f.pillar,
            "flag_type":   f.flag_type,
            "description": f.description,
            "is_resolved": f.is_resolved,
            "resolved_at": f.resolved_at,
        }
        for f in flags
    ]


@router.post("/{assessment_id}/flags/{flag_id}/resolve")
async def resolve_flag(
    assessment_id: str,
    flag_id:       str,
    payload:       FlagResolveRequest,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_user),
):
    """Mark a red flag as resolved."""
    flag = db.query(PetfelFlag).filter(
        PetfelFlag.id            == flag_id,
        PetfelFlag.assessment_id == assessment_id,
    ).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    flag.is_resolved = True
    flag.resolved_by = current_user.id
    flag.resolved_at = datetime.now(timezone.utc)
    if payload.notes:
        flag.description = flag.description + f"\n[Resolved] {payload.notes}"
    db.commit()
    return {"status": "resolved", "flag_id": flag_id}


@router.post("/{assessment_id}/ai-augment")
async def ai_augment_assessment(
    assessment_id: str,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_user),
):
    """
    Use Claude to generate qualitative risk narratives and augment
    any partially scored sub-criteria where evidence is limited.
    """
    from backend.services.aip_claude_service import augment_petfel

    assessment = _get_assessment_or_404(assessment_id, db)
    scores = db.query(PetfelScore).filter(
        PetfelScore.assessment_id == assessment_id
    ).all()

    # Build compact scorecard for Claude
    scorecard_summary = []
    for s in scores:
        scorecard_summary.append({
            "pillar":         s.pillar,
            "sub_criterion":  s.sub_criterion,
            "score":          s.score,
            "evidence_notes": s.evidence_notes or "",
        })

    augmented = await augment_petfel(scorecard_summary)

    # Update recommendation from AI output
    assessment.recommendation = augmented.get("recommendation", assessment.recommendation)
    assessment.ai_augmented   = True
    assessment.ai_augmented_at = datetime.now(timezone.utc)
    db.commit()

    return {"augmented": True, "ai_recommendation": augmented.get("recommendation"), "analysis": augmented.get("analysis")}


@router.post("/{assessment_id}/score")
async def update_scores(
    assessment_id: str,
    payload:       dict,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_user),
):
    """Upsert one or more PETFEL scores for an assessment."""
    assessment = _get_assessment_or_404(assessment_id, db)
    scores_in = payload.get("scores", [])
    for s in scores_in:
        existing = db.query(PetfelScore).filter(
            PetfelScore.assessment_id == assessment_id,
            PetfelScore.sub_criterion == s["sub_criterion"],
        ).first()
        if existing:
            existing.score          = s.get("score", existing.score)
            existing.evidence_notes = s.get("evidence_notes", existing.evidence_notes)
            existing.mitigation     = s.get("mitigation", existing.mitigation)
            existing.owner          = s.get("owner", existing.owner)
        else:
            db.add(PetfelScore(
                assessment_id   = assessment_id,
                pillar          = s["pillar"],
                sub_criterion   = s["sub_criterion"],
                score           = s.get("score"),
                evidence_notes  = s.get("evidence_notes"),
                mitigation      = s.get("mitigation"),
                owner           = s.get("owner"),
            ))
    db.commit()
    return {"status": "updated", "assessment_id": assessment_id, "scores_updated": len(scores_in)}


@router.post("/{assessment_id}/calculate")
async def calculate_assessment(
    assessment_id: str,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_user),
):
    """Recalculate the overall PETFEL score from current sub-criterion scores."""
    assessment = _get_assessment_or_404(assessment_id, db)
    scores     = db.query(PetfelScore).filter(
        PetfelScore.assessment_id == assessment_id
    ).all()
    overall, rating, gating = _compute_overall_score(scores)
    assessment.overall_score = overall
    assessment.rating        = rating
    assessment.gating_result = gating
    assessment.updated_at    = datetime.now(timezone.utc)
    db.commit()
    return {
        "assessment_id": assessment_id,
        "overall_score": overall,
        "rating":        rating,
        "gating_result": gating,
    }


@router.post("/{assessment_id}/submit")
async def submit_assessment(
    assessment_id: str,
    db:            Session = Depends(get_db),
    current_user:  User    = Depends(get_current_user),
):
    """Submit a PETFEL assessment (locks scores and marks as complete)."""
    assessment = _get_assessment_or_404(assessment_id, db)
    if assessment.status != "draft":
        return {"status": assessment.status, "assessment_id": assessment_id, "message": "Already submitted"}
    assessment.status     = "submitted"
    assessment.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("PETFEL assessment submitted | id=%s by %s", assessment_id, current_user.email)
    return {"status": "submitted", "assessment_id": assessment_id}


@router.get("")
async def petfel_root(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """List recent PETFEL assessments."""
    assessments = db.query(PetfelAssessment).order_by(PetfelAssessment.created_at.desc()).limit(50).all()
    return {
        "assessments": [
            {
                "id":            a.id,
                "project_id":    a.project_id,
                "version":       a.version,
                "status":        a.status,
                "overall_score": float(a.overall_score) if a.overall_score else None,
                "rating":        a.rating,
                "gating_result": a.gating_result,
                "created_at":    str(a.created_at),
            }
            for a in assessments
        ],
        "count": len(assessments),
    }
