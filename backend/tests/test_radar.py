"""
Tests for backend/routers/radar.py
Covers auth, static data endpoints, and mocked AI-powered endpoints.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from backend.models import User
from backend.security.auth import hash_password, create_access_token


def make_email():
    return f"radar_{uuid.uuid4().hex[:8]}@aip.test"


def _make_user(db_session, role="analyst"):
    user = User(
        email=make_email(),
        hashed_password=hash_password("RadarPass@123!"),
        full_name=f"Radar {role}",
        role=role,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token({"sub": user.email, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}, user


class TestRadarAuth:
    def test_root_requires_auth(self, client):
        assert client.get("/api/radar").status_code == 401

    def test_results_requires_auth(self, client):
        assert client.get("/api/radar/results").status_code == 401

    def test_sectors_requires_auth(self, client):
        assert client.get("/api/radar/sectors").status_code == 401

    def test_scan_requires_auth(self, client):
        r = client.post("/api/radar/scan", json={})
        assert r.status_code == 401

    def test_country_requires_auth(self, client):
        r = client.post("/api/radar/country/Nigeria", json={})
        assert r.status_code == 401


class TestRadarEndpoints:
    def test_root_returns_200(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/radar", headers=h)
        assert r.status_code == 200

    def test_results_returns_200(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/radar/results", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert "country_risk" in data
        assert "radar_signals" in data
        assert "sector_briefs" in data

    def test_sectors_returns_six_sectors(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/radar/sectors", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert "sectors" in data
        assert len(data["sectors"]) == 6

    def test_sectors_have_expected_fields(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/radar/sectors", headers=h)
        for s in r.json()["sectors"]:
            assert "sector" in s
            assert "project_count" in s

    def test_scan_with_mock_claude(self, client, db_session):
        h, _ = _make_user(db_session)
        with patch(
            "backend.services.aip_claude_service.generate_radar_scan",
            new=AsyncMock(return_value="Radar scan intelligence brief"),
        ):
            r = client.post("/api/radar/scan", json={
                "focus_countries": ["Nigeria", "Kenya"],
                "focus_sectors": ["energy"],
            }, headers=h)
        assert r.status_code == 200
        data = r.json()
        assert "scan_id" in data
        assert data["content"] == "Radar scan intelligence brief"

    def test_country_risk_with_mock_claude(self, client, db_session):
        h, _ = _make_user(db_session)
        with patch(
            "backend.services.aip_claude_service.generate_country_risk",
            new=AsyncMock(return_value="Nigeria risk brief content"),
        ):
            r = client.post("/api/radar/country/Nigeria", json={}, headers=h)
        assert r.status_code == 200
        data = r.json()
        assert data["country"] == "Nigeria"
        assert "brief" in data

    def test_scan_default_countries(self, client, db_session):
        """Empty payload uses default countries/sectors."""
        h, _ = _make_user(db_session)
        with patch(
            "backend.services.aip_claude_service.generate_radar_scan",
            new=AsyncMock(return_value="Default scan result"),
        ):
            r = client.post("/api/radar/scan", json={}, headers=h)
        assert r.status_code == 200
