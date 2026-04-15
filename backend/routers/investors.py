"""
AIP Investors Router
---------------------
Investor profile management for the AIP platform.

Endpoints:
    GET   /api/investors           - List investor profiles
    GET   /api/investors/{id}      - Get investor profile
    POST  /api/investors           - Register investor profile
    PATCH /api/investors/{id}      - Update investor profile
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Investor
from backend.security.auth import get_current_user, limiter
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/investors", tags=["Investors"])


class InvestorCreate(BaseModel):
    organisation_name: str = Field(..., min_length=1, max_length=255)
    investor_type: Optional[str] = Field(None, max_length=100)
    aum_usd: Optional[str] = Field(None, max_length=50)
    focus_sectors: Optional[list[str]] = None
    focus_regions: Optional[list[str]] = None
    min_ticket_usd: Optional[str] = Field(None, max_length=50)
    max_ticket_usd: Optional[str] = Field(None, max_length=50)
    preferred_structures: Optional[list[str]] = None
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=500)


class InvestorUpdate(BaseModel):
    organisation_name: Optional[str] = Field(None, min_length=1, max_length=255)
    investor_type: Optional[str] = Field(None, max_length=100)
    aum_usd: Optional[str] = Field(None, max_length=50)
    focus_sectors: Optional[list[str]] = None
    focus_regions: Optional[list[str]] = None
    min_ticket_usd: Optional[str] = Field(None, max_length=50)
    max_ticket_usd: Optional[str] = Field(None, max_length=50)
    preferred_structures: Optional[list[str]] = None
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


@router.get("")
async def list_investors(
    investor_type: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active investor profiles with optional filtering."""
    query = db.query(Investor).filter(Investor.is_active == True)
    if investor_type:
        query = query.filter(Investor.investor_type == investor_type)
    investors = query.offset(offset).limit(limit).all()
    return {"investors": investors, "count": len(investors)}


@router.get("/{investor_id}")
async def get_investor(
    investor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full profile for a single investor."""
    investor = db.query(Investor).filter(Investor.id == investor_id).first()
    if not investor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investor not found.")
    return investor


@limiter.limit("30/minute")
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_investor(
    request: Request,
    investor_in: InvestorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new investor profile."""
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


@limiter.limit("30/minute")
@router.patch("/{investor_id}")
async def update_investor(
    request: Request,
    investor_id: str,
    investor_in: InvestorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing investor profile."""
    investor = db.query(Investor).filter(Investor.id == investor_id).first()
    if not investor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investor not found.")

    data = investor_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in ("focus_sectors", "focus_regions", "preferred_structures"):
            setattr(investor, field, json.dumps(value or []))
        else:
            setattr(investor, field, value)

    db.commit()
    db.refresh(investor)
    return investor
