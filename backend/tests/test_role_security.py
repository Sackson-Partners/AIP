"""
Role Security Tests
Verify role assignment is secure — no self-escalation, no JWT role injection.
"""
import uuid
import pytest

ME    = "/api/auth/me"
USERS = "/api/users"


def make_email():
    return f"role_{uuid.uuid4().hex[:8]}@example.com"


class TestRegistrationRoleSecurity:
    """Role security via the admin user-creation endpoint."""

    def test_create_user_with_unknown_role_rejected(self, client, admin_headers):
        """Admin cannot assign a non-existent role."""
        r = client.post(USERS, json={
            "email": make_email(),
            "password": "Test@123!",
            "role": "super_admin",
        }, headers=admin_headers)
        assert r.status_code == 400, r.text

    def test_newly_created_user_gets_assigned_role(self, client, admin_headers):
        """Admin-created users receive the role specified, never an elevated default."""
        r = client.post(USERS, json={
            "email": make_email(),
            "password": "Test@123!",
            "role": "analyst",
        }, headers=admin_headers)
        assert r.status_code == 201, r.text
        assert r.json()["role"] == "analyst"

    def test_non_admin_cannot_create_users(self, client, analyst_headers):
        """Non-admin users cannot create other users."""
        r = client.post(USERS, json={
            "email": make_email(),
            "password": "Test@123!",
            "role": "viewer",
        }, headers=analyst_headers)
        assert r.status_code == 403, r.text


class TestAdminRoleManagement:
    """Only admin can change user roles via the admin API."""

    def test_analyst_cannot_update_another_users_role(self, client, analyst_headers, analyst_user):
        """Analyst cannot call PUT /api/users/{id} to change roles."""
        r = client.put(
            f"/api/users/{analyst_user.id}",
            json={"role": "admin"},
            headers=analyst_headers,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_admin_can_update_user_role(self, client, admin_headers, analyst_user):
        """Admin can change a user's role via the admin API."""
        r = client.put(
            f"/api/users/{analyst_user.id}",
            json={"role": "ic_member"},
            headers=admin_headers,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.json()["role"] == "ic_member"

    def test_update_endpoint_rejects_protected_fields(self, client, admin_headers, analyst_user):
        """PUT /api/users/{id} with non-whitelisted fields returns 422 (extra field forbidden)."""
        r = client.put(
            f"/api/users/{analyst_user.id}",
            json={"hashed_password": "malicious-hash"},
            headers=admin_headers,
        )
        # UserUpdate has extra='forbid', so unknown fields are rejected at the Pydantic layer
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    def test_update_endpoint_rejects_invalid_role(self, client, admin_headers, analyst_user):
        """PUT /api/users/{id} with an invalid role value returns 400."""
        r = client.put(
            f"/api/users/{analyst_user.id}",
            json={"role": "superuser_hacker"},
            headers=admin_headers,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


class TestPasswordComplexity:
    """Password complexity is enforced at admin user creation."""

    def test_weak_password_rejected_at_registration(self, client, admin_headers):
        """Passwords without required complexity are rejected."""
        r = client.post(USERS, json={
            "email": make_email(),
            "password": "weakpassword",
            "role": "viewer",
        }, headers=admin_headers)
        assert r.status_code in (400, 422), r.text

    def test_no_uppercase_rejected(self, client, admin_headers):
        r = client.post(USERS, json={
            "email": make_email(),
            "password": "nouppercase1!",
            "role": "viewer",
        }, headers=admin_headers)
        assert r.status_code in (400, 422), r.text

    def test_no_digit_rejected(self, client, admin_headers):
        r = client.post(USERS, json={
            "email": make_email(),
            "password": "NoDigitHere!",
            "role": "viewer",
        }, headers=admin_headers)
        assert r.status_code in (400, 422), r.text

    def test_strong_password_accepted(self, client, admin_headers):
        r = client.post(USERS, json={
            "email": make_email(),
            "password": "Strong@Pass1",
            "role": "viewer",
        }, headers=admin_headers)
        assert r.status_code == 201, r.text

    def test_admin_create_user_weak_password_rejected(self, client, admin_headers):
        """Admin cannot create a user with a weak password."""
        r = client.post("/api/users", json={
            "email": make_email(),
            "password": "weak",
            "role": "analyst",
        }, headers=admin_headers)
        assert r.status_code in (400, 422), r.text
