# tests/test_analytics.py
import pytest

TRACK = "/api/analytics/track"
SUMMARY = "/api/analytics/summary"
ANALYTICS = "/api/analytics"


class TestTrackEvent:
    """Tests for analytics event tracking endpoint."""

    def test_track_event_success(self, client, analyst_headers):
        """Test successful event tracking."""
        event_data = {"event_type": "project_view"}
        response = client.post(TRACK, json=event_data, headers=analyst_headers)
        assert response.status_code == 201
        assert response.json()["success"] is True

    def test_track_event_with_entity(self, client, analyst_headers):
        """Test tracking event with entity info."""
        event_data = {
            "event_type": "investor_profile_view",
            "entity_type": "investor",
            "entity_id": "inv-001",
        }
        response = client.post(TRACK, json=event_data, headers=analyst_headers)
        assert response.status_code == 201
        assert response.json()["success"] is True

    def test_track_event_with_metadata(self, client, analyst_headers):
        """Test tracking event with metadata dict."""
        event_data = {
            "event_type": "search",
            "metadata": {"query": "solar energy Nigeria", "results": "5"},
        }
        response = client.post(TRACK, json=event_data, headers=analyst_headers)
        assert response.status_code == 201

    def test_track_event_missing_required_field(self, client, analyst_headers):
        """Test that missing event_type is rejected."""
        response = client.post(TRACK, json={"entity_type": "project"}, headers=analyst_headers)
        assert response.status_code == 422

    def test_track_event_requires_auth(self, client):
        """Test that tracking without auth returns 401."""
        response = client.post(TRACK, json={"event_type": "page_view"})
        assert response.status_code == 401

    def test_track_multiple_event_types(self, client, analyst_headers):
        """Test tracking various event types."""
        event_types = ["page_view", "project_view", "search", "download", "login"]
        for event_type in event_types:
            r = client.post(TRACK, json={"event_type": event_type}, headers=analyst_headers)
            assert r.status_code == 201

    def test_track_event_metadata_too_many_keys(self, client, analyst_headers):
        """Test that metadata with more than 10 keys is rejected."""
        metadata = {f"key_{i}": f"value_{i}" for i in range(11)}
        event_data = {"event_type": "test", "metadata": metadata}
        response = client.post(TRACK, json=event_data, headers=analyst_headers)
        assert response.status_code == 422

    def test_track_event_metadata_value_too_long(self, client, analyst_headers):
        """Test that metadata value exceeding 255 characters is rejected."""
        event_data = {
            "event_type": "test",
            "metadata": {"key": "x" * 256},
        }
        response = client.post(TRACK, json=event_data, headers=analyst_headers)
        assert response.status_code == 422

    def test_track_event_metadata_max_keys_allowed(self, client, analyst_headers):
        """Test that metadata with exactly 10 keys is accepted."""
        metadata = {f"key_{i}": f"value_{i}" for i in range(10)}
        event_data = {"event_type": "test", "metadata": metadata}
        response = client.post(TRACK, json=event_data, headers=analyst_headers)
        assert response.status_code == 201


class TestAnalyticsSummary:
    """Tests for analytics summary endpoint."""

    def test_summary_admin_access(self, client, admin_headers):
        """Test that admin can access summary."""
        response = client.get(SUMMARY, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_events" in data
        assert "by_type" in data

    def test_summary_non_admin_forbidden(self, client, analyst_headers):
        """Test that non-admin users cannot access summary."""
        response = client.get(SUMMARY, headers=analyst_headers)
        assert response.status_code == 403

    def test_summary_requires_auth(self, client):
        """Test that summary requires authentication."""
        response = client.get(SUMMARY)
        assert response.status_code == 401

    def test_summary_counts_tracked_events(self, client, admin_headers):
        """Test that summary correctly counts tracked events."""
        # Track some events first
        for _ in range(3):
            client.post(TRACK, json={"event_type": "project_view"}, headers=admin_headers)
        client.post(TRACK, json={"event_type": "search"}, headers=admin_headers)

        response = client.get(SUMMARY, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_events"] == 4
        assert data["by_type"]["project_view"] == 3
        assert data["by_type"]["search"] == 1


class TestAnalyticsRoot:
    """Tests for analytics root endpoint."""

    def test_analytics_root_authenticated(self, client, analyst_headers):
        """Test that authenticated users can access the analytics root."""
        response = client.get(ANALYTICS, headers=analyst_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_events" in data

    def test_analytics_root_requires_auth(self, client):
        """Test that analytics root requires authentication."""
        response = client.get(ANALYTICS)
        assert response.status_code == 401
