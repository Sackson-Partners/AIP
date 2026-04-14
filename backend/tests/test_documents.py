"""
Tests for backend/routers/documents.py
Uses mocked Azure Blob Storage — no real cloud calls.
"""
import io
import uuid
import pytest
from unittest.mock import patch
from backend.models import User, InfrastructureProject, ProjectDocument
from backend.security.auth import hash_password, create_access_token


def make_email():
    return f"doc_{uuid.uuid4().hex[:8]}@aip.test"


def _make_user(db_session, role="analyst"):
    user = User(
        email=make_email(),
        hashed_password=hash_password("DocPass@123!"),
        full_name=f"Doc {role}",
        role=role,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token({"sub": user.email, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}, user


def _create_project(db_session):
    project = InfrastructureProject(
        project_name=f"Doc Project {uuid.uuid4().hex[:6]}",
        country="Ethiopia",
        sector="energy",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _create_document(db_session, project_id, uploaded_by):
    doc = ProjectDocument(
        project_id=project_id,
        file_name="test.pdf",
        blob_path=f"projects/{project_id}/test.pdf",
        document_type="pis",
        file_size_kb=64,
        uploaded_by=uploaded_by,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


class TestDocumentAuth:
    def test_list_requires_auth(self, client, db_session):
        project = _create_project(db_session)
        assert client.get(f"/api/documents/{project.id}/list").status_code == 401

    def test_url_requires_auth(self, client, db_session):
        h, user = _make_user(db_session)
        project = _create_project(db_session)
        doc = _create_document(db_session, project.id, user.id)
        assert client.get(f"/api/documents/{doc.id}/url").status_code == 401

    def test_delete_requires_auth(self, client, db_session):
        h, user = _make_user(db_session)
        project = _create_project(db_session)
        doc = _create_document(db_session, project.id, user.id)
        assert client.delete(f"/api/documents/{doc.id}").status_code == 401

    def test_upload_requires_auth(self, client, db_session):
        project = _create_project(db_session)
        r = client.post(
            f"/api/documents/upload/{project.id}",
            files={"file": ("t.pdf", io.BytesIO(b"x"), "application/pdf")},
            data={"document_type": "pis"},
        )
        assert r.status_code == 401


class TestDocumentUpload:
    def test_upload_project_not_found(self, client, db_session):
        h, _ = _make_user(db_session)
        with patch("backend.routers.documents._upload_to_blob", return_value=False):
            r = client.post(
                "/api/documents/upload/nonexistent-id",
                files={"file": ("t.pdf", io.BytesIO(b"x"), "application/pdf")},
                data={"document_type": "pis"},
                headers=h,
            )
        assert r.status_code == 404

    def test_upload_invalid_document_type(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        r = client.post(
            f"/api/documents/upload/{project.id}",
            files={"file": ("t.pdf", io.BytesIO(b"x"), "application/pdf")},
            data={"document_type": "invalid_type_xyz"},
            headers=h,
        )
        # Router returns 400 for invalid document type
        assert r.status_code == 400

    def test_upload_success_without_azure(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        with patch("backend.routers.documents._upload_to_blob", return_value=False):
            r = client.post(
                f"/api/documents/upload/{project.id}",
                files={"file": ("report.pdf", io.BytesIO(b"pdf content"), "application/pdf")},
                data={"document_type": "feasibility"},
                headers=h,
            )
        assert r.status_code == 201

    def test_upload_success_with_azure(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        with patch("backend.routers.documents._upload_to_blob", return_value=True), \
             patch("backend.routers.documents._get_signed_url", return_value="https://mock"):
            r = client.post(
                f"/api/documents/upload/{project.id}",
                files={"file": ("doc.pdf", io.BytesIO(b"content"), "application/pdf")},
                data={"document_type": "pis"},
                headers=h,
            )
        assert r.status_code == 201
        assert r.json()["blob_stored"] is True


class TestDocumentAccess:
    def test_url_nonexistent_doc(self, client, db_session):
        h, _ = _make_user(db_session)
        assert client.get("/api/documents/nonexistent/url", headers=h).status_code == 404

    def test_url_own_doc_without_azure(self, client, db_session):
        h, user = _make_user(db_session)
        project = _create_project(db_session)
        doc = _create_document(db_session, project.id, user.id)
        with patch("backend.routers.documents._get_signed_url", return_value=None):
            r = client.get(f"/api/documents/{doc.id}/url", headers=h)
        assert r.status_code in (200, 404, 503)

    def test_url_another_users_doc_forbidden(self, client, db_session):
        owner_h, owner = _make_user(db_session)
        other_h, _ = _make_user(db_session)
        project = _create_project(db_session)
        doc = _create_document(db_session, project.id, owner.id)
        r = client.get(f"/api/documents/{doc.id}/url", headers=other_h)
        assert r.status_code == 403

    def test_delete_own_doc(self, client, db_session):
        h, user = _make_user(db_session)
        project = _create_project(db_session)
        doc = _create_document(db_session, project.id, user.id)
        r = client.delete(f"/api/documents/{doc.id}", headers=h)
        assert r.status_code in (200, 204)

    def test_delete_other_users_doc_forbidden(self, client, db_session):
        owner_h, owner = _make_user(db_session)
        other_h, _ = _make_user(db_session)
        project = _create_project(db_session)
        doc = _create_document(db_session, project.id, owner.id)
        r = client.delete(f"/api/documents/{doc.id}", headers=other_h)
        assert r.status_code == 403

    def test_admin_deletes_any_doc(self, client, db_session):
        analyst_h, analyst = _make_user(db_session)
        admin_h, _ = _make_user(db_session, "admin")
        project = _create_project(db_session)
        doc = _create_document(db_session, project.id, analyst.id)
        r = client.delete(f"/api/documents/{doc.id}", headers=admin_h)
        assert r.status_code in (200, 204)

    def test_list_docs_for_project(self, client, db_session):
        h, user = _make_user(db_session)
        project = _create_project(db_session)
        _create_document(db_session, project.id, user.id)
        r = client.get(f"/api/documents/{project.id}/list", headers=h)
        assert r.status_code == 200
        assert "documents" in r.json()
