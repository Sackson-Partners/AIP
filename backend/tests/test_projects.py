# backend/tests/test_projects.py
"""
Project endpoint tests.
All write endpoints require authentication.
"""
import uuid
import pytest

REGISTER = "/api/auth/register"
TOKEN    = "/api/auth/token"
PROJECTS = "/api/projects/"


def make_email():
    return f"proj_{uuid.uuid4().hex[:8]}@aip.com"


def get_auth_headers(client):
    """Register a user and return auth headers."""
    email = make_email()
    password = "TestPass@123"
    client.post(REGISTER, json={"email": email, "password": password})
    resp = client.post(TOKEN, data={"username": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestCreateProject:
    """Tests for project creation endpoint."""

    def test_create_project_requires_auth(self, client):
        """Unauthenticated request should return 401."""
        r = client.post(PROJECTS, json={"name": "No Auth"})
        assert r.status_code == 401

    def test_create_project_success(self, client):
        """Authenticated user can create a project."""
        headers = get_auth_headers(client)
        r = client.post(PROJECTS, json={
            "project_name": "Nairobi Solar Farm",
            "country": "Kenya",
            "sector": "energy",
            "status": "planned",
        }, headers=headers)
        # Accept 200 or 201
        assert r.status_code in [200, 201], f"Create failed: {r.text}"
        data = r.json()
        assert "id" in data

    def test_create_project_missing_required_fields(self, client):
        """Missing required fields → 422 Unprocessable Entity."""
        headers = get_auth_headers(client)
        r = client.post(PROJECTS, json={"country": "Kenya"}, headers=headers)
        assert r.status_code == 422

    def test_list_projects(self, client):
        """List endpoint should return 200."""
        headers = get_auth_headers(client)
        r = client.get(PROJECTS, headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_project_not_found(self, client):
        """Non-existent project → 404."""
        headers = get_auth_headers(client)
        r = client.get(f"{PROJECTS}nonexistent-id-99999", headers=headers)
        assert r.status_code == 404
