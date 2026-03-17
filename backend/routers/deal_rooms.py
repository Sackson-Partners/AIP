"""
AIP Deal Rooms Router
----------------------
Collaborative deal negotiation and due diligence spaces.

Endpoints:
    GET  /api/deal-rooms                - List deal rooms
    GET  /api/deal-rooms/{id}           - Get deal room with messages
    POST /api/deal-rooms                - Create deal room (admin)
    POST /api/deal-rooms/{id}/messages  - Post a message to a deal room
    GET  /api/deal-rooms/{id}/messages  - Get messages for a deal room
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DealRoom, DealRoomMessage
from backend.security.auth import get_current_user, require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/deal-rooms", tags=["Deal Rooms"])


class DealRoomCreate(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None


class MessageCreate(BaseModel):
    content: str
    message_type: Optional[str] = "text"


@router.get("")
async def list_deal_rooms(db: Session = Depends(get_db)):
    """List all active deal rooms."""
    rooms = db.query(DealRoom).filter(DealRoom.status == "active").all()
    return {"deal_rooms": rooms, "count": len(rooms)}


@router.get("/{room_id}")
async def get_deal_room(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return deal room details."""
    room = db.query(DealRoom).filter(DealRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Deal room not found.")
    return room


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_deal_room(
    room_in: DealRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new deal room for a project (admin only)."""
    room = DealRoom(**room_in.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    logger.info("Deal room created: %s", room.name)
    return room


@router.get("/{room_id}/messages")
async def get_messages(
    room_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return paginated messages for a deal room."""
    messages = (
        db.query(DealRoomMessage)
        .filter(DealRoomMessage.deal_room_id == room_id)
        .order_by(DealRoomMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"messages": messages, "count": len(messages)}


@router.post("/{room_id}/messages", status_code=status.HTTP_201_CREATED)
async def post_message(
    room_id: str,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Post a message to a deal room."""
    room = db.query(DealRoom).filter(DealRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Deal room not found.")

    msg = DealRoomMessage(
        deal_room_id=room_id,
        user_id=current_user.id,
        content=msg_in.content,
        message_type=msg_in.message_type,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
