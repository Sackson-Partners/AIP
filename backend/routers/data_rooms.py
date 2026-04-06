"""
AIP Data Rooms Router
----------------------
Secure document repositories for infrastructure projects.

Endpoints:
    GET  /api/data-rooms                     - List data rooms
    GET  /api/data-rooms/{id}                - Get data room details
    POST /api/data-rooms                     - Create data room (admin)
    POST /api/data-rooms/{id}/documents      - Upload document to data room
    GET  /api/data-rooms/{id}/documents      - List documents in data room
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import DataRoom, DataRoomDocument
from backend.security.auth import get_current_user, require_admin
from backend.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/data-rooms", tags=["Data Rooms"])


class DataRoomCreate(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None
    access_level: Optional[str] = "restricted"


@router.get("")
async def list_data_rooms(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active data rooms (paginated)."""
    rooms = (
        db.query(DataRoom)
        .filter(DataRoom.is_active == True)  # noqa: E712
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"data_rooms": rooms, "count": len(rooms)}


@router.get("/{room_id}")
async def get_data_room(room_id: str, db: Session = Depends(get_db)):
    """Return data room details including document list."""
    room = db.query(DataRoom).filter(DataRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found.")
    return room


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_data_room(
    room_in: DataRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new data room for a project (admin only)."""
    room = DataRoom(**room_in.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    logger.info("Data room created: %s by %s", room.name, current_user.email)
    return room


@router.get("/{room_id}/documents")
async def list_documents(room_id: str, db: Session = Depends(get_db)):
    """List all active documents in a data room."""
    docs = (
        db.query(DataRoomDocument)
        .filter(
            DataRoomDocument.data_room_id == room_id,
            DataRoomDocument.is_active == True,
        )
        .all()
    )
    return {"documents": docs, "count": len(docs)}


@router.post("/{room_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    room_id: str,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a document to a data room.
    Files are stored in Azure Blob Storage; URL is saved to the database.
    """
    import os

    room = db.query(DataRoom).filter(DataRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Data room not found.")

    # Azure Blob Storage upload
    azure_blob_url = None
    azure_conn = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if azure_conn:
        try:
            from azure.storage.blob import BlobServiceClient

            container = os.getenv("AZURE_STORAGE_CONTAINER", "aip-documents")
            blob_name = f"{room_id}/{file.filename}"
            service = BlobServiceClient.from_connection_string(azure_conn)
            blob_client = service.get_blob_client(container=container, blob=blob_name)
            contents = await file.read()
            blob_client.upload_blob(contents, overwrite=True)
            azure_blob_url = blob_client.url
        except Exception as exc:
            logger.error("Azure upload failed: %s", exc)

    doc = DataRoomDocument(
        data_room_id=room_id,
        file_name=file.filename,
        file_type=file.content_type,
        azure_blob_url=azure_blob_url,
        uploaded_by=current_user.id,
        description=description,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
