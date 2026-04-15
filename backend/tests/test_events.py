# tests/test_events.py
import pytest
from datetime import date, timedelta


class TestCreateEvent:
    """Tests for event creation endpoint."""

    def test_create_event_success(self, client):
        """Test successful event creation."""
        event_data = {
            "name": "Africa Infrastructure Forum 2024",
            "description": "Annual gathering of infrastructure investors and project sponsors",
            "event_date": str(date.today() + timedelta(days=30)),
            "type": "Forum",
            "projects_involved": [1, 2, 3]
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == event_data["name"]
        assert data["type"] == "Forum"
        assert "id" in data

    def test_create_event_minimal_data(self, client):
        """Test creating event with only required fields."""
        event_data = {
            "name": "Quick Meeting",
            "description": "Brief project discussion",
            "event_date": str(date.today()),
            "type": "Meeting"
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 200
        data = response.json()
        assert data["projects_involved"] is None or data["projects_involved"] == []

    def test_create_event_roundtable(self, client):
        """Test creating a roundtable event."""
        event_data = {
            "name": "Energy Sector Roundtable",
            "description": "Discussion on renewable energy investments in West Africa",
            "event_date": str(date.today() + timedelta(days=14)),
            "type": "Roundtable",
            "projects_involved": [10, 11, 12, 13, 14]
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 200
        assert response.json()["type"] == "Roundtable"

    def test_create_event_past_date(self, client):
        """Test creating event with past date (should be allowed for records)."""
        event_data = {
            "name": "Past Conference",
            "description": "Historical event record",
            "event_date": str(date.today() - timedelta(days=365)),
            "type": "Conference"
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 200

    def test_create_event_missing_required_fields(self, client, admin_headers):
        """Test that missing required fields are rejected."""
        incomplete_data = {"name": "Incomplete Event"}
        response = client.post("/api/events", json=incomplete_data, headers=admin_headers)
        assert response.status_code == 422


class TestGetEvent:
    """Tests for event retrieval endpoint."""

    def test_get_event_success(self, client):
        """Test successful event retrieval."""
        # Create event
        event_data = {
            "name": "Retrievable Event",
            "description": "Test event for retrieval",
            "event_date": str(date.today()),
            "type": "Webinar"
        }
        create_response = client.post("/events/", json=event_data)
        event_id = create_response.json()["id"]

        # Retrieve event
        response = client.get(f"/events/{event_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == event_id
        assert data["name"] == "Retrievable Event"

    def test_get_event_not_found(self, client):
        """Test retrieving non-existent event returns 404."""
        response = client.get("/events/99999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_event_invalid_id(self, client):
        """Test retrieving with invalid ID format."""
        response = client.get("/events/invalid")
        assert response.status_code == 422


class TestListEvents:
    """Tests for event listing endpoint."""

    def test_list_events_empty(self, client):
        """Test listing events when none exist."""
        response = client.get("/events/")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_events_multiple(self, client):
        """Test listing multiple events."""
        event_types = ["Forum", "Roundtable", "Webinar"]
        for i, event_type in enumerate(event_types):
            client.post("/events/", json={
                "name": f"Event {i}",
                "description": f"Description {i}",
                "event_date": str(date.today() + timedelta(days=i)),
                "type": event_type
            })

        response = client.get("/events/")
        assert response.status_code == 200
        assert len(response.json()) == 3

    def test_list_events_with_pagination(self, client):
        """Test listing events with pagination."""
        # Create 5 events
        for i in range(5):
            client.post("/events/", json={
                "name": f"Paginated Event {i}",
                "description": f"Description {i}",
                "event_date": str(date.today()),
                "type": "Meeting"
            })

        # Get first 2
        response = client.get("/events/?skip=0&limit=2")
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_list_events_filter_by_type(self, client):
        """Test filtering events by type."""
        # Create events of different types
        types = ["Forum", "Webinar", "Forum", "Roundtable"]
        for i, event_type in enumerate(types):
            client.post("/events/", json={
                "name": f"Typed Event {i}",
                "description": f"Description {i}",
                "event_date": str(date.today()),
                "type": event_type
            })

        # Filter by Forum
        response = client.get("/events/?event_type=Forum")
        assert response.status_code == 200
        events = response.json()
        assert len(events) == 2
        for event in events:
            assert event["type"] == "Forum"


class TestEventTypes:
    """Tests for various event types."""

    def test_all_event_types(self, client):
        """Test creating events of all common types."""
        event_types = [
            "Forum",
            "Roundtable",
            "Webinar",
            "Conference",
            "Meeting",
            "Workshop",
            "Presentation"
        ]

        for event_type in event_types:
            event_data = {
                "name": f"{event_type} Event",
                "description": f"A {event_type.lower()} event",
                "event_date": str(date.today()),
                "type": event_type
            }
            response = client.post("/events/", json=event_data)
            assert response.status_code == 200
            assert response.json()["type"] == event_type


class TestEventProjects:
    """Tests for event-project associations."""

    def test_event_with_no_projects(self, client):
        """Test event without associated projects."""
        event_data = {
            "name": "No Projects Event",
            "description": "General discussion",
            "event_date": str(date.today()),
            "type": "Meeting"
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 200

    def test_event_with_single_project(self, client):
        """Test event with one associated project."""
        event_data = {
            "name": "Single Project Event",
            "description": "Project-specific discussion",
            "event_date": str(date.today()),
            "type": "Roundtable",
            "projects_involved": [42]
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 200

    def test_event_with_many_projects(self, client):
        """Test event with many associated projects."""
        event_data = {
            "name": "Multi-Project Event",
            "description": "Cross-project forum",
            "event_date": str(date.today()),
            "type": "Forum",
            "projects_involved": list(range(1, 21))  # 20 projects
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 200
