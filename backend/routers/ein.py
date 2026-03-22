"""
Executive Investment Note (EIN) API Routes
Implements the 9-section EIN template per PRD Section 7
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    ExecutiveNote, EINSection, EINStatus, Recommendation, User
)
from backend.services.ein_service import EINService

router = APIRouter(prefix="/ein", tags=["Executive Investment Notes"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class EINCreate(BaseModel):
    """Request to create a new EIN"""
    project_id: int
    petfel_assessment_id: Optional[int] = Field(None, description="Link to PETFEL assessment")


class SectionUpdate(BaseModel):
    """Request to update a section"""
    content: str = Field(..., description="Section content (Markdown)")
    generated_by: str = Field("analyst", description="'ai', 'analyst', or 'hybrid'")


class ExecutiveSummaryUpdate(BaseModel):
    """Request to update executive summary"""
    executive_summary: str
    recommendation: str = Field(..., description="'go', 'hold', or 'no_go'")
    key_gaps: Optional[str] = None
    next_steps: Optional[str] = None


class SectionResponse(BaseModel):
    """Response for a single section"""
    id: int
    section_code: int
    section_name: str
    content: Optional[str]
    generated_by: Optional[str]
    is_reviewed: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class EINResponse(BaseModel):
    """Full EIN response"""
    id: int
    project_id: int
    title: Optional[str]
    version: int
    status: str
    author_id: Optional[int]
    executive_summary: Optional[str]
    recommendation: Optional[str]
    key_gaps: Optional[str]
    next_steps: Optional[str]
    petfel_assessment_id: Optional[int]
    petfel_score: Optional[float]
    red_flags_count: int
    export_ready: bool
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime]
    sent_at: Optional[datetime]
    sections: List[SectionResponse] = []

    class Config:
        from_attributes = True


class SectionTemplateResponse(BaseModel):
    """Section template/guidance"""
    code: int
    name: str
    objective: str
    key_questions: List[str]
    output_guidance: str


class ValidationResponse(BaseModel):
    """Validation result"""
    is_valid: bool
    issues: List[str]


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/templates", response_model=List[SectionTemplateResponse], summary="Get EIN section templates")
async def get_section_templates(db: Session = Depends(get_db)):
    """
    Returns the 9-section EIN template with:
    - Section objectives
    - Key questions to answer
    - Output guidance
    """
    service = EINService(db)
    templates = service.get_all_section_templates()
    return [SectionTemplateResponse(**t) for t in templates]


@router.get("/templates/{section_code}", response_model=SectionTemplateResponse, summary="Get specific section template")
async def get_section_template(
    section_code: int,
    db: Session = Depends(get_db)
):
    """Get the template/guidance for a specific section (0-8)"""
    if section_code < 0 or section_code > 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section code must be 0-8"
        )

    service = EINService(db)
    template = service.get_section_template(section_code)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template for section {section_code} not found"
        )
    return SectionTemplateResponse(**template)


@router.post("/{project_id}", response_model=EINResponse, summary="Create new EIN")
async def create_ein(
    project_id: int,
    ein_data: Optional[EINCreate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new Executive Investment Note for a project.
    Initializes all 9 sections with no content.
    """
    try:
        service = EINService(db)
        petfel_id = ein_data.petfel_assessment_id if ein_data else None
        ein = service.create_ein(project_id, current_user.id, petfel_id)
        return _build_ein_response(ein)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{project_id}", response_model=EINResponse, summary="Get latest EIN for project")
async def get_latest_ein(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the latest EIN for a project"""
    service = EINService(db)
    ein = service.get_latest_ein(project_id)
    if not ein:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No EIN found for project {project_id}"
        )
    return _build_ein_response(ein)


@router.get("/{project_id}/approved", response_model=EINResponse, summary="Get latest approved EIN")
async def get_approved_ein(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the latest approved EIN for a project (for investor distribution)"""
    service = EINService(db)
    ein = service.get_approved_ein(project_id)
    if not ein:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No approved EIN found for project {project_id}"
        )
    return _build_ein_response(ein)


