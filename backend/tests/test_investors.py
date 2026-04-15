# tests/test_investors.py
import pytest


class TestCreateInvestor:
    """Tests for investor creation endpoint."""

    def test_create_investor_success(self, client, sample_investor_data):
        """Test successful investor creation."""
        response = client.post("/investors/", json=sample_investor_data)
        assert response.status_code == 200
        data = response.json()
        assert data["fund_name"] == sample_investor_data["fund_name"]
        assert data["aum"] == sample_investor_data["aum"]
        assert data["ticket_size_min"] == sample_investor_data["ticket_size_min"]
        assert data["ticket_size_max"] == sample_investor_data["ticket_size_max"]
        assert "id" in data

    def test_create_investor_minimal_data(self, client):
        """Test creating investor with only required fields."""
        minimal_data = {
            "fund_name": "Minimal Fund",
            "ticket_size_min": 500000.0,
            "ticket_size_max": 10000000.0,
            "instruments": ["Equity"],
            "country_focus": ["Kenya"],
            "sector_focus": ["Energy"]
        }
        response = client.post("/investors/", json=minimal_data)
        assert response.status_code == 200
        data = response.json()
        assert data["fund_name"] == "Minimal Fund"
        assert data["aum"] is None  # Optional field

    def test_create_investor_missing_required_fields(self, client):
        """Test that missing required fields are rejected."""
        incomplete_data = {"fund_name": "Incomplete Fund"}
        response = client.post("/investors/", json=incomplete_data)
        assert response.status_code == 422  # Validation error

    def test_create_investor_with_custom_instrument(self, client):
        """Test that custom instrument values are accepted (stored as strings)."""
        data = {
            "fund_name": "Custom Instrument Fund",
            "ticket_size_min": 500000.0,
            "ticket_size_max": 10000000.0,
            "instruments": ["CustomInstrument"],
            "country_focus": ["Kenya"],
            "sector_focus": ["Energy"]
        }
        response = client.post("/investors/", json=data)
        # API accepts any string for instruments (flexible schema)
        assert response.status_code == 200
        assert "CustomInstrument" in response.json()["instruments"]

    def test_create_investor_with_custom_sector(self, client):
        """Test that custom sector values are accepted (stored as strings)."""
        data = {
            "fund_name": "Custom Sector Fund",
            "ticket_size_min": 500000.0,
            "ticket_size_max": 10000000.0,
            "instruments": ["Equity"],
            "country_focus": ["Kenya"],
            "sector_focus": ["CustomSector"]
        }
        response = client.post("/investors/", json=data)
        # API accepts any string for sector_focus (flexible schema)
        assert response.status_code == 200
        assert "CustomSector" in response.json()["sector_focus"]

    def test_create_investor_multiple_instruments(self, client):
        """Test creating investor with multiple instruments."""
        data = {
            "fund_name": "Multi Instrument Fund",
            "ticket_size_min": 1000000.0,
            "ticket_size_max": 50000000.0,
            "instruments": ["Equity", "Debt", "Mezzanine"],
            "country_focus": ["Nigeria", "Kenya"],
            "sector_focus": ["Energy", "Transport", "Water"]
        }
        response = client.post("/investors/", json=data)
        assert response.status_code == 200
        result = response.json()
        assert len(result["instruments"]) == 3
        assert len(result["sector_focus"]) == 3


