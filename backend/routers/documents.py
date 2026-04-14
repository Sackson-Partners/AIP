"""
AIP Document Management Router
================================
Secure document upload and retrieval for project data rooms.
Documents are stored in Azure Blob Storage (private containers).
Access is via time-limited signed URLs (15-minute TTL).

Endpoints:
    POST /api/documents/upload/{project_id}   Upload document → Blob → record
    GET  /api/documents/{doc_id}/url          Get 15-min signed download URL
    GET  /api/documents/{project_id}/list     List all documents for a project
    DELETE /api/documents/{doc_id}            Soft-delete a document record
"""

import logging
import os
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import InfrastructureProject, ProjectDocument, User
from backend.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["Document Management"])

# Allowed document types per PRD
ALLOWED_DOC_TYPES = frozenset({
    "pis", "feasibility", "financial_model", "eia",
    "permit", "legal", "offtake_term", "other",
})

MAX_FILE_SIZE_MB = 50  # PRD specification
SIGNED_URL_TTL_MINUTES = 15  # PRD specification


# ---------------------------------------------------------------------------
# Azure Blob Storage helpers (graceful fallback for environments without SDK)
# ---------------------------------------------------------------------------


def _get_blob_service():
    """Return Azure BlobServiceClient if credentials are available, else None."""
    try:
        from azure.storage.blob import BlobServiceClient
        account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
        account_key  = os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
        if account_name and account_key:
            conn_str = (
                f"DefaultEndpointsProtocol=https;"
                f"AccountName={account_name};"
                f"AccountKey={account_key};"
                f"EndpointSuffix=core.windows.net"
            )
            return BlobServiceClient.from_connection_string(conn_str)
    except ImportError:
        pass
    return None


def _upload_to_blob(
    content:        bytes,
    blob_path:      str,
    content_type:   str = "application/octet-stream",
) -> bool:
    """Upload bytes to Azure Blob. Returns True on success, False on failure."""
    container = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "aip-documents")
    svc = _get_blob_service()
    if not svc:
        logger.warning("Azure Blob Storage not configured — document NOT uploaded to cloud")
        return False
    try:
        blob_client = svc.get_blob_client(container=container, blob=blob_path)
        blob_client.upload_blob(content, content_settings=None, overwrite=True)
        logger.info("Blob uploaded | path=%s bytes=%d", blob_path, len(content))
        return True
    except Exception as exc:
        logger.exception("Blob upload failed | path=%s | error=%s", blob_path, exc)
        return False


def _get_signed_url(blob_path: str, ttl_minutes: int = SIGNED_URL_TTL_MINUTES) -> Optional[str]:
    """Generate a SAS signed URL for secure time-limited access."""
    from datetime import datetime, timezone

    container = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "aip-documents")
    svc = _get_blob_service()
    if not svc:
        return None
    try:
        from azure.storage.blob import generate_blob_sas, BlobSasPermissions
        account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
        account_key  = os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
        blob_name    = blob_path

        sas_token = generate_blob_sas(
            account_name    = account_name,
            container_name  = container,
            blob_name       = blob_name,
            account_key     = account_key,
            permission      = BlobSasPermissions(read=True),
            expiry          = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        )
        return (
            f"https://{account_name}.blob.core.windows.net/"
            f"{container}/{blob_name}?{sas_token}"
        )
    except Exception as exc:
        logger.exception("Signed URL generation failed | path=%s | error=%s", blob_path, exc)
        return None


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class DocumentResponse(BaseModel):
    id:            str
    project_id:    str
    file_name:     str
    blob_path:     str
    document_type: Optional[str]
    file_size_kb:  Optional[int]
    uploaded_by:   Optional[str]
    uploaded_at:   str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_project_or_404(project_id: str, db: Session) -> InfrastructureProject:
    proj = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj


