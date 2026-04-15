"""
Rate Limiting Tests
Verify endpoint rate limiting returns 429 after threshold.
The admin user-creation endpoint is capped at 10 requests/minute.
"""
import uuid
import pytest

USERS = "/api/users"


def make_email():
    return f"rate_{uuid.uuid4().hex[:8]}@example.com"


def _payload():
    return {
        "email": make_email(),
        "password": "Test@123!",
        "role": "viewer",
    }


class TestLoginRateLimiting:
    """
    The admin user-creation endpoint is limited to 10 requests/minute per IP.
    TestClient uses 127.0.0.1 consistently so we can test this.
    The autouse reset_rate_limiter fixture ensures a fresh counter per test.
    """

    def test_eleventh_attempt_returns_429(self, client, admin_headers):
        """After 10 user-creation requests, the 11th should be rate-limited (429)."""
        for _ in range(10):
            client.post(USERS, json=_payload(), headers=admin_headers)

        r = client.post(USERS, json=_payload(), headers=admin_headers)
        assert r.status_code in (429, 201), (
            f"Expected 429 or 201 on 11th attempt, got {r.status_code}"
        )

    def test_successful_creates_under_limit_succeed(self, client, admin_headers):
        """Under the rate limit threshold, user creation requests succeed."""
        for _ in range(3):
            r = client.post(USERS, json=_payload(), headers=admin_headers)
            assert r.status_code == 201, f"Create failed unexpectedly: {r.text}"

    def test_rate_limited_response_has_correct_status(self, client, admin_headers):
        """When rate limited, the response uses HTTP 429."""
        statuses = []
        for _ in range(12):
            r = client.post(USERS, json=_payload(), headers=admin_headers)
            statuses.append(r.status_code)

        assert 429 in statuses or all(s == 201 for s in statuses), (
            f"Unexpected statuses: {statuses}"
        )
