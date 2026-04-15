# backend/tests/test_auth.py
"""
Auth endpoint tests.
Authentication is via Supabase; the backend validates Supabase JWTs.

Endpoints tested:
    GET  /api/auth/me     → Bearer token
    POST /api/auth/sync   → Bearer token (idempotent user sync)
    POST /api/auth/logout → open
"""
import pytest

ME     = "/api/auth/me"
SYNC   = "/api/auth/sync"
LOGOUT = "/api/auth/logout"


# ─────────────────────────────────────────────
# /me endpoint
# ─────────────────────────────────────────────
class TestGetMe:

    def test_me_authenticated(self, client, admin_headers, admin_user):
        r = client.get(ME, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == admin_user.email
        assert "id" in data
        assert "hashed_password" not in data

    def test_me_no_token(self, client):
        r = client.get(ME)
        assert r.status_code == 401

    def test_me_invalid_token(self, client):
        r = client.get(ME, headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401

    def test_me_returns_role(self, client, admin_headers, admin_user):
        r = client.get(ME, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_inactive_user_returns_403(self, client, db_session):
        """Deactivated accounts receive 403 after successful token decode."""
        from backend.models import User
        from backend.security.auth import hash_password, create_access_token
        user = User(
            email="inactive@aip.test",
            hashed_password=hash_password("Inactive@1!"),
            is_active=False,
            role="analyst",
        )
        db_session.add(user)
        db_session.commit()
        token = create_access_token({"sub": user.email, "user_id": user.id})
        r = client.get(ME, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403, r.text


# ─────────────────────────────────────────────
# /sync endpoint
# ─────────────────────────────────────────────
class TestSyncUser:

    def test_sync_returns_user_profile(self, client, analyst_headers, analyst_user):
        r = client.post(SYNC, headers=analyst_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == analyst_user.email
        assert "id" in data

    def test_sync_no_token_returns_401(self, client):
        r = client.post(SYNC)
        assert r.status_code == 401

    def test_sync_is_idempotent(self, client, admin_headers, admin_user):
        r1 = client.post(SYNC, headers=admin_headers)
        r2 = client.post(SYNC, headers=admin_headers)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"]


# ─────────────────────────────────────────────
# /logout endpoint
# ─────────────────────────────────────────────
class TestLogout:

    def test_logout_returns_success(self, client):
        r = client.post(LOGOUT)
        assert r.status_code == 200
        assert r.json()["success"] is True


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
class TestHealthCheck:

    def test_health_endpoint(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] in ("healthy", "degraded")

    def test_ping(self, client):
        r = client.get("/ping")
        assert r.status_code == 200
        assert r.json()["pong"] is True

    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "AIP API is running"
        assert "features" in data
