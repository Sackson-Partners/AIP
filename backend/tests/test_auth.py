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
        assert r.json()["status"] == "healthy"