@router.get("/note/{ein_id}", response_model=EINResponse, summary="Get specific EIN")
async def get_ein(
    ein_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific EIN by ID"""
    service = EINService(db)
    ein = service.get_ein(ein_id)
    if not ein:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EIN {ein_id} not found"
        )
    return _build_ein_response(ein)


@router.put("/{ein_id}/summary", response_model=EINResponse, summary="Update executive summary")
async def update_executive_summary(
    ein_id: int,
    summary_data: ExecutiveSummaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the EIN executive summary and recommendation"""
    try:
        recommendation = Recommendation(summary_data.recommendation)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid recommendation: {summary_data.recommendation}. Must be 'go', 'hold', or 'no_go'"
        )

    try:
        service = EINService(db)
        ein = service.update_executive_summary(
            ein_id=ein_id,
            executive_summary=summary_data.executive_summary,
            recommendation=recommendation,
            key_gaps=summary_data.key_gaps,
            next_steps=summary_data.next_steps
        )
        return _build_ein_response(ein)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{ein_id}/section/{section_code}", response_model=SectionResponse, summary="Update section content")
async def update_section(
    ein_id: int,
    section_code: int,
    section_data: SectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a specific section's content.
    Section codes:
    - 0: Cover & Executive Summary
    - 1: Strategy Perspective
    - 2: Political Perspective
    - 3: Economic Perspective
    - 4: Financial Perspective
    - 5: Legal & Regulatory Perspective
    - 6: Risk Register & Mitigation Plan
    - 7: Required Next Steps (30/60/90 Days)
    - 8: Annexes
    """
    if section_code < 0 or section_code > 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section code must be 0-8"
        )

    try:
        service = EINService(db)
        section = service.update_section(
            ein_id=ein_id,
            section_code=section_code,
            content=section_data.content,
            generated_by=section_data.generated_by
        )
        return SectionResponse(
            id=section.id,
            section_code=section.section_code,
            section_name=section.section_name,
            content=section.content,
            generated_by=section.generated_by,
            is_reviewed=section.is_reviewed,
            updated_at=section.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{ein_id}/section/{section_code}/review", response_model=SectionResponse, summary="Mark section as reviewed")
async def review_section(
    ein_id: int,
    section_code: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a section as reviewed by the current user"""
    try:
        service = EINService(db)
        section = service.mark_section_reviewed(
            ein_id=ein_id,
            section_code=section_code,
            reviewer_id=current_user.id
        )
        return SectionResponse(
            id=section.id,
            section_code=section.section_code,
            section_name=section.section_name,
            content=section.content,
            generated_by=section.generated_by,
            is_reviewed=section.is_reviewed,
            updated_at=section.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{ein_id}/submit", response_model=EINResponse, summary="Submit EIN for review")
async def submit_ein(
    ein_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit the EIN for review. All required sections must have content."""
    try:
        service = EINService(db)
        ein = service.submit_for_review(ein_id)
        return _build_ein_response(ein)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{ein_id}/approve", response_model=EINResponse, summary="Approve EIN")
async def approve_ein(
    ein_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve EIN for export/distribution to investors and IC"""
    try:
        service = EINService(db)
        ein = service.approve_ein(ein_id)
        return _build_ein_response(ein)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{ein_id}/send", response_model=EINResponse, summary="Mark EIN as sent")
async def mark_ein_sent(
    ein_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark EIN as sent to investors/IC"""
    try:
        service = EINService(db)
        ein = service.mark_as_sent(ein_id)
        return _build_ein_response(ein)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{ein_id}/validate", response_model=ValidationResponse, summary="Validate EIN for IC")
async def validate_for_ic(
    ein_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate that EIN is ready for Investment Committee"""
    service = EINService(db)
    issues = service.validate_for_ic(ein_id)
    return ValidationResponse(
        is_valid=len(issues) == 0,
        issues=issues
    )


# ============================================================================
# Helper Functions
# ============================================================================

def _build_ein_response(ein: ExecutiveNote) -> EINResponse:
    """Build response from EIN model"""
    sections = [
        SectionResponse(
            id=s.id,
            section_code=s.section_code,
            section_name=s.section_name,
            content=s.content,
            generated_by=s.generated_by,
            is_reviewed=s.is_reviewed,
            updated_at=s.updated_at
        )
        for s in sorted(ein.sections, key=lambda x: x.section_code)
    ]

    return EINResponse(
        id=ein.id,
        project_id=ein.project_id,
        title=ein.title,
        version=ein.version,
        status=ein.status.value,
        author_id=ein.author_id,
        executive_summary=ein.executive_summary,
        recommendation=ein.recommendation.value if ein.recommendation else None,
        key_gaps=ein.key_gaps,
        next_steps=ein.next_steps,
        petfel_assessment_id=ein.petfel_assessment_id,
        petfel_score=ein.petfel_score,
        red_flags_count=ein.red_flags_count,
        export_ready=ein.export_ready,
        created_at=ein.created_at,
        updated_at=ein.updated_at,
        approved_at=ein.approved_at,
        sent_at=ein.sent_at,
        sections=sections
    )
