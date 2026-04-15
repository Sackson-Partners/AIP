"""
Tests for backend/security/auth.py utility functions.
hash_password, verify_password, and create_access_token are used throughout
the codebase but lacked direct unit tests.
"""
import pytest


class TestHashPassword:
    def test_returns_bcrypt_hash(self):
        from backend.security.auth import hash_password
        hashed = hash_password("MyPassword123!")
        assert hashed.startswith("$2b$")

    def test_different_passwords_different_hashes(self):
        from backend.security.auth import hash_password
        h1 = hash_password("PasswordOne1!")
        h2 = hash_password("PasswordTwo2!")
        assert h1 != h2

    def test_same_password_different_salts(self):
        from backend.security.auth import hash_password
        h1 = hash_password("SamePassword1!")
        h2 = hash_password("SamePassword1!")
        # bcrypt uses random salt — two hashes must differ
        assert h1 != h2

    def test_long_password_truncated(self):
        # bcrypt silently truncates at 72 bytes — function should not raise
        from backend.security.auth import hash_password
        long_password = "A" * 100
        hashed = hash_password(long_password)
        assert hashed.startswith("$2b$")


class TestVerifyPassword:
    def test_correct_password_returns_true(self):
        from backend.security.auth import hash_password, verify_password
        pw = "VerifyMe@456!"
        hashed = hash_password(pw)
        assert verify_password(pw, hashed) is True

    def test_wrong_password_returns_false(self):
        from backend.security.auth import hash_password, verify_password
        hashed = hash_password("RealPassword1!")
        assert verify_password("WrongPassword1!", hashed) is False

    def test_empty_password_does_not_raise(self):
        from backend.security.auth import hash_password, verify_password
        hashed = hash_password("SomePassword1!")
        result = verify_password("", hashed)
        assert result is False

    def test_truncation_consistency(self):
        """72-char and 73-char passwords have same hash — both should verify."""
        from backend.security.auth import hash_password, verify_password
        base = "A" * 72
        hashed = hash_password(base)
        assert verify_password(base, hashed) is True
        # 73-char version is truncated to same 72 chars
        assert verify_password(base + "X", hashed) is True


class TestCreateAccessToken:
    def test_returns_string(self):
        from backend.security.auth import create_access_token
        token = create_access_token({"sub": "user@example.com"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_has_three_parts(self):
        """JWT format: header.payload.signature"""
        from backend.security.auth import create_access_token
        token = create_access_token({"sub": "user@example.com"})
        parts = token.split(".")
        assert len(parts) == 3

    def test_custom_expiry(self):
        from datetime import timedelta
        from backend.security.auth import create_access_token
        token = create_access_token(
            {"sub": "expiry@test.com"},
            expires_delta=timedelta(hours=1),
        )
        assert isinstance(token, str)

    def test_token_contains_expected_claims(self):
        """Decode without verification to check payload contents."""
        import jwt as pyjwt
        from backend.security.auth import create_access_token, SECRET_KEY, ALGORITHM
        data = {"sub": "claims@test.com", "user_id": "abc123"}
        token = create_access_token(data)
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "claims@test.com"
        assert payload["user_id"] == "abc123"
        assert "exp" in payload


class TestAuthenticateUser:
    def test_valid_credentials_return_user(self, db_session):
        from backend.models import User
        from backend.security.auth import hash_password, authenticate_user
        user = User(
            email="auth@aip.test",
            hashed_password=hash_password("ValidPass1!"),
            is_active=True,
            role="analyst",
        )
        db_session.add(user)
        db_session.commit()
        result = authenticate_user(db_session, "auth@aip.test", "ValidPass1!")
        assert result is not None
        assert result.email == "auth@aip.test"

    def test_wrong_password_returns_none(self, db_session):
        from backend.models import User
        from backend.security.auth import hash_password, authenticate_user
        user = User(
            email="wrong@aip.test",
            hashed_password=hash_password("CorrectPass1!"),
            is_active=True,
            role="analyst",
        )
        db_session.add(user)
        db_session.commit()
        result = authenticate_user(db_session, "wrong@aip.test", "WrongPass1!")
        assert result is None

    def test_nonexistent_user_returns_none(self, db_session):
        from backend.security.auth import authenticate_user
        result = authenticate_user(db_session, "nobody@aip.test", "AnyPass1!")
        assert result is None

    def test_inactive_user_returns_none(self, db_session):
        from backend.models import User
        from backend.security.auth import hash_password, authenticate_user
        user = User(
            email="inactive@aip.test",
            hashed_password=hash_password("ActivePass1!"),
            is_active=False,
            role="analyst",
        )
        db_session.add(user)
        db_session.commit()
        result = authenticate_user(db_session, "inactive@aip.test", "ActivePass1!")
        assert result is None


class TestDecodeToken:
    def test_valid_local_token_decoded(self):
        from backend.security.auth import create_access_token, decode_token
        token = create_access_token({"sub": "decode@test.com", "user_id": "u1"})
        data = decode_token(token)
        assert data.email == "decode@test.com"

    def test_invalid_token_raises(self):
        from fastapi import HTTPException
        from backend.security.auth import decode_token
        import pytest
        with pytest.raises(HTTPException) as exc_info:
            decode_token("invalid.token.here")
        assert exc_info.value.status_code == 401

    def test_supabase_flag_false_for_local_token(self):
        from backend.security.auth import create_access_token, _decode_local_token
        token = create_access_token({"sub": "local@test.com"})
        data = _decode_local_token(token)
        assert data is not None
        assert data.is_supabase is False
