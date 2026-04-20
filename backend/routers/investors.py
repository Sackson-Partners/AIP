"""
AIP Investors Router
---------------------
Investor profile management for the AIP platform.

Endpoints:
    GET  /api/investors           - List investor profiles
    GET  /api/investors/{id}      - Get investor profile
    POST /api/investors           - Register investor profile
    PUT  /api/investors/{id}      - Update investor profile
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Investor
from backend.security.auth import get_current_user
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/investors", tags=["Investors"])


class InvestorCreate(BaseModel):
    organisation_name: str
    investor_type: Optional[str] = None
    aum_usd: Optional[str] = None
    focus_sectors: Optional[list[str]] = None
    focus_regions: Optional[list[str]] = None
    min_ticket_usd: Optional[str] = None
    max_ticket_usd: Optional[str] = None
    preferred_structures: Optional[list[str]] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    website: Optional[str] = None


@router.get("")
async def list_investors(
    investor_type: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """List active investor profiles with optional filtering."""
    import json

    query = db.query(Investor).filter(Investor.is_active == True)
    if investor_type:
        query = query.filter(Investor.investor_type == investor_type)
    investors = query.offset(offset).limit(limit).all()
    return {"investors": investors, "count": len(investors)}


@router.get("/{investor_id}")
async def get_investor(investor_id: str, db: Session = Depends(get_db)):
    """Return full profile for a single investor."""
    investor = db.query(Investor).filter(Investor.id == investor_id).first()
    if not investor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investor not found.")
    return investor


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_investor(
    investor_in: InvestorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new investor profile."""
    import json

    investor = Investor(
        user_id=current_user.id,
        organisation_name=investor_in.organisation_name,
        investor_type=investor_in.investor_type,
        aum_usd=investor_in.aum_usd,
        focus_sectors=json.dumps(investor_in.focus_sectors or []),
        focus_regions=json.dumps(investor_in.focus_regions or []),
        min_ticket_usd=investor_in.min_ticket_usd,
        max_ticket_usd=investor_in.max_ticket_usd,
        preferred_structures=json.dumps(investor_in.preferred_structures or []),
        contact_name=investor_in.contact_name,
        contact_email=investor_in.contact_email,
        website=investor_in.website,
    )
    db.add(investor)
    db.commit()
    db.refresh(investor)
    return investor
