# tests/test_data_rooms.py
import pytest

DATA_ROOMS = "/api/data-rooms"


class TestCreateDataRoom:
    """Tests for data room creation endpoint."""

    def test_create_data_room_success(self, client, admin_headers):
        """Test successful data room creation."""
        data_room_data = {
            "project_id": "proj-001",
            "name": "Nairobi Solar Farm - Due Diligence Room",
        }
        response = client.post(DATA_ROOMS, json=data_room_data, headers=admin_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["project_id"] == "proj-001"
        assert data["name"] == "Nairobi Solar Farm - Due Diligence Room"
        assert "id" in data

    def test_create_data_room_with_description(self, client, admin_headers):
        """Test creating data room with optional description."""
        data_room_data = {
            "project_id": "proj-002",
            "name": "Lagos Port - Investor Room",
            "description": "Restricted access room for accredited investors only",
        }
        response = client.post(DATA_ROOMS, json=data_room_data, headers=admin_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["description"] == "Restricted access room for accredited investors only"

    def test_create_data_room_with_access_level(self, client, admin_headers):
        """Test creating data room with specified access level."""
        data_room_data = {
            "project_id": "proj-003",
            "name": "Public Project Room",
            "access_level": "public",
        }
        response = client.post(DATA_ROOMS, json=data_room_data, headers=admin_headers)
        assert response.status_code == 201

    def test_create_data_room_missing_project_id(self, client, admin_headers):
        """Test that missing project_id is rejected."""
        data_room_data = {
            "name": "Orphan Room",
        }
        response = client.post("/api/data-rooms", json=data_room_data, headers=admin_headers)
        assert response.status_code == 422

    def test_create_data_room_missing_name(self, client, admin_headers):
        """Test that missing name is rejected."""
        data_room_data = {
            "project_id": "proj-004",
        }
        response = client.post(DATA_ROOMS, json=data_room_data, headers=admin_headers)
        assert response.status_code == 422

    def test_create_data_room_requires_admin(self, client, analyst_headers):
        """Test that non-admin cannot create data rooms."""
        data_room_data = {
            "project_id": "proj-005",
            "name": "Unauthorized Room",
        }
        response = client.post(DATA_ROOMS, json=data_room_data, headers=analyst_headers)
        assert response.status_code == 403

    def test_create_data_room_requires_auth(self, client):
        """Test that unauthenticated request is rejected."""
        data_room_data = {"project_id": "proj-006", "name": "No Auth Room"}
        response = client.post(DATA_ROOMS, json=data_room_data)
        assert response.status_code == 401


class TestGetDataRoom:
    """Tests for data room retrieval endpoint."""

    def test_get_data_room_success(self, client, admin_headers, analyst_headers):
        """Test successful data room retrieval."""
        create_response = client.post(DATA_ROOMS, json={
            "project_id": "proj-get-001",
            "name": "Retrievable Room",
        }, headers=admin_headers)
        assert create_response.status_code == 201
        room_id = create_response.json()["id"]

        response = client.get(f"{DATA_ROOMS}/{room_id}", headers=analyst_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == room_id
        assert data["project_id"] == "proj-get-001"

    def test_get_data_room_not_found(self, client, analyst_headers):
        """Test retrieving non-existent data room returns 404."""
        response = client.get(f"{DATA_ROOMS}/nonexistent-id", headers=analyst_headers)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_data_room_requires_auth(self, client):
        """Test that unauthenticated access is rejected."""
        response = client.get(f"{DATA_ROOMS}/some-id")
        assert response.status_code == 401


class TestListDataRooms:
    """Tests for data room listing endpoint."""

    def test_list_data_rooms_empty(self, client, admin_headers):
        """Test listing data rooms when none exist."""
        response = client.get(DATA_ROOMS, headers=admin_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["data_rooms"] == []
        assert body["count"] == 0

    def test_list_data_rooms_multiple(self, client, admin_headers):
        """Test listing multiple data rooms."""
        for i in range(3):
            client.post(DATA_ROOMS, json={
                "project_id": f"proj-list-{i}",
                "name": f"Room {i}",
            }, headers=admin_headers)

        response = client.get(DATA_ROOMS, headers=admin_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 3

    def test_list_data_rooms_requires_auth(self, client):
        """Test that listing data rooms requires authentication."""
        response = client.get(DATA_ROOMS)
        assert response.status_code == 401


class TestDataRoomDocuments:
    """Tests for data room document management."""

    def test_list_documents_empty(self, client, admin_headers, analyst_headers):
        """Test listing documents in an empty data room."""
        create_r = client.post(DATA_ROOMS, json={
            "project_id": "proj-docs-001",
            "name": "Empty Doc Room",
        }, headers=admin_headers)
        room_id = create_r.json()["id"]

        response = client.get(f"{DATA_ROOMS}/{room_id}/documents", headers=analyst_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["documents"] == []
        assert body["count"] == 0

    def test_list_documents_requires_auth(self, client, admin_headers):
        """Test that listing documents requires authentication."""
        create_r = client.post(DATA_ROOMS, json={
            "project_id": "proj-docs-002",
            "name": "Auth Check Room",
        }, headers=admin_headers)
        room_id = create_r.json()["id"]

        response = client.get(f"{DATA_ROOMS}/{room_id}/documents")
        assert response.status_code == 401
