"""
Investment Committee (IC) Governance API Routes
Implements IC voting and decision tracking per PRD Section 4.6
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    InvestmentCommittee, ICVote, VoteDecision,
    ExecutiveNote, Project, User
)

router = APIRouter(prefix="/ic", tags=["Investment Committee"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class ICCommitteeCreate(BaseModel):
    """Request to create IC meeting"""
    project_id: int
    ein_id: Optional[int] = Field(None, description="Linked EIN for the meeting")
    scheduled_date: datetime
    meeting_type: str = Field("regular", description="'regular' or 'extraordinary'")
    quorum_required: int = Field(3, ge=1, description="Minimum votes for quorum")


class VoteCreate(BaseModel):
    """Request to submit a vote"""
    vote: str = Field(..., description="'approve', 'reject', 'defer', or 'abstain'")
    rationale: Optional[str] = Field(None, description="Reasoning for the vote")
    conditions: Optional[str] = Field(None, description="Conditions if approving with conditions")


class VoteResponse(BaseModel):
    """Vote response"""
    id: int
    committee_id: int
    voter_id: int
    vote: str
    rationale: Optional[str]
    conditions: Optional[str]
    voted_at: datetime

    class Config:
        from_attributes = True


class ICCommitteeResponse(BaseModel):
    """IC meeting response"""
    id: int
    project_id: int
    ein_id: Optional[int]
    scheduled_date: datetime
    meeting_type: str
    status: str
    decision: Optional[str]
    decision_notes: Optional[str]
    quorum_required: int
    quorum_met: bool
    vote_count: int
    approve_count: int
    reject_count: int
    defer_count: int
    created_at: datetime
    completed_at: Optional[datetime]
    votes: List[VoteResponse] = []

    class Config:
        from_attributes = True


class DecisionUpdate(BaseModel):
    """Request to record IC decision"""
    decision: str = Field(..., description="'approved', 'rejected', or 'deferred'")
    decision_notes: Optional[str] = None


class ICHistoryResponse(BaseModel):
    """IC history for a project"""
    project_id: int
    project_name: str
    total_meetings: int
    last_decision: Optional[str]
    last_decision_date: Optional[datetime]
    meetings: List[ICCommitteeResponse]


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/committees", response_model=ICCommitteeResponse, summary="Schedule IC meeting")
async def create_committee(
    committee_data: ICCommitteeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Schedule a new Investment Committee meeting for a project"""
    # Validate project exists
    project = db.query(Project).filter(Project.id == committee_data.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {committee_data.project_id} not found"
        )

    # Validate EIN if provided
    if committee_data.ein_id:
        ein = db.query(ExecutiveNote).filter(
            ExecutiveNote.id == committee_data.ein_id
        ).first()
        if not ein:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"EIN {committee_data.ein_id} not found"
            )

    committee = InvestmentCommittee(
        project_id=committee_data.project_id,
        ein_id=committee_data.ein_id,
        scheduled_date=committee_data.scheduled_date,
        meeting_type=committee_data.meeting_type,
        quorum_required=committee_data.quorum_required,
        status="scheduled",
    )
    db.add(committee)
    db.commit()
    db.refresh(committee)

    return _build_committee_response(committee)


@router.get("/committees", response_model=List[ICCommitteeResponse], summary="List IC meetings")
async def list_committees(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all IC meetings, optionally filtered by status"""
    query = db.query(InvestmentCommittee)

    if status_filter:
        valid_statuses = ["scheduled", "in_progress", "completed", "cancelled"]
        if status_filter not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Valid values: {', '.join(valid_statuses)}"
            )
        query = query.filter(InvestmentCommittee.status == status_filter)

    committees = query.order_by(InvestmentCommittee.scheduled_date.desc()).all()
    return [_build_committee_response(c) for c in committees]


@router.get("/committees/{committee_id}", response_model=ICCommitteeResponse, summary="Get IC meeting details")
async def get_committee(
    committee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get details of a specific IC meeting"""
    committee = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.id == committee_id
    ).first()

    if not committee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IC meeting {committee_id} not found"
        )

    return _build_committee_response(committee)


@router.post("/committees/{committee_id}/start", response_model=ICCommitteeResponse, summary="Start IC meeting")
async def start_meeting(
    committee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark IC meeting as in progress"""
    committee = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.id == committee_id
    ).first()

    if not committee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IC meeting {committee_id} not found"
        )

    if committee.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Meeting is {committee.status}, cannot start"
        )

    committee.status = "in_progress"
    db.commit()
    db.refresh(committee)

    return _build_committee_response(committee)


@router.post("/committees/{committee_id}/vote", response_model=VoteResponse, summary="Submit vote")
async def submit_vote(
    committee_id: int,
    vote_data: VoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a vote for an IC meeting"""
    committee = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.id == committee_id
    ).first()

    if not committee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IC meeting {committee_id} not found"
        )

    if committee.status not in ["scheduled", "in_progress"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Meeting is {committee.status}, voting not allowed"
        )

    # Validate vote value
    try:
        vote_decision = VoteDecision(vote_data.vote)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid vote: {vote_data.vote}. Valid: approve, reject, defer, abstain"
        )

    # Check if user already voted
    existing_vote = db.query(ICVote).filter(
        ICVote.committee_id == committee_id,
        ICVote.voter_id == current_user.id
    ).first()

    if existing_vote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already voted in this meeting"
        )

    vote = ICVote(
        committee_id=committee_id,
        voter_id=current_user.id,
        vote=vote_decision,
        rationale=vote_data.rationale,
        conditions=vote_data.conditions,
    )
    db.add(vote)

    # Check if quorum met
    vote_count = len(committee.votes) + 1
    if vote_count >= committee.quorum_required:
        committee.quorum_met = True

    db.commit()
    db.refresh(vote)

    return VoteResponse(
        id=vote.id,
        committee_id=vote.committee_id,
        voter_id=vote.voter_id,
        vote=vote.vote.value,
        rationale=vote.rationale,
        conditions=vote.conditions,
        voted_at=vote.voted_at
    )


