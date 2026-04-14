"""
STEP-1: Auth Protection Tests
Verify every endpoint that had authentication added returns 401 without a JWT token,
and returns a non-401 response with a valid token.
"""
import uuid
import pytest
from backend.models import User
from backend.security.auth import hash_password, create_access_token


def make_email():
    return f"auth_{uuid.uuid4().hex[:8]}@aip.com"


@pytest.fixture(scope="function")
def auth_headers(db_session, client):
    """Create a user directly in the DB and return auth headers (no login endpoint)."""
    email = make_email()
    user = User(
        email=email,
        hashed_password=hash_password("AuthPass@123!"),
        full_name="Auth Test User",
        role="analyst",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token({"sub": user.email, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}


class TestProjectsAuth:
    """GET /api/projects and GET /api/projects/{id} require auth."""

    def test_list_projects_no_token_returns_401(self, client):
        r = client.get("/api/projects")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_list_projects_with_token_not_401(self, client, auth_headers):
        r = client.get("/api/projects", headers=auth_headers)
        assert r.status_code != 401, f"Expected non-401, got {r.status_code}"

    def test_get_project_by_id_no_token_returns_401(self, client):
        r = client.get("/api/projects/nonexistent-id")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_get_project_by_id_with_token_not_401(self, client, auth_headers):
        # Creates a project first so we can test a real ID
        r = client.post("/api/projects", json={
            "project_name": "Auth Test Project",
            "country": "Kenya",
            "sector": "energy",
        }, headers=auth_headers)
        assert r.status_code in (200, 201)
        project_id = r.json()["id"]
        r2 = client.get(f"/api/projects/{project_id}", headers=auth_headers)
        assert r2.status_code != 401, f"Expected non-401, got {r2.status_code}"


class TestInvestorsAuth:
    """GET /api/investors and GET /api/investors/{id} require auth."""

    def test_list_investors_no_token_returns_401(self, client):
        r = client.get("/api/investors")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_list_investors_with_token_not_401(self, client, auth_headers):
        r = client.get("/api/investors", headers=auth_headers)
        assert r.status_code != 401, f"Expected non-401, got {r.status_code}"

    def test_get_investor_by_id_no_token_returns_401(self, client):
        r = client.get("/api/investors/nonexistent-id")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_get_investor_by_id_with_token_not_401(self, client, auth_headers):
        # Create an investor first
        r = client.post("/api/investors", json={
            "organisation_name": "Auth Test Fund",
            "investor_type": "private_fund",
        }, headers=auth_headers)
        assert r.status_code in (200, 201)
        investor_id = r.json()["id"]
        r2 = client.get(f"/api/investors/{investor_id}", headers=auth_headers)
        assert r2.status_code != 401, f"Expected non-401, got {r2.status_code}"


class TestAnalyticsAuth:
    """POST /api/analytics/track requires auth."""

    def test_track_event_no_token_returns_401(self, client):
        r = client.post("/api/analytics/track", json={
            "event_type": "test_event",
        })
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_track_event_with_token_not_401(self, client, auth_headers):
        r = client.post("/api/analytics/track", json={
            "event_type": "test_event",
        }, headers=auth_headers)
        assert r.status_code != 401, f"Expected non-401, got {r.status_code}"


class TestDataRoomsAuth:
    """GET /api/data-rooms requires auth."""

    def test_list_data_rooms_no_token_returns_401(self, client):
        r = client.get("/api/data-rooms")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_list_data_rooms_with_token_not_401(self, client, auth_headers):
        r = client.get("/api/data-rooms", headers=auth_headers)
        assert r.status_code != 401, f"Expected non-401, got {r.status_code}"


class TestDocumentsAuth:
    """GET /api/documents/{id}/url and DELETE /api/documents/{id} require auth."""

    def test_get_document_url_no_token_returns_401(self, client):
        r = client.get("/api/documents/nonexistent-id/url")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_get_document_url_with_token_not_401(self, client, auth_headers):
        # A non-existent doc with a valid token should return 404 (not 401)
        r = client.get("/api/documents/nonexistent-id/url", headers=auth_headers)
        assert r.status_code != 401, f"Expected non-401, got {r.status_code}"
        assert r.status_code == 404

    def test_delete_document_no_token_returns_401(self, client):
        r = client.delete("/api/documents/nonexistent-id")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_delete_document_with_token_not_401(self, client, auth_headers):
        r = client.delete("/api/documents/nonexistent-id", headers=auth_headers)
        assert r.status_code != 401, f"Expected non-401, got {r.status_code}"
        assert r.status_code == 404


class TestDealRoomMembersAuth:
    """DELETE /api/deal-rooms/{id}/members/{member_id} requires auth."""

    def test_remove_member_no_token_returns_401(self, client):
        r = client.delete("/api/deal-rooms/nonexistent-room/members/nonexistent-member")
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_remove_member_with_token_not_401(self, client, auth_headers):
        # Room doesn't exist → 404, but not 401
        r = client.delete(
            "/api/deal-rooms/nonexistent-room/members/nonexistent-member",
            headers=auth_headers,
        )
        assert r.status_code != 401, f"Expected non-401, got {r.status_code}"
        assert r.status_code == 404
