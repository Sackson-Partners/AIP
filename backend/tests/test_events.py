# tests/test_events.py
import pytest
from datetime import datetime, timedelta, timezone

EVENTS = "/api/events"


class TestCreateEvent:
    """Tests for event creation endpoint."""

    def test_create_event_success(self, client, admin_headers):
        """Test successful event creation."""
        event_data = {
            "project_id": "proj-001",
            "event_type": "milestone",
            "title": "Financial Close Reached",
            "description": "Project achieved financial close with lead arrangers",
            "event_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        }
        response = client.post(EVENTS, json=event_data, headers=admin_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == event_data["title"]
        assert data["event_type"] == "milestone"
        assert "id" in data

    def test_create_event_minimal_data(self, client, admin_headers):
        """Test creating event with only required fields."""
        event_data = {
            "project_id": "proj-002",
            "event_type": "milestone",
            "title": "Quick Milestone",
        }
        response = client.post(EVENTS, json=event_data, headers=admin_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Quick Milestone"

    def test_create_event_financing_type(self, client, admin_headers):
        """Test creating a financing event."""
        event_data = {
            "project_id": "proj-003",
            "event_type": "financing",
            "title": "IFC Debt Tranche Signed",
        }
        response = client.post(EVENTS, json=event_data, headers=admin_headers)
        assert response.status_code == 201
        assert response.json()["event_type"] == "financing"

    def test_create_event_past_date(self, client, admin_headers):
        """Test creating event with past date (should be allowed for records)."""
        event_data = {
            "project_id": "proj-004",
            "event_type": "completion",
            "title": "Historical Completion",
            "event_date": (datetime.now(timezone.utc) - timedelta(days=365)).isoformat(),
        }
        response = client.post(EVENTS, json=event_data, headers=admin_headers)
        assert response.status_code == 201

    def test_create_event_missing_required_fields(self, client, admin_headers):
        """Test that missing required fields are rejected."""
        incomplete_data = {"name": "Incomplete Event"}
        response = client.post("/api/events", json=incomplete_data, headers=admin_headers)
        assert response.status_code == 422

    def test_create_event_requires_auth(self, client):
        """Test that event creation without auth returns 401."""
        event_data = {
            "project_id": "proj-005",
            "event_type": "milestone",
            "title": "Unauthorized Event",
        }
        response = client.post(EVENTS, json=event_data)
        assert response.status_code == 401


class TestGetEvent:
    """Tests for event retrieval endpoint."""

    def test_get_event_success(self, client, admin_headers):
        """Test successful event retrieval."""
        event_data = {
            "project_id": "proj-get-001",
            "event_type": "tender",
            "title": "Retrievable Event",
        }
        create_response = client.post(EVENTS, json=event_data, headers=admin_headers)
        assert create_response.status_code == 201
        event_id = create_response.json()["id"]

        response = client.get(f"{EVENTS}/{event_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == event_id
        assert data["title"] == "Retrievable Event"

    def test_get_event_not_found(self, client):
        """Test retrieving non-existent event returns 404."""
        response = client.get(f"{EVENTS}/nonexistent-id")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_event_returns_aliases(self, client, admin_headers):
        """Test that response includes both title/event_type and name/type aliases."""
        event_data = {
            "project_id": "proj-alias-001",
            "event_type": "delay",
            "title": "Alias Check Event",
        }
        create_r = client.post(EVENTS, json=event_data, headers=admin_headers)
        event_id = create_r.json()["id"]

        response = client.get(f"{EVENTS}/{event_id}")
        data = response.json()
        assert data["title"] == "Alias Check Event"
        assert data["name"] == "Alias Check Event"
        assert data["event_type"] == "delay"
        assert data["type"] == "delay"


class TestListEvents:
    """Tests for event listing endpoint."""

    def test_list_events_empty(self, client):
        """Test listing events when none exist."""
        response = client.get(EVENTS)
        assert response.status_code == 200
        body = response.json()
        assert body["events"] == []
        assert body["count"] == 0

    def test_list_events_multiple(self, client, admin_headers):
        """Test listing multiple events."""
        event_types = ["milestone", "financing", "tender"]
        for i, event_type in enumerate(event_types):
            client.post(EVENTS, json={
                "project_id": f"proj-list-{i}",
                "event_type": event_type,
                "title": f"Event {i}",
            }, headers=admin_headers)

        response = client.get(EVENTS)
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 3
        assert len(body["events"]) == 3

    def test_list_events_with_limit(self, client, admin_headers):
        """Test listing events with limit parameter."""
        for i in range(5):
            client.post(EVENTS, json={
                "project_id": "proj-limit-001",
                "event_type": "milestone",
                "title": f"Paginated Event {i}",
            }, headers=admin_headers)

        response = client.get(f"{EVENTS}?limit=2")
        assert response.status_code == 200
        body = response.json()
        assert len(body["events"]) == 2

    def test_list_events_filter_by_event_type(self, client, admin_headers):
        """Test filtering events by event_type."""
        types = ["milestone", "financing", "milestone", "tender"]
        for i, event_type in enumerate(types):
            client.post(EVENTS, json={
                "project_id": f"proj-filter-{i}",
                "event_type": event_type,
                "title": f"Typed Event {i}",
            }, headers=admin_headers)

        response = client.get(f"{EVENTS}?event_type=milestone")
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 2
        for event in body["events"]:
            assert event["event_type"] == "milestone"

    def test_list_events_filter_by_project(self, client, admin_headers):
        """Test filtering events by project_id."""
        client.post(EVENTS, json={
            "project_id": "proj-alpha",
            "event_type": "milestone",
            "title": "Alpha Milestone",
        }, headers=admin_headers)
        client.post(EVENTS, json={
            "project_id": "proj-beta",
            "event_type": "milestone",
            "title": "Beta Milestone",
        }, headers=admin_headers)

        response = client.get(f"{EVENTS}?project_id=proj-alpha")
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 1
        assert body["events"][0]["project_id"] == "proj-alpha"


class TestEventTypes:
    """Tests for various event types."""

    def test_all_event_types(self, client, admin_headers):
        """Test creating events of all common types."""
        event_types = ["milestone", "financing", "tender", "delay", "completion"]

        for event_type in event_types:
            event_data = {
                "project_id": f"proj-type-{event_type}",
                "event_type": event_type,
                "title": f"{event_type.title()} Event",
            }
            response = client.post(EVENTS, json=event_data, headers=admin_headers)
            assert response.status_code == 201
            assert response.json()["event_type"] == event_type
