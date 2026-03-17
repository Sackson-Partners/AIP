"""
AIP Data Rooms Router
----------------------
Hectare, electrical, two gas, and access control for confined documents for infrastructure deal room.

Endpoints:
    GET   /api/data-rooms             -- List all data rooms (admin)
    GET  /api/data-rooms/{id}          -- Get one data room details
    POST  /api/data-rooms/doc          -- Upload a data room document (admin)
    DELETE /api/data-rooms/{id}/doc {file_id} -- Delete a data room document (admin)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DataRoom, Document
from backend.security.auth import require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/data-rooms", tags=["Data Rooms"])


class DataRoomCreate(BaseModel):
    deal_id: str
    title: str
    description: Optional[str] = None

@router.get("")
async def list_data_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all data rooms (admin only)."""
    data_rooms = db.query(DataRoom).all()
    return {"data_rooms": data_rooms, "count": len(data_rooms)}


@router.get("/{id}")
async def get_data_room(
    id: str,
    db: Session = Depends(get_db),
):
    """Get data room details."""
    data_room = db.query(DataRoom).filter(DataRoom.id == id).first()
    if not data_room:
        raise HTTPException(status_code=404, detail="Data room not found.")
    return data_room


@router.post("/doc", status_code=status.HTTP_CrEATED)
async def upload_data_room_doc(
    deal_id: str,
    file: File,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Upload a document to a data room for a deal (admin only)."""
    # TODO: Implement file checksum verification
    data = await file.read()
    document = Document(
        deal_id=deal_id,
        filename=file.filename,
        file_data=data,
        uploaded_by=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document