@router.get("/committees/{committee_id}/votes", response_model=List[VoteResponse], summary="Get all votes")
async def get_votes(
    committee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all votes for an IC meeting"""
    votes = db.query(ICVote).filter(
        ICVote.committee_id == committee_id
    ).order_by(ICVote.voted_at).all()

    return [
        VoteResponse(
            id=v.id,
            committee_id=v.committee_id,
            voter_id=v.voter_id,
            vote=v.vote.value,
            rationale=v.rationale,
            conditions=v.conditions,
            voted_at=v.voted_at
        )
        for v in votes
    ]


@router.post("/committees/{committee_id}/complete", response_model=ICCommitteeResponse, summary="Complete meeting and record decision")
async def complete_meeting(
    committee_id: int,
    decision_data: DecisionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Complete IC meeting and record the final decision"""
    committee = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.id == committee_id
    ).first()

    if not committee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IC meeting {committee_id} not found"
        )

    if committee.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Meeting already completed"
        )

    # Validate decision
    valid_decisions = ["approved", "rejected", "deferred"]
    if decision_data.decision not in valid_decisions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision. Valid: {', '.join(valid_decisions)}"
        )

    # Check quorum
    if not committee.quorum_met:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quorum not met. Required: {committee.quorum_required}, Current: {len(committee.votes)}"
        )

    committee.status = "completed"
    committee.decision = decision_data.decision
    committee.decision_notes = decision_data.decision_notes
    committee.completed_at = datetime.now()

    db.commit()
    db.refresh(committee)

    return _build_committee_response(committee)


@router.post("/committees/{committee_id}/cancel", response_model=ICCommitteeResponse, summary="Cancel meeting")
async def cancel_meeting(
    committee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel an IC meeting"""
    committee = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.id == committee_id
    ).first()

    if not committee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IC meeting {committee_id} not found"
        )

    if committee.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a completed meeting"
        )

    committee.status = "cancelled"
    db.commit()
    db.refresh(committee)

    return _build_committee_response(committee)


@router.get("/projects/{project_id}/history", response_model=ICHistoryResponse, summary="Get IC history for project")
async def get_project_ic_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get complete IC history for a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    committees = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.project_id == project_id
    ).order_by(InvestmentCommittee.scheduled_date.desc()).all()

    # Get last decision
    completed = [c for c in committees if c.status == "completed"]
    last_decision = completed[0].decision if completed else None
    last_decision_date = completed[0].completed_at if completed else None

    return ICHistoryResponse(
        project_id=project_id,
        project_name=project.name,
        total_meetings=len(committees),
        last_decision=last_decision,
        last_decision_date=last_decision_date,
        meetings=[_build_committee_response(c) for c in committees]
    )


# ============================================================================
# Helper Functions
# ============================================================================

def _build_committee_response(committee: InvestmentCommittee) -> ICCommitteeResponse:
    """Build response from IC committee model"""
    votes = [
        VoteResponse(
            id=v.id,
            committee_id=v.committee_id,
            voter_id=v.voter_id,
            vote=v.vote.value,
            rationale=v.rationale,
            conditions=v.conditions,
            voted_at=v.voted_at
        )
        for v in committee.votes
    ]

    # Count votes by type
    approve_count = sum(1 for v in committee.votes if v.vote == VoteDecision.APPROVE)
    reject_count = sum(1 for v in committee.votes if v.vote == VoteDecision.REJECT)
    defer_count = sum(1 for v in committee.votes if v.vote == VoteDecision.DEFER)

    return ICCommitteeResponse(
        id=committee.id,
        project_id=committee.project_id,
        ein_id=committee.ein_id,
        scheduled_date=committee.scheduled_date,
        meeting_type=committee.meeting_type,
        status=committee.status,
        decision=committee.decision,
        decision_notes=committee.decision_notes,
        quorum_required=committee.quorum_required,
        quorum_met=committee.quorum_met,
        vote_count=len(committee.votes),
        approve_count=approve_count,
        reject_count=reject_count,
        defer_count=defer_count,
        created_at=committee.created_at,
        completed_at=committee.completed_at,
        votes=votes
    )