class TestGetInvestor:
    """Tests for investor retrieval endpoint."""

    def test_get_investor_success(self, client, sample_investor_data):
        """Test successful investor retrieval."""
        # Create investor first
        create_response = client.post("/investors/", json=sample_investor_data)
        investor_id = create_response.json()["id"]

        # Retrieve investor
        response = client.get(f"/investors/{investor_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == investor_id
        assert data["fund_name"] == sample_investor_data["fund_name"]

    def test_get_investor_not_found(self, client):
        """Test retrieving non-existent investor returns 404."""
        response = client.get("/investors/99999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_investor_invalid_id(self, client):
        """Test retrieving with invalid ID format."""
        response = client.get("/investors/invalid")
        assert response.status_code == 422  # Validation error


class TestInvestorDataIntegrity:
    """Tests for investor data integrity and edge cases."""

    def test_investor_ticket_size_range(self, client):
        """Test investor with valid ticket size range."""
        data = {
            "fund_name": "Range Test Fund",
            "ticket_size_min": 100000.0,
            "ticket_size_max": 100000000.0,
            "instruments": ["Equity"],
            "country_focus": ["Kenya"],
            "sector_focus": ["Energy"]
        }
        response = client.post("/investors/", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["ticket_size_min"] == 100000.0
        assert result["ticket_size_max"] == 100000000.0

    def test_investor_with_esg_constraints(self, client):
        """Test investor with ESG constraints."""
        data = {
            "fund_name": "ESG Fund",
            "ticket_size_min": 1000000.0,
            "ticket_size_max": 50000000.0,
            "instruments": ["Equity"],
            "country_focus": ["Nigeria"],
            "sector_focus": ["Energy"],
            "esg_constraints": "No fossil fuels, minimum 30% women in management"
        }
        response = client.post("/investors/", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["esg_constraints"] == data["esg_constraints"]

    def test_investor_with_target_irr(self, client):
        """Test investor with target IRR."""
        data = {
            "fund_name": "High Return Fund",
            "ticket_size_min": 5000000.0,
            "ticket_size_max": 100000000.0,
            "instruments": ["Equity", "Mezzanine"],
            "target_irr": 25.5,
            "country_focus": ["South Africa"],
            "sector_focus": ["Mining"]
        }
        response = client.post("/investors/", json=data)
        assert response.status_code == 200
        result = response.json()
        assert result["target_irr"] == 25.5

    def test_multiple_investors_independent(self, client, sample_investor_data):  # noqa: F811
        """Test that multiple investors are stored independently."""
        # Create first investor
        response1 = client.post("/investors/", json=sample_investor_data)
        id1 = response1.json()["id"]

        # Create second investor with different name
        modified_data = sample_investor_data.copy()
        modified_data["fund_name"] = "Different Fund"
        response2 = client.post("/investors/", json=modified_data)
        id2 = response2.json()["id"]

        # Verify they are different
        assert id1 != id2

        # Verify both can be retrieved
        get1 = client.get(f"/investors/{id1}")
        get2 = client.get(f"/investors/{id2}")

        assert get1.json()["fund_name"] == sample_investor_data["fund_name"]
        assert get2.json()["fund_name"] == "Different Fund"


# ── Tests for the actual AIP investors API ──────────────────────────────────

import uuid
from backend.models import User
from backend.security.auth import hash_password, create_access_token

INVESTORS = "/api/investors"


def _make_analyst_headers(db_session):
    user = User(
        email=f"inv_{uuid.uuid4().hex[:8]}@aip.test",
        hashed_password=hash_password("TestPass@123!"),
        role="analyst",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token({"sub": user.email, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}


class TestAIPInvestors:
    def test_list_investors_authenticated(self, client, db_session):
        headers = _make_analyst_headers(db_session)
        r = client.get(INVESTORS, headers=headers)
        assert r.status_code == 200
        assert "investors" in r.json()

    def test_list_investors_unauthenticated(self, client):
        r = client.get(INVESTORS)
        assert r.status_code == 401

    def test_create_investor_aip_schema(self, client, db_session):
        headers = _make_analyst_headers(db_session)
        r = client.post(INVESTORS, json={
            "organisation_name": "Africa Clean Energy Fund",
            "investor_type": "private_fund",
            "min_ticket_usd": "5000000",
            "max_ticket_usd": "50000000",
        }, headers=headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["organisation_name"] == "Africa Clean Energy Fund"

    def test_create_investor_missing_required_field(self, client, db_session):
        headers = _make_analyst_headers(db_session)
        r = client.post(INVESTORS, json={"investor_type": "dfi"}, headers=headers)
        assert r.status_code == 422

    def test_get_investor_by_id(self, client, db_session):
        headers = _make_analyst_headers(db_session)
        create_r = client.post(INVESTORS, json={
            "organisation_name": "Get Me Fund",
        }, headers=headers)
        assert create_r.status_code == 201
        investor_id = create_r.json()["id"]

        r = client.get(f"{INVESTORS}/{investor_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["id"] == investor_id

    def test_get_investor_not_found(self, client, db_session):
        headers = _make_analyst_headers(db_session)
        r = client.get(f"{INVESTORS}/nonexistent-id", headers=headers)
        assert r.status_code == 404

    def test_patch_investor(self, client, db_session):
        headers = _make_analyst_headers(db_session)
        create_r = client.post(INVESTORS, json={
            "organisation_name": "Old Name Fund",
        }, headers=headers)
        assert create_r.status_code == 201
        investor_id = create_r.json()["id"]

        r = client.patch(f"{INVESTORS}/{investor_id}", json={
            "organisation_name": "New Name Fund",
            "investor_type": "dfi",
        }, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["organisation_name"] == "New Name Fund"
        assert r.json()["investor_type"] == "dfi"

    def test_patch_investor_not_found(self, client, db_session):
        headers = _make_analyst_headers(db_session)
        r = client.patch(f"{INVESTORS}/nonexistent-id", json={
            "organisation_name": "Ghost",
        }, headers=headers)
        assert r.status_code == 404
