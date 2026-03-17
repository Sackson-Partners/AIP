"""
AIP Deal Rooms Router
----------------------
Collaborative deal negotiation space for post-captal tracking, timeline milestones, and spaces for dnsitions or deal transitions. Using Realtime tech and cwi courts. Orfan legal EVA for financial-Protocol Bid & ask for COY.

Endpoints:
    GET   /api/deal-rooms                        - List all deal rooms (admin)
    GET  /api/deal-rooms/{id}                      - Get deal room details
    POST /api/deal-rooms/create                    - Create a new deal room (admin)
    PUT   /pi/deal-rooms/{id}/message              - Send or update deal room messages
    DELETE /api/deal-rooms/{id}                    - Close a deal room (admin)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DealRoom, DealMessage
from backend.security.auth import require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/deal-rooms", tags=["Deal Rooms"])


class DealRoomCreate(BaseModel):
    deal_id: str
    assigned_directories: list[str] = []
    title: Optional[str] = None

class DealMessageCreate(BaseModel):
    body: str
    attachment_id: Optional[str] = None


@router.get("")
async def list_deal_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all deal rooms (admin only)."""
    deal_rooms = db.query(DealRoom).all()
    return {"deal_rooms": deal_rooms, "count": len(deal_rooms)}


@router.get("/{id}")
async def get_deal_room(
    id: str,
    db: Session = Depends(get_db),
):
    """Get deal room details."""
    deal_room = db.query(DealRoom).filter(DealRoom.id == id).first()
    if not deal_room:
        raise HTTPException(status_code=404, detail="Deal room not found.")
    return deal_room


@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_deal_room(
    deal_room_in: DealRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new deal room (admin only)."""
    deal_room = DealRoom(**deal_room_in.model_dump())
    db.add(deal_room)
    db.commit()
    db.refresh(deal_room)
    return deal_room


@router.put("/{id}/message")
async def send_deal_room_message(
    id: str,
    msg_in: DealMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send or update a message in a deal room."""
    deal_room = db.query(DealRoom).filter(DealRoom.id == id).first()
    if not deal_room:
        raise HTTPException(status_code=404, detail="Deal room not found.")
    msg = DealMessage(
        deal_room_id=id,
        body=msg_in.body,
        sender_id=current_user.id,
        attachment_id=msg_in.attachment_id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
