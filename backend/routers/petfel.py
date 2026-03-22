"""
PETFEL Due Diligence API Routes
Implements PETFEL scoring engine per PRD Section 6
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    PETFELAssessment, PETFELScore, PETFELFlag,
    PillarType, PETFELRating, GatingResult, FlagType, AssessmentStatus,
    User
)
from backend.services.petfel_service import PETFELService

router = APIRouter(prefix="/petfel", tags=["PETFEL Due Diligence"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class ScoreUpdate(BaseModel):
    """Request to update a sub-criterion score"""
    pillar: str = Field(..., description="Pillar: political, economic, technical, financial, environmental, legal")
    sub_criterion: str = Field(..., description="Name of the sub-criterion")
    score: int = Field(..., ge=1, le=5, description="Score 1-5 (1=Critical, 5=Best Practice)")
    evidence_notes: Optional[str] = Field(None, description="Evidence supporting the score")
    mitigation: Optional[str] = Field(None, description="Mitigation plan if score is low")
    owner: Optional[str] = Field(None, description="Person responsible for mitigation")


class FlagCreate(BaseModel):
    """Request to add a red flag"""
    flag_type: str = Field(..., description="Type: land_unresolved, no_legal_mandate, no_offtake, eia_resettlement, pillar_low")
    description: str = Field(..., description="Description of the flag")
    pillar: Optional[str] = Field(None, description="Related pillar if applicable")


class FlagResolve(BaseModel):
    """Request to resolve a flag"""
    resolution_notes: Optional[str] = Field(None, description="Notes on how the flag was resolved")


class ScoreResponse(BaseModel):
    """Response for a single score"""
    id: int
    pillar: str
    sub_criterion: str
    score: Optional[int]
    sub_weight: float
    weighted_score: Optional[float]
    evidence_notes: Optional[str]
    mitigation: Optional[str]
    owner: Optional[str]
    ai_suggested_score: Optional[int]
    ai_rationale: Optional[str]

    class Config:
        from_attributes = True


class FlagResponse(BaseModel):
    """Response for a flag"""
    id: int
    flag_type: str
    pillar: Optional[str]
    description: str
    is_resolved: bool
    resolved_at: Optional[datetime]
    resolution_notes: Optional[str]

    class Config:
        from_attributes = True


class AssessmentResponse(BaseModel):
    """Full assessment response"""
    id: int
    project_id: int
    version: int
    status: str
    overall_score: Optional[float]
    rating: Optional[str]
    gating_result: Optional[str]
    political_score: Optional[float]
    economic_score: Optional[float]
    technical_score: Optional[float]
    financial_score: Optional[float]
    environmental_score: Optional[float]
    legal_score: Optional[float]
    recommendation: Optional[str]
    notes: Optional[str]
    ai_augmented: bool
    created_at: datetime
    updated_at: datetime
    scores: List[ScoreResponse] = []
    flags: List[FlagResponse] = []

    class Config:
        from_attributes = True


class AssessmentCreate(BaseModel):
    """Request to create a new assessment"""
    project_id: int


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/criteria", summary="Get PETFEL criteria configuration")
async def get_criteria_config(db: Session = Depends(get_db)):
    """
    Returns the full PETFEL criteria configuration including:
    - All 6 pillars with weights
    - All 30 sub-criteria with weights
    - Rating bands (A/B/C/D)
    - Score scale (1-5)
    """
    service = PETFELService(db)
    return service.get_criteria_config()


@router.post("/assess/{project_id}", response_model=AssessmentResponse, summary="Create new PETFEL assessment")
async def create_assessment(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new PETFEL assessment for a project.
    Initializes all 30 sub-criteria with no scores.
    """
    try:
        service = PETFELService(db)
        assessment = service.create_assessment(project_id, current_user.id)
        return _build_assessment_response(assessment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{project_id}", response_model=AssessmentResponse, summary="Get latest PETFEL assessment")
async def get_latest_assessment(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the latest PETFEL assessment for a project"""
    service = PETFELService(db)
    assessment = service.get_latest_assessment(project_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No PETFEL assessment found for project {project_id}"
        )
    return _build_assessment_response(assessment)


@router.get("/assessment/{assessment_id}", response_model=AssessmentResponse, summary="Get specific assessment")
async def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific PETFEL assessment by ID"""
    service = PETFELService(db)
    assessment = service.get_assessment(assessment_id)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found"
        )
    return _build_assessment_response(assessment)


@router.put("/{assessment_id}/score", response_model=ScoreResponse, summary="Update a sub-criterion score")
async def update_score(
    assessment_id: int,
    score_data: ScoreUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a single sub-criterion score (1-5).
    Score scale:
    - 5: Best Practice - Investment-ready
    - 4: Low Risk - Good maturity
    - 3: Moderate Risk - Gaps exist but solvable
    - 2: High Risk - Major gaps
    - 1: Critical Risk - Missing fundamentals
    """
    try:
        pillar = PillarType(score_data.pillar)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid pillar: {score_data.pillar}"
        )

    try:
        service = PETFELService(db)
        score = service.update_score(
            assessment_id=assessment_id,
            pillar=pillar,
            sub_criterion=score_data.sub_criterion,
            score=score_data.score,
            evidence_notes=score_data.evidence_notes,
            mitigation=score_data.mitigation,
            owner=score_data.owner
        )
        return ScoreResponse(
            id=score.id,
            pillar=score.pillar.value,
            sub_criterion=score.sub_criterion,
            score=score.score,
            sub_weight=score.sub_weight,
            weighted_score=score.weighted_score,
            evidence_notes=score.evidence_notes,
            mitigation=score.mitigation,
            owner=score.owner,
            ai_suggested_score=score.ai_suggested_score,
            ai_rationale=score.ai_rationale
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{assessment_id}/calculate", response_model=AssessmentResponse, summary="Calculate scores and rating")
async def calculate_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate overall scores, rating (A/B/C/D), and gating result (GO/HOLD).
    Applies pillar weights and checks gating rules.
    """
    try:
        service = PETFELService(db)
        assessment = service.finalize_assessment(assessment_id)
        return _build_assessment_response(assessment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{assessment_id}/submit", response_model=AssessmentResponse, summary="Submit assessment for review")
async def submit_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit the assessment for review. Calculates final scores."""
    try:
        service = PETFELService(db)
        assessment = service.submit_assessment(assessment_id)
        return _build_assessment_response(assessment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{assessment_id}/approve", response_model=AssessmentResponse, summary="Approve assessment")
async def approve_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a submitted assessment"""
    try:
        service = PETFELService(db)
        assessment = service.approve_assessment(assessment_id)
        return _build_assessment_response(assessment)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{assessment_id}/flags", response_model=List[FlagResponse], summary="Get assessment flags")
async def get_flags(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all red flags for an assessment"""
    flags = db.query(PETFELFlag).filter(
        PETFELFlag.assessment_id == assessment_id
    ).all()

    return [
        FlagResponse(
            id=f.id,
            flag_type=f.flag_type.value,
            pillar=f.pillar,
            description=f.description,
            is_resolved=f.is_resolved,
            resolved_at=f.resolved_at,
            resolution_notes=f.resolution_notes
        )
        for f in flags
    ]


@router.post("/{assessment_id}/flags", response_model=FlagResponse, summary="Add a red flag")
async def add_flag(
    assessment_id: int,
    flag_data: FlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a red flag to the assessment"""
    try:
        flag_type = FlagType(flag_data.flag_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid flag type: {flag_data.flag_type}"
        )

    service = PETFELService(db)
    flag = service.add_flag(
        assessment_id=assessment_id,
        flag_type=flag_type,
        description=flag_data.description,
        pillar=flag_data.pillar
    )

    return FlagResponse(
        id=flag.id,
        flag_type=flag.flag_type.value,
        pillar=flag.pillar,
        description=flag.description,
        is_resolved=flag.is_resolved,
        resolved_at=flag.resolved_at,
        resolution_notes=flag.resolution_notes
    )


@router.post("/{assessment_id}/flags/{flag_id}/resolve", response_model=FlagResponse, summary="Resolve a flag")
async def resolve_flag(
    assessment_id: int,
    flag_id: int,
    resolve_data: FlagResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a red flag as resolved"""
    try:
        service = PETFELService(db)
        flag = service.resolve_flag(
            flag_id=flag_id,
            user_id=current_user.id,
            resolution_notes=resolve_data.resolution_notes
        )

        return FlagResponse(
            id=flag.id,
            flag_type=flag.flag_type.value,
            pillar=flag.pillar,
            description=flag.description,
            is_resolved=flag.is_resolved,
            resolved_at=flag.resolved_at,
            resolution_notes=flag.resolution_notes
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================================================
# Helper Functions
# ============================================================================

def _build_assessment_response(assessment: PETFELAssessment) -> AssessmentResponse:
    """Build response from assessment model"""
    scores = [
        ScoreResponse(
            id=s.id,
            pillar=s.pillar.value,
            sub_criterion=s.sub_criterion,
            score=s.score,
            sub_weight=s.sub_weight,
            weighted_score=s.weighted_score,
            evidence_notes=s.evidence_notes,
            mitigation=s.mitigation,
            owner=s.owner,
            ai_suggested_score=s.ai_suggested_score,
            ai_rationale=s.ai_rationale
        )
        for s in assessment.scores
    ]

    flags = [
        FlagResponse(
            id=f.id,
            flag_type=f.flag_type.value,
            pillar=f.pillar,
            description=f.description,
            is_resolved=f.is_resolved,
            resolved_at=f.resolved_at,
            resolution_notes=f.resolution_notes
        )
        for f in assessment.flags
    ]

    return AssessmentResponse(
        id=assessment.id,
        project_id=assessment.project_id,
        version=assessment.version,
        status=assessment.status.value,
        overall_score=assessment.overall_score,
        rating=assessment.rating.value if assessment.rating else None,
        gating_result=assessment.gating_result.value if assessment.gating_result else None,
        political_score=assessment.political_score,
        economic_score=assessment.economic_score,
        technical_score=assessment.technical_score,
        financial_score=assessment.financial_score,
        environmental_score=assessment.environmental_score,
        legal_score=assessment.legal_score,
        recommendation=assessment.recommendation,
        notes=assessment.notes,
        ai_augmented=assessment.ai_augmented,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        scores=scores,
        flags=flags
    )
