# tests/test_introductions.py
import pytest

INTRODUCTIONS = "/api/introductions"


class TestCreateIntroduction:
    """Tests for introduction creation endpoint."""

    def test_create_introduction_success(self, client, analyst_headers, sample_project):
        """Test successful introduction creation."""
        intro_data = {
            "project_id": sample_project.id,
            "notes": "Interested in this infrastructure project",
            "initiated_by": "investor",
        }
        response = client.post(INTRODUCTIONS, json=intro_data, headers=analyst_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["project_id"] == sample_project.id
        assert data["notes"] == "Interested in this infrastructure project"
        assert "id" in data

    def test_create_introduction_minimal_data(self, client, analyst_headers, sample_project):
        """Test creating introduction with only required fields."""
        intro_data = {"project_id": sample_project.id}
        response = client.post(INTRODUCTIONS, json=intro_data, headers=analyst_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["project_id"] == sample_project.id

    def test_create_introduction_with_investor_id(self, client, analyst_headers, sample_project, sample_investor):
        """Test creating introduction with an associated investor."""
        intro_data = {
            "project_id": sample_project.id,
            "investor_id": sample_investor.id,
            "initiated_by": "platform",
        }
        response = client.post(INTRODUCTIONS, json=intro_data, headers=analyst_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["investor_id"] == sample_investor.id

    def test_create_introduction_missing_project_id(self, client, analyst_headers):
        """Test that missing project_id is rejected."""
        intro_data = {"notes": "No project specified"}
        response = client.post(INTRODUCTIONS, json=intro_data, headers=analyst_headers)
        assert response.status_code == 422

    def test_create_introduction_project_not_found(self, client, analyst_headers):
        """Test that non-existent project_id returns 404."""
        intro_data = {"project_id": "nonexistent-project-id"}
        response = client.post(INTRODUCTIONS, json=intro_data, headers=analyst_headers)
        assert response.status_code == 404
        assert "project not found" in response.json()["detail"].lower()

    def test_create_introduction_requires_auth(self, client, sample_project):
        """Test that unauthenticated request is rejected."""
        intro_data = {"project_id": sample_project.id}
        response = client.post(INTRODUCTIONS, json=intro_data)
        assert response.status_code == 401


class TestListIntroductions:
    """Tests for introduction listing endpoint."""

    def test_list_introductions_empty(self, client, analyst_headers):
        """Test listing introductions when none exist for user."""
        response = client.get(INTRODUCTIONS, headers=analyst_headers)
        assert response.status_code == 200
        body = response.json()
        assert "introductions" in body
        assert body["introductions"] == []
        assert body["count"] == 0

    def test_list_introductions_after_create(self, client, analyst_headers, sample_project):
        """Test that created introductions appear in the list."""
        client.post(INTRODUCTIONS, json={"project_id": sample_project.id},
                    headers=analyst_headers)
        response = client.get(INTRODUCTIONS, headers=analyst_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 1

    def test_list_introductions_requires_auth(self, client):
        """Test that listing requires authentication."""
        response = client.get(INTRODUCTIONS)
        assert response.status_code == 401


class TestUpdateIntroduction:
    """Tests for introduction update endpoint."""

    def test_update_introduction_status(self, client, analyst_headers, sample_project):
        """Test updating introduction status."""
        create_r = client.post(INTRODUCTIONS, json={
            "project_id": sample_project.id,
        }, headers=analyst_headers)
        assert create_r.status_code == 201
        intro_id = create_r.json()["id"]

        response = client.put(f"{INTRODUCTIONS}/{intro_id}", json={
            "status": "active",
        }, headers=analyst_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "active"

    def test_update_introduction_with_notes(self, client, analyst_headers, sample_project):
        """Test updating introduction notes."""
        create_r = client.post(INTRODUCTIONS, json={
            "project_id": sample_project.id,
        }, headers=analyst_headers)
        intro_id = create_r.json()["id"]

        response = client.put(f"{INTRODUCTIONS}/{intro_id}", json={
            "status": "completed",
            "notes": "Deal successfully closed.",
        }, headers=analyst_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["notes"] == "Deal successfully closed."

    def test_update_introduction_not_found(self, client, analyst_headers):
        """Test updating non-existent introduction returns 404."""
        response = client.put(f"{INTRODUCTIONS}/nonexistent-id", json={
            "status": "active",
        }, headers=analyst_headers)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_update_introduction_requires_auth(self, client, analyst_headers, sample_project):
        """Test that update without auth is rejected."""
        create_r = client.post(INTRODUCTIONS, json={
            "project_id": sample_project.id,
        }, headers=analyst_headers)
        intro_id = create_r.json()["id"]

        response = client.put(f"{INTRODUCTIONS}/{intro_id}", json={"status": "active"})
        assert response.status_code == 401


class TestIntroductionWorkflow:
    """Tests for introduction workflow and field handling."""

    def test_initiated_by_platform(self, client, analyst_headers, sample_project):
        """Test introduction initiated by platform."""
        intro_data = {
            "project_id": sample_project.id,
            "initiated_by": "platform",
        }
        response = client.post(INTRODUCTIONS, json=intro_data, headers=analyst_headers)
        assert response.status_code == 201
        assert response.json()["initiated_by"] == "platform"

    def test_initiated_by_investor_default(self, client, analyst_headers, sample_project):
        """Test that initiated_by defaults to investor."""
        intro_data = {"project_id": sample_project.id}
        response = client.post(INTRODUCTIONS, json=intro_data, headers=analyst_headers)
        assert response.status_code == 201
        assert response.json()["initiated_by"] == "investor"

    def test_introduction_with_long_notes(self, client, analyst_headers, sample_project):
        """Test introduction with long notes string."""
        long_notes = "A" * 500
        intro_data = {
            "project_id": sample_project.id,
            "notes": long_notes,
        }
        response = client.post(INTRODUCTIONS, json=intro_data, headers=analyst_headers)
        assert response.status_code == 201
