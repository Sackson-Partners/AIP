"""
AIP Investment Committee (IC) Governance Router
Manages IC scheduling, voting, and decision records.

Endpoints:
    POST /api/ic/committees                      Schedule new IC session
    GET  /api/ic/committees                      List all IC sessions
    GET  /api/ic/committees/{committee_id}        IC session detail + votes
    POST /api/ic/committees/{committee_id}/vote   Submit vote
    POST /api/ic/committees/{committee_id}/decide  Record final outcome
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    InfrastructureProject,
    InvestmentCommittee,
    ICVote,
    ExecutiveNote,
    User,
)
from backend.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ic", tags=["IC Governance"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class ICScheduleRequest(BaseModel):
    project_id:      str
    ein_id:          Optional[str] = None
    scheduled_date:  Optional[datetime] = None
    quorum_required: int = Field(default=3, ge=1)


class VoteRequest(BaseModel):
    vote:       str = Field(..., description="approve | reject | abstain | defer")
    rationale:  Optional[str] = None
    conditions: Optional[str] = None


class DecideRequest(BaseModel):
    outcome:       str = Field(..., description="approved | rejected | deferred")
    outcome_notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/committees", status_code=201)
async def schedule_ic(
    payload:      ICScheduleRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Schedule a new IC session for a project."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == payload.project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.ein_id:
        ein = db.query(ExecutiveNote).filter(
            ExecutiveNote.id == payload.ein_id
        ).first()
        if not ein:
            raise HTTPException(status_code=404, detail="EIN not found")

    committee = InvestmentCommittee(
        project_id      = payload.project_id,
        ein_id          = payload.ein_id,
        scheduled_date  = payload.scheduled_date,
        quorum_required = payload.quorum_required,
        created_by      = current_user.id,
    )
    db.add(committee)
    db.commit()
    db.refresh(committee)
    logger.info("IC scheduled | project=%s committee=%s", payload.project_id, committee.id)
    return {
        "committee_id":  committee.id,
        "project_id":    committee.project_id,
        "scheduled_date":str(committee.scheduled_date) if committee.scheduled_date else None,
        "status":        committee.status,
    }


@router.get("/committees")
async def list_committees(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """List IC sessions (paginated)."""
    committees = (
        db.query(InvestmentCommittee)
        .order_by(InvestmentCommittee.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Preload projects in bulk to avoid N+1
    project_ids  = [c.project_id for c in committees]
    projects_map = {
        p.id: p
        for p in db.query(InfrastructureProject).filter(
            InfrastructureProject.id.in_(project_ids)
        ).all()
    } if project_ids else {}

    result = []
    for c in committees:
        project    = projects_map.get(c.project_id)
        vote_count = db.query(ICVote).filter(ICVote.committee_id == c.id).count()
        result.append({
            "committee_id":  c.id,
            "project_id":    c.project_id,
            "project_name":  project.project_name if project else None,
            "status":        c.status,
            "outcome":       c.outcome,
            "scheduled_date":str(c.scheduled_date) if c.scheduled_date else None,
            "vote_count":    vote_count,
            "quorum":        c.quorum_required,
        })
    return result


@router.get("/committees/{committee_id}")
async def get_committee(
    committee_id: str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """IC session detail including all votes."""
    committee = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.id == committee_id
    ).first()
    if not committee:
        raise HTTPException(status_code=404, detail="IC session not found")

    votes = db.query(ICVote).filter(ICVote.committee_id == committee_id).all()
    vote_summary = {
        "approve": sum(1 for v in votes if v.vote == "approve"),
        "reject":  sum(1 for v in votes if v.vote == "reject"),
        "abstain": sum(1 for v in votes if v.vote == "abstain"),
        "defer":   sum(1 for v in votes if v.vote == "defer"),
    }
    quorum_met = len(votes) >= committee.quorum_required

    return {
        "committee_id":    committee.id,
        "project_id":      committee.project_id,
        "ein_id":          committee.ein_id,
        "status":          committee.status,
        "outcome":         committee.outcome,
        "outcome_notes":   committee.outcome_notes,
        "scheduled_date":  str(committee.scheduled_date) if committee.scheduled_date else None,
        "quorum_required": committee.quorum_required,
        "quorum_met":      quorum_met,
        "vote_summary":    vote_summary,
        "votes": [
            {
                "voter_id":   v.voter_id,
                "vote":       v.vote,
                "rationale":  v.rationale,
                "conditions": v.conditions,
                "voted_at":   str(v.voted_at),
            }
            for v in votes
        ],
    }


@router.post("/committees/{committee_id}/vote")
async def submit_vote(
    committee_id: str,
    payload:      VoteRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Submit an IC vote."""
    committee = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.id == committee_id
    ).first()
    if not committee:
        raise HTTPException(status_code=404, detail="IC session not found")
    if committee.status not in ("scheduled", "in_progress"):
        raise HTTPException(status_code=400, detail="IC session is not accepting votes")

    valid_votes = {"approve", "reject", "abstain", "defer"}
    if payload.vote not in valid_votes:
        raise HTTPException(status_code=400, detail=f"Vote must be one of {valid_votes}")

    # Check for duplicate vote
    existing = db.query(ICVote).filter(
        ICVote.committee_id == committee_id,
        ICVote.voter_id     == current_user.id,
    ).first()
    if existing:
        existing.vote       = payload.vote
        existing.rationale  = payload.rationale
        existing.conditions = payload.conditions
        existing.voted_at   = datetime.now(timezone.utc)
        db.commit()
        return {"status": "vote_updated", "vote": payload.vote}

    vote = ICVote(
        committee_id = committee_id,
        voter_id     = current_user.id,
        vote         = payload.vote,
        rationale    = payload.rationale,
        conditions   = payload.conditions,
    )
    db.add(vote)
    committee.status = "in_progress"
    db.commit()
    logger.info("IC vote submitted | committee=%s voter=%s vote=%s",
                committee_id, current_user.id, payload.vote)
    return {"status": "vote_recorded", "vote": payload.vote}


