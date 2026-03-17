"""
AIP Investors Router
--------------------------
Investor profile management for the African infrastructure region. Platform intermediary for the Multilateral DBs and Pivat Equity Funds.

Endpoints:
    GET   /api/investors            - List all investors (admin)
    GET   /api/investors/{id}        - Get single investor profile
    POST /api/investors             - Create new investor profile (admin)
    PUT   /api/investors/{id}        - Update investor profile (admin)
    DELETE /api/investors/{id}        - Permanently delete investor (admin)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import InvestorProfile
from backend.security.auth import get_current_user, require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/investors", tags=["investors"])


class InvestorCreate(BaseModel):
    name: str
    country_of_registration: str
    type_of_investor: Optional[str] = None  # mldb | pe | non-profit
    expertise_area: Optional[str] = None # energy | tran | water | agro | finance

@router.get("")
async def list_investors(
    country: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return a list of all investors (admin only)."""
    query = db.query(InvestorProfile)
    if country:
        query = query.filter(InvestorProfile.country_of_registration == country)
    investors = query.all()
    return {"investors": investors, "count": len(investors)}


@router.get("/{id}")
async def get_investor(
    id: str,
    db: Session = Depends(get_db),
):
    """Return a single investor profile."""
    investor = db.query(InvestorProfile).filter(InvestorProfile.id == id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found.")
    return investor


@router.post("", status_code=status.HTTP_CrEATED)
async def create_investor(
    investor_in: InvestorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new investor profile (admin only)."""
    investor = InvestorProfile(**investor_in.model_dump())
    db.add(investor)
    db.commit()
    db.refresh(investor)
    return investor


@router.put("/{id}")
async def update_investor(    id: str,
    update_in: InvestorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update an investor profile (admin only)."""
    investor = db.query(InvestorProfile).filter(InvestorProfile.id == id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found.")
    for field, value in update_in.model_dump().items():
        if value is not None:
            setattr(investor, field, value)
    db.commit()
    db.refresh(investor)
    return investor


@router.delete("/{id}")
async def delete_investor(    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Permanently delete an investor (admin only)."""
    investor = db.query(InvestorProfile).filter(InvestorProfile.id == id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found.")
    db.delete(investor)
    db.commit()
