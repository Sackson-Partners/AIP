"""
Data Room Router - Secure Document Access with NDA Tracking
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import json

from backend.database import get_db
from backend.models import (
    DataRoomV2, DataRoomFolder, DataRoomDocumentV2, DataRoomAccess, DataRoomActivity,
    DataRoomAccessLevel, NDAStatus, User, Project, BlockchainCertificate
)
from backend.auth import get_current_user
from backend.services.blockchain import blockchain_service
from backend.services.ai_service import ai_service, DocumentAnalysisType
from pydantic import BaseModel


router = APIRouter(prefix="/data-rooms", tags=["data-rooms"])


# ============================================================================
# SCHEMAS
# ============================================================================

class DataRoomCreate(BaseModel):
    project_id: int
    name: Optional[str] = ""
    description: Optional[str] = None
    require_nda: bool = True
    require_verification: bool = False
    min_verification_level: Optional[str] = None
    enable_watermark: bool = True
    allow_download: bool = False
    allow_print: bool = False


class DataRoomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    require_nda: Optional[bool] = None
    allow_download: Optional[bool] = None
    allow_print: Optional[bool] = None
    status: Optional[str] = None


class FolderCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    access_level: Optional[str] = None


class DocumentCreate(BaseModel):
    folder_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    document_category: Optional[str] = None
    file_name: str
    file_url: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    is_confidential: bool = False


class AccessGrant(BaseModel):
    user_id: int
    access_level: str = "view_only"
    access_expires_days: Optional[int] = None
    allowed_folders: Optional[List[int]] = None


class NDASignature(BaseModel):
    signature_data: str
    ip_address: Optional[str] = None


class DataRoomResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str]
    is_public: bool
    require_nda: bool
    enable_watermark: bool
    allow_download: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# DATA ROOM CRUD
# ============================================================================

@router.post("/", response_model=DataRoomResponse)
async def create_data_room(
    data: DataRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new data room for a project"""
    project = db.query(Project).filter(Project.id == data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    data_room = DataRoomV2(
        project_id=data.project_id,
        name=data.name,
        description=data.description,
        require_nda=data.require_nda,
        require_verification=data.require_verification,
        enable_watermark=data.enable_watermark,
        allow_download=data.allow_download,
        allow_print=data.allow_print,
        created_by_id=current_user.id
    )

    db.add(data_room)
    db.commit()
    db.refresh(data_room)

    # Create default folders
    default_folders = ["Financial Documents", "Legal Documents", "Technical Documents", "Corporate Documents", "Miscellaneous"]
    for i, folder_name in enumerate(default_folders):
        folder = DataRoomFolder(data_room_id=data_room.id, name=folder_name, order=i)
        db.add(folder)
    db.commit()

    return data_room


@router.get("/", response_model=List[DataRoomResponse])
async def list_data_rooms(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List data rooms"""
    query = db.query(DataRoomV2)
    if project_id:
        query = query.filter(DataRoomV2.project_id == project_id)
    return query.order_by(DataRoomV2.created_at.desc()).all()


@router.get("/{data_room_id}")
async def get_data_room(
    data_room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get data room details with folder structure"""
    data_room = db.query(DataRoomV2).filter(DataRoomV2.id == data_room_id).first()
    if not data_room:
        raise HTTPException(status_code=404, detail="Data room not found")

    folders = db.query(DataRoomFolder).filter(DataRoomFolder.data_room_id == data_room_id).order_by(DataRoomFolder.order).all()
    folder_data = []
    for folder in folders:
        documents = db.query(DataRoomDocumentV2).filter(DataRoomDocumentV2.folder_id == folder.id, DataRoomDocumentV2.is_latest == True).all()
        folder_data.append({
            "id": folder.id,
            "name": folder.name,
            "description": folder.description,
            "document_count": len(documents),
            "documents": [{"id": doc.id, "title": doc.title, "file_name": doc.file_name, "file_size": doc.file_size, "category": doc.document_category, "is_confidential": doc.is_confidential, "uploaded_at": doc.uploaded_at} for doc in documents]
        })

    return {**DataRoomResponse.model_validate(data_room).model_dump(), "folders": folder_data}


# ============================================================================
# FOLDER MANAGEMENT
# ============================================================================

@router.post("/{data_room_id}/folders")
async def create_folder(data_room_id: int, data: FolderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new folder in data room"""
    data_room = db.query(DataRoomV2).filter(DataRoomV2.id == data_room_id).first()
    if not data_room:
        raise HTTPException(status_code=404, detail="Data room not found")

    max_order = db.query(DataRoomFolder).filter(DataRoomFolder.data_room_id == data_room_id).count()
    folder = DataRoomFolder(data_room_id=data_room_id, parent_id=data.parent_id, name=data.name, description=data.description, order=max_order)
    if data.access_level:
        folder.access_level = DataRoomAccessLevel(data.access_level)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return {"id": folder.id, "name": folder.name}


# ============================================================================
# DOCUMENT MANAGEMENT
# ============================================================================

@router.post("/{data_room_id}/documents")
async def upload_document(data_room_id: int, data: DocumentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Upload a document to data room"""
    data_room = db.query(DataRoomV2).filter(DataRoomV2.id == data_room_id).first()
    if not data_room:
        raise HTTPException(status_code=404, detail="Data room not found")

    import hashlib
    doc_hash = hashlib.sha256(f"{data.file_url}{datetime.utcnow().isoformat()}".encode()).hexdigest()

    document = DataRoomDocumentV2(
        data_room_id=data_room_id, folder_id=data.folder_id, title=data.title, description=data.description,
        document_category=data.document_category, file_name=data.file_name, file_url=data.file_url,
        file_size=data.file_size, mime_type=data.mime_type, is_confidential=data.is_confidential,
        document_hash=doc_hash, uploaded_by_id=current_user.id
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # Register on blockchain
    try:
        metadata = blockchain_service.create_document_metadata(
            document_id=document.id, document_name=document.title, document_hash=doc_hash,
            owner_id=current_user.id, verification_level="document",
            additional_data={"data_room_id": data_room_id, "category": data.document_category}
        )
        certificate = await blockchain_service.register_document_hash(doc_hash, metadata)
        if certificate:
            document.blockchain_hash = certificate.document_hash
            document.blockchain_tx = certificate.transaction_hash
            document.blockchain_verified_at = datetime.utcnow()
            bc_cert = BlockchainCertificate(
                certificate_id=certificate.certificate_id, certificate_type="document",
                document_type="data_room_document", document_id=document.id, document_hash=doc_hash,
                network=certificate.network, transaction_hash=certificate.transaction_hash,
                block_number=certificate.block_number, explorer_url=certificate.verification_url,
                cert_metadata=json.dumps(metadata), issued_to_id=current_user.id
            )
            db.add(bc_cert)
        db.commit()
    except Exception as e:
        print(f"Blockchain registration failed: {e}")

    return {"id": document.id, "title": document.title, "document_hash": document.document_hash, "blockchain_tx": document.blockchain_tx}


@router.get("/{data_room_id}/documents/{document_id}")
async def get_document(data_room_id: int, document_id: int, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get document details and record view activity"""
    document = db.query(DataRoomDocumentV2).filter(DataRoomDocumentV2.id == document_id, DataRoomDocumentV2.data_room_id == data_room_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    activity = DataRoomActivity(data_room_id=data_room_id, user_id=current_user.id, document_id=document_id, action="view", ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    db.add(activity)
    document.view_count += 1
    db.commit()

    return {"id": document.id, "title": document.title, "description": document.description, "category": document.document_category, "file_name": document.file_name, "file_url": document.file_url, "file_size": document.file_size, "mime_type": document.mime_type, "version": document.version, "is_confidential": document.is_confidential, "blockchain_hash": document.blockchain_hash, "blockchain_tx": document.blockchain_tx, "ai_summary": document.ai_summary, "view_count": document.view_count, "uploaded_at": document.uploaded_at}


# ============================================================================
# ACCESS & NDA MANAGEMENT
# ============================================================================

@router.post("/{data_room_id}/access")
async def grant_access(data_room_id: int, data: AccessGrant, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Grant access to a user"""
    data_room = db.query(DataRoomV2).filter(DataRoomV2.id == data_room_id).first()
    if not data_room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if data_room.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to grant access")

    existing = db.query(DataRoomAccess).filter(DataRoomAccess.data_room_id == data_room_id, DataRoomAccess.user_id == data.user_id).first()
    if existing:
        existing.access_level = DataRoomAccessLevel(data.access_level)
        existing.access_revoked_at = None
        if data.access_expires_days:
            existing.access_expires_at = datetime.utcnow() + timedelta(days=data.access_expires_days)
        if data.allowed_folders:
            existing.allowed_folders = json.dumps(data.allowed_folders)
        db.commit()
        return {"message": "Access updated", "access_id": existing.id}

    access = DataRoomAccess(
        data_room_id=data_room_id, user_id=data.user_id,
        access_level=DataRoomAccessLevel(data.access_level),
        nda_status=NDAStatus.PENDING if data_room.require_nda else NDAStatus.NOT_REQUIRED,
        granted_by_id=current_user.id
    )
    if data.access_expires_days:
        access.access_expires_at = datetime.utcnow() + timedelta(days=data.access_expires_days)
    if data.allowed_folders:
        access.allowed_folders = json.dumps(data.allowed_folders)
    db.add(access)
    db.commit()
    db.refresh(access)
    return {"message": "Access granted", "access_id": access.id, "nda_required": data_room.require_nda}


@router.get("/{data_room_id}/access")
async def list_access_grants(data_room_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all access grants for a data room"""
    data_room = db.query(DataRoomV2).filter(DataRoomV2.id == data_room_id).first()
    if not data_room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if data_room.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    access_grants = db.query(DataRoomAccess).filter(DataRoomAccess.data_room_id == data_room_id).all()
    result = []
    for access in access_grants:
        user = db.query(User).filter(User.id == access.user_id).first()
        result.append({
            "id": access.id, "user_id": access.user_id, "user_email": user.email if user else None,
            "user_name": user.full_name if user else None, "access_level": access.access_level.value,
            "nda_status": access.nda_status.value, "nda_signed_at": access.nda_signed_at,
            "access_granted_at": access.access_granted_at, "access_expires_at": access.access_expires_at,
            "last_accessed_at": access.last_accessed_at, "total_views": access.total_views,
            "total_downloads": access.total_downloads, "is_revoked": access.access_revoked_at is not None
        })
    return result


@router.post("/{data_room_id}/access/{access_id}/sign-nda")
async def sign_nda(data_room_id: int, access_id: int, data: NDASignature, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Sign NDA for data room access"""
    access = db.query(DataRoomAccess).filter(DataRoomAccess.id == access_id, DataRoomAccess.data_room_id == data_room_id, DataRoomAccess.user_id == current_user.id).first()
    if not access:
        raise HTTPException(status_code=404, detail="Access grant not found")
    if access.nda_status == NDAStatus.SIGNED:
        raise HTTPException(status_code=400, detail="NDA already signed")

    access.nda_status = NDAStatus.SIGNED
    access.nda_signed_at = datetime.utcnow()
    access.nda_ip_address = request.client.host if request.client else data.ip_address
    access.nda_expires_at = datetime.utcnow() + timedelta(days=365)
    db.commit()
    return {"message": "NDA signed successfully", "signed_at": access.nda_signed_at, "expires_at": access.nda_expires_at}


@router.post("/{data_room_id}/access/{access_id}/revoke")
async def revoke_access(data_room_id: int, access_id: int, reason: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Revoke access for a user"""
    data_room = db.query(DataRoomV2).filter(DataRoomV2.id == data_room_id).first()
    if not data_room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if data_room.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    access = db.query(DataRoomAccess).filter(DataRoomAccess.id == access_id, DataRoomAccess.data_room_id == data_room_id).first()
    if not access:
        raise HTTPException(status_code=404, detail="Access grant not found")

    access.access_revoked_at = datetime.utcnow()
    access.revoke_reason = reason
    db.commit()
    return {"message": "Access revoked successfully"}


# ============================================================================
# ACTIVITY TRACKING
# ============================================================================

@router.get("/{data_room_id}/activity")
async def get_activity_log(data_room_id: int, user_id: Optional[int] = None, action: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get activity log for data room"""
    data_room = db.query(DataRoomV2).filter(DataRoomV2.id == data_room_id).first()
    if not data_room:
        raise HTTPException(status_code=404, detail="Data room not found")
    if data_room.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = db.query(DataRoomActivity).filter(DataRoomActivity.data_room_id == data_room_id)
    if user_id:
        query = query.filter(DataRoomActivity.user_id == user_id)
    if action:
        query = query.filter(DataRoomActivity.action == action)

    activities = query.order_by(DataRoomActivity.created_at.desc()).limit(limit).all()
    result = []
    for activity in activities:
        user = db.query(User).filter(User.id == activity.user_id).first()
        document = None
        if activity.document_id:
            doc = db.query(DataRoomDocumentV2).filter(DataRoomDocumentV2.id == activity.document_id).first()
            if doc:
                document = {"id": doc.id, "title": doc.title}
        result.append({"id": activity.id, "user_id": activity.user_id, "user_email": user.email if user else None, "action": activity.action, "document": document, "duration_seconds": activity.duration_seconds, "ip_address": activity.ip_address, "created_at": activity.created_at})
    return result


# ============================================================================
# AI ANALYSIS
# ============================================================================

@router.post("/{data_room_id}/documents/{document_id}/analyze")
async def analyze_document_ai(data_room_id: int, document_id: int, analysis_type: str = "summary", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Run AI analysis on a document"""
    document = db.query(DataRoomDocumentV2).filter(DataRoomDocumentV2.id == document_id, DataRoomDocumentV2.data_room_id == data_room_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    type_map = {"summary": DocumentAnalysisType.SUMMARY, "risk": DocumentAnalysisType.RISK_ANALYSIS, "key_terms": DocumentAnalysisType.KEY_TERMS, "compliance": DocumentAnalysisType.COMPLIANCE_CHECK, "due_diligence": DocumentAnalysisType.DUE_DILIGENCE}
    analysis_enum = type_map.get(analysis_type, DocumentAnalysisType.SUMMARY)
    document_text = f"Document: {document.title}\nCategory: {document.document_category}"
    result = await ai_service.analyze_document(document_text, analysis_enum)

    if analysis_type == "summary":
        document.ai_summary = result.content.get("executive_summary", "")
    elif analysis_type == "key_terms":
        document.ai_key_terms = json.dumps(result.content)
    elif analysis_type == "risk":
        document.ai_risk_analysis = json.dumps(result.content)
    db.commit()

    return {"document_id": document_id, "analysis_type": analysis_type, "result": result.content, "confidence": result.confidence_score}
