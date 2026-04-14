# backend/tests/test_auth.py
"""
Auth endpoint tests.
POST /api/auth/register  → JSON body
POST /api/auth/token     → form-encoded (OAuth2PasswordRequestForm)
GET  /api/auth/me        → Bearer token
POST /api/auth/logout    → Bearer token
"""
import uuid
import pytest


REGISTER = "/api/auth/register"
TOKEN    = "/api/auth/token"
ME       = "/api/auth/me"
LOGOUT   = "/api/auth/logout"


def make_email():
    return f"test_{uuid.uuid4().hex[:8]}@aip.com"


# ─────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────
class TestUserRegistration:

    def test_register_success(self, client):
        email = make_email()
        r = client.post(REGISTER, json={
            "email": email,
            "password": "Test@123!",
            "full_name": "Test User",
        })
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["email"] == email
        assert "id" in data
        assert "hashed_password" not in data

    def test_register_duplicate_email(self, client):
        email = make_email()
        payload = {"email": email, "password": "Test@123!", "full_name": "User"}
        client.post(REGISTER, json=payload)          # first — OK
        r = client.post(REGISTER, json=payload)      # second — should fail
        assert r.status_code == 400, r.text

    def test_register_invalid_email(self, client):
        r = client.post(REGISTER, json={
            "email": "not-an-email",
            "password": "Test@123!",
        })
        assert r.status_code == 422

    def test_register_short_password(self, client):
        r = client.post(REGISTER, json={
            "email": make_email(),
            "password": "ab",
        })
        assert r.status_code == 422


# ─────────────────────────────────────────────
# Login  ← KEY FIX: use form data not JSON
# ─────────────────────────────────────────────
class TestUserLogin:

    def _register_and_login(self, client):
        """Helper: register a fresh user and return (email, token_response)."""
        email = make_email()
        password = "Test@123!"
        reg = client.post(REGISTER, json={
            "email": email,
            "password": password,
            "full_name": "Login Test User",
        })
        assert reg.status_code == 201, f"Register failed: {reg.text}"

        # ⚠️  /token uses OAuth2PasswordRequestForm → MUST be form-encoded
        login = client.post(TOKEN, data={
            "username": email,
            "password": password,
        })
        return email, login

    def test_login_success(self, client):
        _, login = self._register_and_login(client)
        assert login.status_code == 200, f"Login failed: {login.text}"
        data = login.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        email = make_email()
        client.post(REGISTER, json={"email": email, "password": "Correct@1!"})
        r = client.post(TOKEN, data={
            "username": email,
            "password": "WrongPassword!",
        })
        assert r.status_code == 401, r.text

    def test_login_nonexistent_user(self, client):
        r = client.post(TOKEN, data={
            "username": "nobody@nowhere.com",
            "password": "Whatever1!",
        })
        assert r.status_code == 401, r.text

    def test_login_returns_bearer_token(self, client):
        _, login = self._register_and_login(client)
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        assert len(token) > 20                        # real JWT is long
        assert token.count(".") == 2                  # JWT has 3 parts


# ─────────────────────────────────────────────
# /me endpoint
# ─────────────────────────────────────────────
class TestGetMe:

    def test_me_authenticated(self, client):
        email = make_email()
        client.post(REGISTER, json={"email": email, "password": "Test@123!"})
        login = client.post(TOKEN, data={"username": email, "password": "Test@123!"})
        assert login.status_code == 200
        token = login.json()["access_token"]

        r = client.get(ME, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email

    def test_me_no_token(self, client):
        r = client.get(ME)
        assert r.status_code == 401

    def test_me_invalid_token(self, client):
        r = client.get(ME, headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
class TestHealthCheck:

    def test_health_endpoint(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] in ("healthy", "degraded")


# ─────────────────────────────────────────────
# Password reset (TEST-4 additions)
# ─────────────────────────────────────────────
class TestPasswordReset:

    def test_login_wrong_password_returns_401(self, client):
        """Wrong password always returns 401 — no account enumeration."""
        email = make_email()
        client.post(REGISTER, json={"email": email, "password": "Correct@1!"})
        r = client.post(TOKEN, data={"username": email, "password": "Wrong@Pass1!"})
        assert r.status_code == 401, r.text

    def test_login_nonexistent_user_returns_401(self, client):
        """Non-existent user returns 401 (no account enumeration)."""
        r = client.post(TOKEN, data={
            "username": "nobody@nowhere.invalid",
            "password": "Whatever1!",
        })
        assert r.status_code == 401, r.text

    def test_inactive_user_cannot_log_in(self, client, db_session):
        """Deactivated accounts receive 403 after successful token decode."""
        from backend.models import User
        from backend.security.auth import hash_password
        email = make_email()
        user = User(
            email=email,
            hashed_password=hash_password("Inactive@1!"),
            is_active=False,
            role="analyst",
        )
        db_session.add(user)
        db_session.commit()

        r = client.post(TOKEN, data={"username": email, "password": "Inactive@1!"})
        # 401 because authenticate_user returns None for inactive users,
        # OR 403 if we reach get_current_user and find is_active=False
        assert r.status_code in (401, 403), r.text

    def test_token_contains_correct_email(self, client):
        """JWT token sub claim matches the registered email."""
        import base64, json
        email = make_email()
        client.post(REGISTER, json={"email": email, "password": "Test@123!"})
        login = client.post(TOKEN, data={"username": email, "password": "Test@123!"})
        assert login.status_code == 200
        token = login.json()["access_token"]

        # Decode JWT payload (middle segment) without verification
        parts = token.split(".")
        assert len(parts) == 3, "Token is not a valid JWT"
        payload_b64 = parts[1] + "=="  # add padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        assert payload.get("sub") == email

    def test_token_has_expiry(self, client):
        """JWT token contains an expiry claim (exp)."""
        import base64, json
        email = make_email()
        client.post(REGISTER, json={"email": email, "password": "Test@123!"})
        login = client.post(TOKEN, data={"username": email, "password": "Test@123!"})
        assert login.status_code == 200
        token = login.json()["access_token"]
        parts = token.split(".")
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        assert "exp" in payload, "Token is missing expiry claim"

    def test_register_then_immediately_access_me(self, client):
        """User can call /me immediately after registration + login."""
        email = make_email()
        client.post(REGISTER, json={"email": email, "password": "Test@123!"})
        login = client.post(TOKEN, data={"username": email, "password": "Test@123!"})
        assert login.status_code == 200
        token = login.json()["access_token"]
        r = client.get(ME, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["email"] == email
        assert r.json()["is_active"] is True
