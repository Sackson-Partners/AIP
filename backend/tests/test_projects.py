# backend/tests/test_projects.py
"""
Project endpoint tests.
All write endpoints require authentication.
"""
import uuid
import pytest
from backend.models import User
from backend.security.auth import hash_password, create_access_token

PROJECTS = "/api/projects"


def make_email():
    return f"proj_{uuid.uuid4().hex[:8]}@aip.com"


def _make_headers(db_session):
    """Create an analyst user directly in the DB and return auth headers."""
    user = User(
        email=make_email(),
        hashed_password=hash_password("TestPass@123!"),
        full_name="Project Test User",
        role="analyst",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token({"sub": user.email, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}


class TestCreateProject:
    """Tests for project creation endpoint."""

    def test_create_project_requires_auth(self, client):
        """Unauthenticated request should return 401."""
        r = client.post(PROJECTS, json={"name": "No Auth"})
        assert r.status_code == 401

    def test_create_project_success(self, client, db_session):
        """Authenticated user can create a project."""
        headers = _make_headers(db_session)
        r = client.post(PROJECTS, json={
            "project_name": "Nairobi Solar Farm",
            "country": "Kenya",
            "sector": "energy",
            "status": "planned",
        }, headers=headers)
        assert r.status_code in [200, 201], f"Create failed: {r.text}"
        data = r.json()
        assert "id" in data

    def test_create_project_missing_required_fields(self, client, db_session):
        """Missing required fields → 422 Unprocessable Entity."""
        headers = _make_headers(db_session)
        r = client.post(PROJECTS, json={"country": "Kenya"}, headers=headers)
        assert r.status_code == 422

    def test_list_projects(self, client, db_session):
        """List endpoint should return 200."""
        headers = _make_headers(db_session)
        r = client.get(PROJECTS, headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_project_not_found(self, client, db_session):
        """Non-existent project → 404."""
        headers = _make_headers(db_session)
        r = client.get(f"{PROJECTS}/nonexistent-id-99999", headers=headers)
        assert r.status_code == 404

    def test_list_projects_unauthenticated_returns_401(self, client):
        """Unauthenticated list request returns 401."""
        r = client.get(PROJECTS)
        assert r.status_code == 401

    def test_get_project_by_id_unauthenticated_returns_401(self, client):
        """Unauthenticated get-by-id returns 401."""
        r = client.get(f"{PROJECTS}/some-id")
        assert r.status_code == 401

    def test_update_project_authenticated(self, client, db_session):
        """Authenticated user can update a project they created."""
        headers = _make_headers(db_session)
        create_resp = client.post(PROJECTS, json={
            "project_name": "Update Me",
            "country": "Ghana",
            "sector": "water",
        }, headers=headers)
        assert create_resp.status_code in (200, 201)
        project_id = create_resp.json()["id"]

        r = client.put(f"{PROJECTS}/{project_id}", json={
            "project_name": "Updated Name",
            "country": "Ghana",
            "sector": "water",
        }, headers=headers)
        assert r.status_code == 200, f"Update failed: {r.text}"
        assert r.json()["project_name"] == "Updated Name"

    def test_delete_project_authenticated(self, client, db_session):
        """Authenticated user can delete a project."""
        headers = _make_headers(db_session)
        create_resp = client.post(PROJECTS, json={
            "project_name": "Delete Me",
            "country": "Tanzania",
            "sector": "transport",
        }, headers=headers)
        assert create_resp.status_code in (200, 201)
        project_id = create_resp.json()["id"]

        r = client.delete(f"{PROJECTS}/{project_id}", headers=headers)
        assert r.status_code in (200, 204), f"Delete failed: {r.text}"

    def test_get_project_by_id_authenticated(self, client, db_session):
        """Authenticated user can retrieve a project by ID."""
        headers = _make_headers(db_session)
        create_resp = client.post(PROJECTS, json={
            "project_name": "Get By ID",
            "country": "Ethiopia",
            "sector": "energy",
        }, headers=headers)
        assert create_resp.status_code in (200, 201)
        project_id = create_resp.json()["id"]

        r = client.get(f"{PROJECTS}/{project_id}", headers=headers)
        assert r.status_code == 200, f"Get by ID failed: {r.text}"
        assert r.json()["id"] == project_id

    def test_patch_project_authenticated(self, client, db_session):
        """Authenticated user can patch a project with partial update."""
        headers = _make_headers(db_session)
        create_resp = client.post(PROJECTS, json={
            "project_name": "Patch Me",
            "country": "Rwanda",
            "sector": "energy",
        }, headers=headers)
        assert create_resp.status_code in (200, 201)
        project_id = create_resp.json()["id"]

        r = client.patch(f"{PROJECTS}/{project_id}", json={
            "project_name": "Patched Name",
            "country": "Rwanda",
            "sector": "energy",
        }, headers=headers)
        assert r.status_code == 200, f"Patch failed: {r.text}"
        assert r.json()["project_name"] == "Patched Name"

    def test_patch_project_not_found(self, client, db_session):
        """PATCH on non-existent project returns 404."""
        headers = _make_headers(db_session)
        r = client.patch(f"{PROJECTS}/nonexistent-id", json={
            "project_name": "Ghost",
            "country": "Kenya",
            "sector": "energy",
        }, headers=headers)
        assert r.status_code == 404
