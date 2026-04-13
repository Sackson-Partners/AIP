"""Notifications router — per-user notification feed."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Notification
from backend.security.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: str
    text: str
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[NotificationOut])
def list_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return up to 20 notifications for the current user, unread first."""
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        NotificationOut(
            id=n.id,
            text=n.text,
            is_read=n.is_read,
            created_at=n.created_at.isoformat() if n.created_at else "",
        )
        for n in rows
    ]


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return NotificationOut(
        id=notif.id,
        text=notif.text,
        is_read=notif.is_read,
        created_at=notif.created_at.isoformat() if notif.created_at else "",
    )


@router.patch("/read-all", status_code=204)
def mark_all_read(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications for the current user as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read.is_(False),
    ).update({"is_read": True})
    db.commit()
