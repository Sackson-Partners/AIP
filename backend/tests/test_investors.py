# tests/test_investors.py
import pytest

INVESTORS = "/api/investors"


class TestCreateInvestor:
    """Tests for investor creation endpoint."""

    def test_create_investor_success(self, client, sample_investor_data, analyst_headers):
        """Test successful investor creation."""
        response = client.post(INVESTORS, json=sample_investor_data, headers=analyst_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["organisation_name"] == sample_investor_data["organisation_name"]
        assert "id" in data

    def test_create_investor_minimal_data(self, client, analyst_headers):
        """Test creating investor with only required fields."""
        minimal_data = {"organisation_name": "Minimal Fund"}
        response = client.post(INVESTORS, json=minimal_data, headers=analyst_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["organisation_name"] == "Minimal Fund"

    def test_create_investor_missing_required_fields(self, client, analyst_headers):
        """Test that missing required fields are rejected."""
        incomplete_data = {"investor_type": "dfi"}
        response = client.post(INVESTORS, json=incomplete_data, headers=analyst_headers)
        assert response.status_code == 422

    def test_create_investor_with_preferred_structures(self, client, analyst_headers):
        """Test that preferred_structures list is accepted."""
        data = {
            "organisation_name": "Structured Fund",
            "preferred_structures": ["equity", "mezzanine"],
        }
        response = client.post(INVESTORS, json=data, headers=analyst_headers)
        assert response.status_code == 201

    def test_create_investor_with_focus_sectors(self, client, analyst_headers):
        """Test that focus_sectors list is accepted."""
        data = {
            "organisation_name": "Sector Fund",
            "focus_sectors": ["energy", "transport"],
        }
        response = client.post(INVESTORS, json=data, headers=analyst_headers)
        assert response.status_code == 201

    def test_create_investor_multiple_focus_fields(self, client, analyst_headers):
        """Test creating investor with multiple list fields."""
        data = {
            "organisation_name": "Multi-Focus Fund",
            "focus_sectors": ["energy", "transport", "water"],
            "focus_regions": ["East Africa", "West Africa"],
            "preferred_structures": ["equity", "debt"],
        }
        response = client.post(INVESTORS, json=data, headers=analyst_headers)
        assert response.status_code == 201


class TestGetInvestor:
    """Tests for investor retrieval endpoint."""

    def test_get_investor_success(self, client, sample_investor_data, analyst_headers):
        """Test successful investor retrieval."""
        create_response = client.post(INVESTORS, json=sample_investor_data, headers=analyst_headers)
        investor_id = create_response.json()["id"]

        response = client.get(f"{INVESTORS}/{investor_id}", headers=analyst_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == investor_id
        assert data["organisation_name"] == sample_investor_data["organisation_name"]

    def test_get_investor_not_found(self, client, analyst_headers):
        """Test retrieving non-existent investor returns 404."""
        response = client.get(f"{INVESTORS}/nonexistent-id", headers=analyst_headers)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_investor_unauthenticated(self, client):
        """Test retrieving investor without auth returns 401."""
        response = client.get(f"{INVESTORS}/some-id")
        assert response.status_code == 401


class TestInvestorDataIntegrity:
    """Tests for investor data integrity and edge cases."""

    def test_investor_ticket_size_strings(self, client, analyst_headers):
        """Test investor with min/max ticket size as strings."""
        data = {
            "organisation_name": "Range Test Fund",
            "min_ticket_usd": "1000000",
            "max_ticket_usd": "100000000",
        }
        response = client.post(INVESTORS, json=data, headers=analyst_headers)
        assert response.status_code == 201
        result = response.json()
        assert result["min_ticket_usd"] == "1000000"
        assert result["max_ticket_usd"] == "100000000"

    def test_investor_with_contact_info(self, client, analyst_headers):
        """Test investor with contact name and email."""
        data = {
            "organisation_name": "Contact Fund",
            "contact_name": "Jane Smith",
            "contact_email": "jane@fund.example.com",
        }
        response = client.post(INVESTORS, json=data, headers=analyst_headers)
        assert response.status_code == 201
        result = response.json()
        assert result["contact_name"] == "Jane Smith"

    def test_investor_with_aum(self, client, analyst_headers):
        """Test investor with AUM field."""
        data = {
            "organisation_name": "Large AUM Fund",
            "aum_usd": "500000000",
            "investor_type": "dfi",
        }
        response = client.post(INVESTORS, json=data, headers=analyst_headers)
        assert response.status_code == 201
        result = response.json()
        assert result["aum_usd"] == "500000000"

    def test_multiple_investors_independent(self, client, sample_investor_data, analyst_headers):
        """Test that multiple investors are stored independently."""
        response1 = client.post(INVESTORS, json=sample_investor_data, headers=analyst_headers)
        id1 = response1.json()["id"]

        modified_data = sample_investor_data.copy()
        modified_data["organisation_name"] = "Different Fund"
        response2 = client.post(INVESTORS, json=modified_data, headers=analyst_headers)
        id2 = response2.json()["id"]

        assert id1 != id2

        get1 = client.get(f"{INVESTORS}/{id1}", headers=analyst_headers)
        get2 = client.get(f"{INVESTORS}/{id2}", headers=analyst_headers)

        assert get1.json()["organisation_name"] == sample_investor_data["organisation_name"]
        assert get2.json()["organisation_name"] == "Different Fund"


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
