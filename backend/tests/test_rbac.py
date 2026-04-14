"""
TEST-1: RBAC Tests
Verify role-based access control across endpoints.
"""
import uuid
import pytest

REGISTER = "/api/auth/register"
TOKEN    = "/api/auth/token"


def make_email():
    return f"rbac_{uuid.uuid4().hex[:8]}@aip.com"


# ── Role matrix fixtures ──────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def viewer_user(db_session):
    from backend.models import User
    from backend.security.auth import hash_password
    user = User(
        email=make_email(),
        hashed_password=hash_password("ViewerPass@1!"),
        role="viewer",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def viewer_token(viewer_user):
    from backend.security.auth import create_access_token
    return create_access_token({"sub": viewer_user.email, "user_id": viewer_user.id})


@pytest.fixture(scope="function")
def viewer_headers(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}"}


# ── Admin-only endpoint tests ─────────────────────────────────────────────────

class TestAnalystCannotAccessAdminEndpoints:
    """Analyst role must not reach admin-only endpoints."""

    def test_analyst_cannot_list_users(self, client, analyst_headers):
        r = client.get("/api/users", headers=analyst_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_analyst_cannot_create_user(self, client, analyst_headers):
        r = client.post("/api/users", json={
            "email": make_email(),
            "password": "Test@123!",
            "role": "analyst",
        }, headers=analyst_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_analyst_cannot_delete_user(self, client, analyst_headers, analyst_user):
        r = client.delete(f"/api/users/{analyst_user.id}", headers=analyst_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_analyst_cannot_view_user_stats(self, client, analyst_headers):
        r = client.get("/api/users/stats/summary", headers=analyst_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_analyst_cannot_view_analytics_summary(self, client, analyst_headers):
        r = client.get("/api/analytics/summary", headers=analyst_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"


class TestAdminCanAccessAdminEndpoints:
    """Admin role must reach admin-only endpoints."""

    def test_admin_can_list_users(self, client, admin_headers):
        r = client.get("/api/users", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    def test_admin_can_view_user_stats(self, client, admin_headers):
        r = client.get("/api/users/stats/summary", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"

    def test_admin_can_view_analytics_summary(self, client, admin_headers):
        r = client.get("/api/analytics/summary", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"


class TestUnauthenticatedBlocked:
    """Unauthenticated users are blocked from all protected endpoints."""

    @pytest.mark.parametrize("method,path", [
        ("GET",    "/api/projects"),
        ("GET",    "/api/investors"),
        ("GET",    "/api/data-rooms"),
        ("GET",    "/api/users"),
        ("POST",   "/api/analytics/track"),
        ("GET",    "/api/auth/me"),
    ])
    def test_unauthenticated_blocked(self, client, method, path):
        r = client.request(method, path)
        assert r.status_code == 401, (
            f"{method} {path}: Expected 401, got {r.status_code}"
        )


class TestAdminCannotSelfDelete:
    """Admin cannot delete their own account."""

    def test_admin_cannot_delete_self(self, client, admin_headers, admin_user):
        r = client.delete(f"/api/users/{admin_user.id}", headers=admin_headers)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
