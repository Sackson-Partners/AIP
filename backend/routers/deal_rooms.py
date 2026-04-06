"""
AIP Deal Rooms Router
----------------------
Collaborative deal negotiation and due diligence spaces.

Endpoints:
    GET    /api/deal-rooms                          - List deal rooms
    GET    /api/deal-rooms/{id}                     - Get deal room detail
    POST   /api/deal-rooms                          - Create deal room (admin)

    GET    /api/deal-rooms/{id}/messages            - Get messages
    POST   /api/deal-rooms/{id}/messages            - Post message

    GET    /api/deal-rooms/{id}/members             - List members
    POST   /api/deal-rooms/{id}/members             - Add member
    DELETE /api/deal-rooms/{id}/members/{user_id}   - Remove member

    GET    /api/deal-rooms/{id}/documents           - List documents
    POST   /api/deal-rooms/{id}/documents           - Upload document record
    DELETE /api/deal-rooms/{id}/documents/{doc_id}  - Delete document

    GET    /api/deal-rooms/{id}/meetings            - List meetings
    POST   /api/deal-rooms/{id}/meetings            - Schedule meeting
    PATCH  /api/deal-rooms/{id}/meetings/{mid}      - Update meeting
    DELETE /api/deal-rooms/{id}/meetings/{mid}      - Cancel meeting
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    DealRoom, DealRoomMessage,
    DealRoomMember, DealRoomDocument, DealRoomMeeting,
    User,
)
from backend.security.auth import get_current_user, require_admin
from backend.models import _uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/deal-rooms", tags=["Deal Rooms"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class DealRoomCreate(BaseModel):
    project_id:        str
    name:              str
    description:       Optional[str]      = None
    status:            Optional[str]      = "active"
    deal_value:        Optional[float]    = None
    deal_currency:     Optional[str]      = "USD"
    target_close_date: Optional[datetime] = None
    is_video_enabled:  bool               = True
    is_chat_enabled:   bool               = True
    require_nda:       bool               = False
    room_type:         Optional[str]      = "standard"
    max_participants:  Optional[int]      = 50


class MessageCreate(BaseModel):
    content:      str
    message_type: Optional[str] = "text"


class MemberCreate(BaseModel):
    user_id: str
    role:    Optional[str] = "viewer"


class DocumentCreate(BaseModel):
    file_name:   str
    file_url:    str
    file_size:   Optional[int] = None
    file_type:   Optional[str] = None
    requires_nda:bool = False


class MeetingCreate(BaseModel):
    title:        str
    scheduled_at: datetime
    duration_mins:Optional[int] = 60
    meeting_url:  Optional[str] = None
    notes:        Optional[str] = None


class MeetingUpdate(BaseModel):
    title:        Optional[str]      = None
    scheduled_at: Optional[datetime] = None
    duration_mins:Optional[int]      = None
    meeting_url:  Optional[str]      = None
    status:       Optional[str]      = None
    notes:        Optional[str]      = None


# ---------------------------------------------------------------------------
# Serialisers
# ---------------------------------------------------------------------------

def _room_to_dict(r: DealRoom) -> dict:
    return {
        "id":               r.id,
        "project_id":       r.project_id,
        "name":             r.name,
        "description":      r.description,
        "status":           r.status,
        "deal_value":       float(r.deal_value) if r.deal_value is not None else None,
        "deal_currency":    r.deal_currency or "USD",
        "target_close_date":r.target_close_date.isoformat() if r.target_close_date else None,
        "is_video_enabled": r.is_video_enabled if r.is_video_enabled is not None else True,
        "is_chat_enabled":  r.is_chat_enabled  if r.is_chat_enabled  is not None else True,
        "require_nda":      r.require_nda      if r.require_nda      is not None else False,
        "nda_document_url": r.nda_document_url,
        "room_type":        r.room_type or "standard",
        "max_participants": r.max_participants or 50,
        "created_by":       r.created_by,
        "created_at":       r.created_at.isoformat() if r.created_at else None,
        "updated_at":       r.updated_at.isoformat() if r.updated_at else None,
    }


def _get_room_or_404(room_id: str, db: Session) -> DealRoom:
    room = db.query(DealRoom).filter(DealRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Deal room not found.")
    return room


# ---------------------------------------------------------------------------
# Deal room CRUD
# ---------------------------------------------------------------------------

@router.get("")
async def list_deal_rooms(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active deal rooms (paginated)."""
    rooms = (
        db.query(DealRoom)
        .filter(DealRoom.status == "active")
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"deal_rooms": [_room_to_dict(r) for r in rooms], "count": len(rooms)}


