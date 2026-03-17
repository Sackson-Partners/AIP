"""
AIP Verifications Router
-------------------------
User identity and accreditation verification flow.

Endpoints:
    POST /api/verifications              - Submit verification request
    GET  /api/verifications/status       - Check own verification status
    GET  /api/verifications              - List all verifications (admin)
    PUT  /api/verifications/{id}/review  - Approve or reject (admin)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Verification
from backend.security.auth import get_current_user, require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verifications", tags=["Verifications"])


class VerificationCreate(BaseModel):
    verification_type: str  # email | identity | accreditation
    document_url: Optional[str] = None


class VerificationReview(BaseModel):
    status: str  # approved | rejected
    reviewer_notes: Optional[str] = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_verification(
    ver_in: VerificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a verification request."""
    verification = Verification(
        user_id=current_user.id,
        verification_type=ver_in.verification_type,
        document_url=ver_in.document_url,
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)
    return verification


@router.get("/status")
async def verification_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's verification records."""
    verifications = (
        db.query(Verification).filter(Verification.user_id == current_user.id).all()
    )
    return {"verifications": verifications}


@router.get("")
async def list_verifications(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all verification requests (admin only)."""
    query = db.query(Verification)
    if status:
        query = query.filter(Verification.status == status)
    verifications = query.all()
    return {"verifications": verifications, "count": len(verifications)}



@router.put("/{ver_id}/review")
async def review_verification(
    ver_id: str,
    review: VerificationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Approve or reject a verification request (admin only)."""
    from datetime import datetime, timezone

    ver = db.query(Verification).filter(Verification.id == ver_id).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Verification not found.")

    ver.status = review.status
    ver.reviewer_notes = review.reviewer_notes
    ver.reviewed_at = datetime.now(timezone.utc)

    # If approved, mark the user as verified
    if review.status == "approved":
        user = db.query(User).filter(User.id == ver.user_id).first()
        if user:
            user.is_verified = True

    db.commit()
    db.refresh(ver)
    return ver