@router.post("/committees/{committee_id}/decide")
async def record_decision(
    committee_id: str,
    payload:      DecideRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Record the final IC decision outcome."""
    committee = db.query(InvestmentCommittee).filter(
        InvestmentCommittee.id == committee_id
    ).first()
    if not committee:
        raise HTTPException(status_code=404, detail="IC session not found")

    valid_outcomes = {"approved", "rejected", "deferred"}
    if payload.outcome not in valid_outcomes:
        raise HTTPException(status_code=400, detail=f"Outcome must be one of {valid_outcomes}")

    committee.outcome       = payload.outcome
    committee.outcome_notes = payload.outcome_notes
    committee.status        = "decided"
    db.commit()
    logger.info("IC decision recorded | committee=%s outcome=%s", committee_id, payload.outcome)
    return {"status": "decided", "committee_id": committee_id, "outcome": payload.outcome}


# ── Root route fix ─────────────────────────────────────
@router.get("", tags=["IC"])
async def ic_root(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List all Investment Committee sessions."""
    from backend.models import InvestmentCommittee
    committees = db.query(InvestmentCommittee).limit(50).all()
    return {"committees": committees, "count": len(committees)}


@router.get("", tags=["IC Governance"])
async def ic_root(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List all Investment Committee sessions."""
    from backend.models import InvestmentCommittee
    try:
        committees = db.query(InvestmentCommittee).limit(50).all()
        return {"committees": [{"id": str(c.id)} for c in committees], "count": len(committees)}
    except Exception as e:
        return {"committees": [], "count": 0, "note": str(e)}


@router.get("", tags=["IC Governance"])
async def ic_root(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """IC root."""
    try:
        from backend.models import InvestmentCommittee
        items = db.query(InvestmentCommittee).limit(50).all()
        return {"committees": [{"id": str(c.id)} for c in items], "count": len(items)}
    except Exception as e:
        return {"committees": [], "count": 0, "error": str(e)}


@router.get("")
async def ic_root(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        from backend.models import InvestmentCommittee
        items = db.query(InvestmentCommittee).limit(50).all()
        return {"committees": [{"id": str(c.id)} for c in items], "count": len(items)}
    except Exception as e:
        return {"committees": [], "count": 0}