@router.get("/{room_id}")
async def get_deal_room(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return deal room details."""
    return _room_to_dict(_get_room_or_404(room_id, db))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_deal_room(
    room_in: DealRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new deal room for a project (admin only)."""
    room = DealRoom(**room_in.model_dump(), created_by=current_user.id)
    db.add(room)
    db.commit()
    db.refresh(room)
    logger.info("Deal room created: %s", room.name)
    return _room_to_dict(room)


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

@router.get("/{room_id}/messages")
async def get_messages(
    room_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return paginated messages for a deal room."""
    _get_room_or_404(room_id, db)
    messages = (
        db.query(DealRoomMessage)
        .filter(DealRoomMessage.deal_room_id == room_id)
        .order_by(DealRoomMessage.created_at.asc())
        .offset(offset).limit(limit).all()
    )
    return {
        "messages": [
            {
                "id":           m.id,
                "deal_room_id": m.deal_room_id,
                "user_id":      m.user_id,
                "message":      m.content,
                "content":      m.content,
                "message_type": m.message_type,
                "created_at":   m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
        "count": len(messages),
    }


@router.post("/{room_id}/messages", status_code=status.HTTP_201_CREATED)
async def post_message(
    room_id: str,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Post a message to a deal room."""
    _get_room_or_404(room_id, db)
    msg = DealRoomMessage(
        deal_room_id=room_id,
        user_id=current_user.id,
        content=msg_in.content,
        message_type=msg_in.message_type,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id, "deal_room_id": msg.deal_room_id,
        "user_id": msg.user_id, "message": msg.content,
        "message_type": msg.message_type,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

@router.get("/{room_id}/members")
async def list_members(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all members of a deal room."""
    _get_room_or_404(room_id, db)
    members = db.query(DealRoomMember).filter(DealRoomMember.deal_room_id == room_id).all()
    return [
        {
            "id":          m.id,
            "deal_room_id":m.deal_room_id,
            "user_id":     m.user_id,
            "role":        m.role,
            "joined_at":   m.joined_at.isoformat() if m.joined_at else None,
            "invited_by":  m.invited_by,
        }
        for m in members
    ]


@router.post("/{room_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    room_id: str,
    member_in: MemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a user to a deal room."""
    _get_room_or_404(room_id, db)
    existing = db.query(DealRoomMember).filter(
        DealRoomMember.deal_room_id == room_id,
        DealRoomMember.user_id == member_in.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member.")
    member = DealRoomMember(
        id=_uuid(),
        deal_room_id=room_id,
        user_id=member_in.user_id,
        role=member_in.role,
        invited_by=current_user.id,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return {
        "id": member.id, "deal_room_id": member.deal_room_id,
        "user_id": member.user_id, "role": member.role,
        "joined_at": member.joined_at.isoformat() if member.joined_at else None,
        "invited_by": member.invited_by,
    }


@router.delete("/{room_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    room_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a user from a deal room."""
    member = db.query(DealRoomMember).filter(
        DealRoomMember.deal_room_id == room_id,
        DealRoomMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    db.delete(member)
    db.commit()


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

@router.get("/{room_id}/documents")
async def list_documents(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all documents in a deal room."""
    _get_room_or_404(room_id, db)
    docs = db.query(DealRoomDocument).filter(DealRoomDocument.deal_room_id == room_id).all()
    return [
        {
            "id":           d.id,
            "deal_room_id": d.deal_room_id,
            "uploaded_by":  d.uploaded_by,
            "file_name":    d.file_name,
            "file_url":     d.file_url,
            "file_size":    d.file_size,
            "file_type":    d.file_type,
            "requires_nda": d.requires_nda,
            "uploaded_at":  d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


@router.post("/{room_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    room_id: str,
    doc_in: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a document upload in a deal room."""
    _get_room_or_404(room_id, db)
    doc = DealRoomDocument(
        id=_uuid(),
        deal_room_id=room_id,
        uploaded_by=current_user.id,
        **doc_in.model_dump(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {
        "id": doc.id, "deal_room_id": doc.deal_room_id,
        "file_name": doc.file_name, "file_url": doc.file_url,
        "file_size": doc.file_size, "file_type": doc.file_type,
        "requires_nda": doc.requires_nda,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
    }


@router.delete("/{room_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    room_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document from a deal room."""
    doc = db.query(DealRoomDocument).filter(
        DealRoomDocument.id == doc_id,
        DealRoomDocument.deal_room_id == room_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    db.delete(doc)
    db.commit()


# ---------------------------------------------------------------------------
# Meetings
# ---------------------------------------------------------------------------

@router.get("/{room_id}/meetings")
async def list_meetings(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all meetings for a deal room."""
    _get_room_or_404(room_id, db)
    meetings = (
        db.query(DealRoomMeeting)
        .filter(DealRoomMeeting.deal_room_id == room_id)
        .order_by(DealRoomMeeting.scheduled_at.asc())
        .all()
    )
    return [_meeting_to_dict(m) for m in meetings]


@router.post("/{room_id}/meetings", status_code=status.HTTP_201_CREATED)
async def schedule_meeting(
    room_id: str,
    meeting_in: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule a meeting in a deal room."""
    _get_room_or_404(room_id, db)
    meeting = DealRoomMeeting(
        id=_uuid(),
        deal_room_id=room_id,
        created_by=current_user.id,
        **meeting_in.model_dump(),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return _meeting_to_dict(meeting)


@router.patch("/{room_id}/meetings/{meeting_id}")
async def update_meeting(
    room_id: str,
    meeting_id: str,
    update_in: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a scheduled meeting."""
    meeting = db.query(DealRoomMeeting).filter(
        DealRoomMeeting.id == meeting_id,
        DealRoomMeeting.deal_room_id == room_id,
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    for field, value in update_in.model_dump(exclude_none=True).items():
        setattr(meeting, field, value)
    db.commit()
    db.refresh(meeting)
    return _meeting_to_dict(meeting)


@router.delete("/{room_id}/meetings/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_meeting(
    room_id: str,
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel / delete a meeting."""
    meeting = db.query(DealRoomMeeting).filter(
        DealRoomMeeting.id == meeting_id,
        DealRoomMeeting.deal_room_id == room_id,
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    db.delete(meeting)
    db.commit()


def _meeting_to_dict(m: DealRoomMeeting) -> dict:
    return {
        "id":           m.id,
        "deal_room_id": m.deal_room_id,
        "created_by":   m.created_by,
        "title":        m.title,
        "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
        "duration_mins":m.duration_mins,
        "meeting_url":  m.meeting_url,
        "status":       m.status,
        "notes":        m.notes,
        "created_at":   m.created_at.isoformat() if m.created_at else None,
    }
