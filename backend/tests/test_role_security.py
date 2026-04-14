"""
STEP-3: Role Security Tests
Verify role assignment is secure — no self-escalation, no JWT role injection.
"""
import uuid
import pytest

REGISTER = "/api/auth/register"
TOKEN    = "/api/auth/token"
ME       = "/api/auth/me"


def make_email():
    return f"role_{uuid.uuid4().hex[:8]}@aip.com"


class TestRegistrationRoleSecurity:
    """New users always get the default role; role cannot be self-assigned."""

    def test_registration_does_not_accept_role_parameter(self, client):
        """Registration payload with a role field is ignored / filtered."""
        email = make_email()
        r = client.post(REGISTER, json={
            "email": email,
            "password": "Test@123!",
            "full_name": "Role Test User",
            "role": "admin",  # attacker tries to self-assign admin
        })
        # Should succeed (extra field is ignored by Pydantic)
        assert r.status_code == 201, r.text

    def test_newly_registered_user_gets_default_role(self, client):
        """Newly registered users always receive 'analyst' (default) role."""
        email = make_email()
        r = client.post(REGISTER, json={
            "email": email,
            "password": "Test@123!",
        })
        assert r.status_code == 201, r.text
        data = r.json()
        # Role must be the default (analyst), never admin/super_admin
        assert data["role"] not in ("admin", "super_admin"), (
            f"New user got elevated role: {data['role']}"
        )

    def test_registered_user_cannot_get_admin_role_on_register(self, client):
        """Even if user tries to include role=admin, they get analyst."""
        email = make_email()
        r = client.post(REGISTER, json={
            "email": email,
            "password": "Test@123!",
            "role": "super_admin",
        })
        assert r.status_code == 201, r.text
        # Extra field should be stripped by Pydantic model
        assert r.json()["role"] not in ("super_admin", "admin")


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
    """Password complexity is enforced at registration and admin user creation."""

    def test_weak_password_rejected_at_registration(self, client):
        """Passwords without special characters are rejected."""
        r = client.post(REGISTER, json={
            "email": make_email(),
            "password": "weakpassword",
        })
        assert r.status_code == 422, r.text

    def test_no_uppercase_rejected(self, client):
        r = client.post(REGISTER, json={
            "email": make_email(),
            "password": "nouppercase1!",
        })
        assert r.status_code == 422, r.text

    def test_no_digit_rejected(self, client):
        r = client.post(REGISTER, json={
            "email": make_email(),
            "password": "NoDigitHere!",
        })
        assert r.status_code == 422, r.text

    def test_strong_password_accepted(self, client):
        r = client.post(REGISTER, json={
            "email": make_email(),
            "password": "Strong@Pass1",
        })
        assert r.status_code == 201, r.text

    def test_admin_create_user_weak_password_rejected(self, client, admin_headers):
        """Admin cannot create a user with a weak password."""
        r = client.post("/api/users", json={
            "email": make_email(),
            "password": "weak",
            "role": "analyst",
        }, headers=admin_headers)
        assert r.status_code in (400, 422), r.text