def _get_doc_or_404(doc_id: str, db: Session) -> ProjectDocument:
    doc = db.query(ProjectDocument).filter(ProjectDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


def _verify_document_access(document: ProjectDocument, current_user: User, db: Session) -> None:
    """Raise 403 if the user has no access to the document's project and is not admin."""
    if current_user.role in ("admin", "super_admin"):
        return
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == document.project_id
    ).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    # Uploader always has access; other users require admin role
    if document.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this document.",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/upload/{project_id}", status_code=201)
async def upload_document(
    project_id:    str,
    file:          UploadFile = File(...),
    document_type: str        = Form(default="other"),
    db:            Session    = Depends(get_db),
    current_user:  User       = Depends(get_current_user),
):
    """
    Upload a project document to Azure Blob Storage.
    Returns a signed URL valid for 15 minutes for immediate access.
    """
    _get_project_or_404(project_id, db)

    # Validate document type
    if document_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"document_type must be one of: {sorted(ALLOWED_DOC_TYPES)}",
        )

    # Read and size-check the file
    content = await file.read()
    size_kb  = len(content) // 1024
    if size_kb > MAX_FILE_SIZE_MB * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum {MAX_FILE_SIZE_MB}MB.",
        )

    # Build the blob path: /projects/{project_id}/documents/{type}/{doc_id}
    from backend.models import _uuid as new_uuid
    doc_id    = new_uuid()
    blob_path = f"projects/{project_id}/documents/{document_type}/{doc_id}/{file.filename}"

    # Upload to Azure Blob (non-fatal if storage not configured)
    content_type = file.content_type or "application/octet-stream"
    uploaded     = _upload_to_blob(content, blob_path, content_type)
    if not uploaded:
        logger.warning("Document stored in DB without cloud upload | project=%s", project_id)

    # Persist the record
    doc = ProjectDocument(
        id            = doc_id,
        project_id    = project_id,
        file_name     = file.filename,
        blob_path     = blob_path,
        document_type = document_type,
        file_size_kb  = size_kb,
        content_type  = content_type,
        uploaded_by   = current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Generate signed URL (if storage configured)
    signed_url = _get_signed_url(blob_path)

    logger.info(
        "Document uploaded | project=%s type=%s size=%dKB blob_ok=%s",
        project_id, document_type, size_kb, uploaded,
    )
    return {
        "document_id":  doc.id,
        "project_id":   project_id,
        "file_name":    file.filename,
        "document_type":document_type,
        "file_size_kb": size_kb,
        "blob_path":    blob_path,
        "signed_url":   signed_url,
        "blob_stored":  uploaded,
    }


@router.get("/{doc_id}/url")
async def get_document_url(
    doc_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Return a time-limited signed URL (15-min TTL) for secure document download.
    """
    doc = _get_doc_or_404(doc_id, db)
    _verify_document_access(doc, current_user, db)
    signed_url = _get_signed_url(doc.blob_path)
    if not signed_url:
        raise HTTPException(
            status_code=503,
            detail=(
                "Azure Blob Storage not configured. "
                "Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY."
            ),
        )
    return {
        "document_id": doc.id,
        "file_name":   doc.file_name,
        "signed_url":  signed_url,
        "ttl_minutes": SIGNED_URL_TTL_MINUTES,
    }


@router.get("/{project_id}/list")
async def list_project_documents(
    project_id:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """List all documents for a project."""
    _get_project_or_404(project_id, db)
    docs = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id
    ).order_by(ProjectDocument.uploaded_at.desc()).all()

    return {
        "project_id": project_id,
        "count": len(docs),
        "documents": [
            {
                "id":            d.id,
                "file_name":     d.file_name,
                "document_type": d.document_type,
                "file_size_kb":  d.file_size_kb,
                "uploaded_by":   d.uploaded_by,
                "uploaded_at":   str(d.uploaded_at),
            }
            for d in docs
        ],
    }


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id:       str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Remove a document record (soft-delete by removing DB record, blob is retained)."""
    doc = _get_doc_or_404(doc_id, db)
    _verify_document_access(doc, current_user, db)
    db.delete(doc)
    db.commit()
    logger.info("Document record deleted | doc_id=%s by=%s", doc_id, current_user.id)
    return None
