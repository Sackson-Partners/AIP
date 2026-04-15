# tests/test_integration.py
"""
Integration tests for end-to-end workflows.
These tests verify that multiple components work together correctly.
"""
import pytest
from datetime import datetime, timezone, timedelta


def _make_project(db_session, name="Test Project", country="Kenya", sector="energy"):
    """Helper: create an InfrastructureProject directly in the test DB."""
    from backend.models import InfrastructureProject
    project = InfrastructureProject(
        project_name=name,
        country=country,
        sector=sector,
        region="East Africa",
        project_type="IPP",
        estimated_cost="USD 50M",
        status="planned",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


class TestProjectInvestorIntroductionWorkflow:
    """
    Test the complete workflow:
    Project → Investor registration → Introduction
    """

    def test_complete_introduction_workflow(self, client, analyst_headers, db_session):
        """Test the full introduction workflow: project + investor + introduction."""
        # Step 1: Create a project in DB
        project = _make_project(db_session, name="Lagos Solar Farm", country="Nigeria", sector="energy")

        # Step 2: Create an investor via API
        investor_r = client.post("/api/investors", json={
            "organisation_name": "Africa Clean Energy Fund",
            "investor_type": "private_fund",
            "min_ticket_usd": "5000000",
            "max_ticket_usd": "100000000",
        }, headers=analyst_headers)
        assert investor_r.status_code == 201
        investor_id = investor_r.json()["id"]

        # Step 3: Create an introduction
        intro_r = client.post("/api/introductions", json={
            "project_id": project.id,
            "investor_id": investor_id,
            "notes": "Interested in this solar project",
            "initiated_by": "investor",
        }, headers=analyst_headers)
        assert intro_r.status_code == 201
        intro_id = intro_r.json()["id"]
        assert intro_r.json()["project_id"] == project.id

        # Step 4: Verify it appears in user's introductions list
        list_r = client.get("/api/introductions", headers=analyst_headers)
        assert list_r.status_code == 200
        assert list_r.json()["count"] == 1

        # Step 5: Update introduction status to active
        update_r = client.put(f"/api/introductions/{intro_id}", json={
            "status": "active",
            "notes": "NDA signed, progressing to due diligence.",
        }, headers=analyst_headers)
        assert update_r.status_code == 200
        assert update_r.json()["status"] == "active"


class TestVerificationWorkflow:
    """
    Test the user verification workflow.
    """

    def test_verification_submission_and_review(self, client, analyst_headers, admin_headers):
        """Test a user submitting a verification and admin reviewing it."""
        # Submit verification as analyst
        submit_r = client.post("/api/verifications", json={
            "verification_type": "identity",
            "document_url": "https://storage.example.com/docs/passport.jpg",
        }, headers=analyst_headers)
        assert submit_r.status_code == 201
        ver_id = submit_r.json()["id"]
        assert submit_r.json()["verification_type"] == "identity"

        # Admin lists all verifications
        list_r = client.get("/api/verifications", headers=admin_headers)
        assert list_r.status_code == 200
        assert list_r.json()["count"] >= 1

        # Admin approves the verification
        review_r = client.put(f"/api/verifications/{ver_id}/review", json={
            "status": "approved",
            "reviewer_notes": "Identity confirmed.",
        }, headers=admin_headers)
        assert review_r.status_code == 200
        assert review_r.json()["status"] == "approved"

    def test_multiple_verification_types(self, client, analyst_headers):
        """Test submitting all three verification types."""
        for ver_type in ["email", "identity", "accreditation"]:
            r = client.post("/api/verifications", json={
                "verification_type": ver_type,
            }, headers=analyst_headers)
            assert r.status_code == 201

        # Status should show all three
        status_r = client.get("/api/verifications/status", headers=analyst_headers)
        assert status_r.status_code == 200
        assert len(status_r.json()["verifications"]) == 3


class TestProjectDataRoomWorkflow:
    """
    Test the data room workflow:
    Project → Create Data Room → List Documents
    """

    def test_data_room_setup(self, client, admin_headers, analyst_headers):
        """Test setting up a data room for a project."""
        # Create data room
        room_r = client.post("/api/data-rooms", json={
            "project_id": "proj-ghana-port-001",
            "name": "Ghana Port Expansion - Due Diligence",
            "description": "Restricted room for accredited investors",
            "access_level": "restricted",
        }, headers=admin_headers)
        assert room_r.status_code == 201
        room_id = room_r.json()["id"]

        # Retrieve data room
        get_r = client.get(f"/api/data-rooms/{room_id}", headers=analyst_headers)
        assert get_r.status_code == 200
        assert get_r.json()["project_id"] == "proj-ghana-port-001"

        # List documents (should be empty initially)
        docs_r = client.get(f"/api/data-rooms/{room_id}/documents", headers=analyst_headers)
        assert docs_r.status_code == 200
        assert docs_r.json()["count"] == 0


class TestEventWorkflow:
    """
    Test project event creation and listing.
    """

    def test_event_with_project(self, client, admin_headers):
        """Test creating and retrieving a project event."""
        event_r = client.post("/api/events", json={
            "project_id": "proj-sa-energy-001",
            "event_type": "milestone",
            "title": "South Africa Solar Farm Financial Close",
            "description": "Achieved financial close with Standard Bank and DFI partners",
            "event_date": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
        }, headers=admin_headers)
        assert event_r.status_code == 201
        event_id = event_r.json()["id"]

        # Retrieve event
        get_r = client.get(f"/api/events/{event_id}")
        assert get_r.status_code == 200
        assert get_r.json()["title"] == "South Africa Solar Farm Financial Close"

    def test_events_filter_by_project(self, client, admin_headers):
        """Test filtering events by project_id."""
        # Create events for two different projects
        for proj_id, title in [
            ("proj-a", "Project A Milestone"),
            ("proj-b", "Project B Milestone"),
            ("proj-a", "Project A Second Event"),
        ]:
            client.post("/api/events", json={
                "project_id": proj_id,
                "event_type": "milestone",
                "title": title,
            }, headers=admin_headers)

        # Filter for proj-a only
        list_r = client.get("/api/events?project_id=proj-a")
        assert list_r.status_code == 200
        assert list_r.json()["count"] == 2
        for event in list_r.json()["events"]:
            assert event["project_id"] == "proj-a"


class TestAnalyticsWorkflow:
    """
    Test analytics tracking across platform actions.
    """

    def test_track_events_and_check_summary(self, client, admin_headers, analyst_headers):
        """Test tracking events and verifying they appear in the summary."""
        # Track several events as analyst
        for event_type in ["project_view", "project_view", "investor_search", "search"]:
            r = client.post("/api/analytics/track", json={
                "event_type": event_type,
            }, headers=analyst_headers)
            assert r.status_code == 201

        # Admin checks summary
        summary_r = client.get("/api/analytics/summary", headers=admin_headers)
        assert summary_r.status_code == 200
        data = summary_r.json()
        assert data["total_events"] == 4
        assert data["by_type"]["project_view"] == 2

    def test_track_event_with_entity_context(self, client, analyst_headers):
        """Test tracking events with full entity context and metadata."""
        r = client.post("/api/analytics/track", json={
            "event_type": "investor_profile_view",
            "entity_type": "investor",
            "entity_id": "inv-001",
            "metadata": {
                "source": "search_results",
                "position": "3",
            },
        }, headers=analyst_headers)
        assert r.status_code == 201


class TestFullPlatformWorkflow:
    """
    Test a complete platform workflow simulating real usage.
    """

    def test_complete_deal_flow(self, client, admin_headers, analyst_headers, db_session):
        """
        Simulate a complete deal flow:
        1. Project exists in DB
        2. Investor registers
        3. Introduction is made
        4. Data room is created
        5. Event is scheduled
        6. Analytics events are tracked
        """
        # 1. Project in DB
        project = _make_project(db_session, name="Tanzania Rail Corridor", country="Tanzania", sector="transport")

        # 2. Investor registers
        inv_r = client.post("/api/investors", json={
            "organisation_name": "Meridian Infrastructure Partners",
            "investor_type": "private_fund",
            "min_ticket_usd": "50000000",
        }, headers=analyst_headers)
        assert inv_r.status_code == 201
        investor_id = inv_r.json()["id"]

        # 3. Introduction
        intro_r = client.post("/api/introductions", json={
            "project_id": project.id,
            "investor_id": investor_id,
            "notes": "Interested in rail corridor project",
        }, headers=analyst_headers)
        assert intro_r.status_code == 201

        # 4. Data room
        room_r = client.post("/api/data-rooms", json={
            "project_id": project.id,
            "name": "Tanzania Rail - Investor Room",
        }, headers=admin_headers)
        assert room_r.status_code == 201

        # 5. Milestone event
        event_r = client.post("/api/events", json={
            "project_id": project.id,
            "event_type": "milestone",
            "title": "Tanzania Rail Pre-Feasibility Complete",
        }, headers=admin_headers)
        assert event_r.status_code == 201

        # 6. Track analytics
        r = client.post("/api/analytics/track", json={
            "event_type": "project_view",
            "entity_type": "project",
            "entity_id": project.id,
        }, headers=analyst_headers)
        assert r.status_code == 201


class TestConcurrentOperations:
    """
    Test multiple operations on shared resources.
    """

    def test_multiple_investors_same_project(self, client, analyst_headers, db_session):
        """Test multiple investors expressing interest in the same project."""
        project = _make_project(db_session, name="Popular Mining Project", country="Zambia", sector="mining")

        # Create 3 investor introductions for the same project
        for i in range(3):
            inv_r = client.post("/api/investors", json={
                "organisation_name": f"Mining Fund {i}",
                "investor_type": "private_fund",
            }, headers=analyst_headers)
            assert inv_r.status_code == 201
            investor_id = inv_r.json()["id"]

            intro_r = client.post("/api/introductions", json={
                "project_id": project.id,
                "investor_id": investor_id,
            }, headers=analyst_headers)
            assert intro_r.status_code == 201

    def test_multiple_projects_same_investor(self, client, analyst_headers, db_session):
        """Test one investor interested in multiple projects."""
        inv_r = client.post("/api/investors", json={
            "organisation_name": "Diversified Africa Fund",
        }, headers=analyst_headers)
        assert inv_r.status_code == 201
        investor_id = inv_r.json()["id"]

        # Create introductions for 3 different projects
        sectors = ["energy", "transport", "water"]
        for i, sector in enumerate(sectors):
            project = _make_project(
                db_session,
                name=f"Multi-Interest Project {i}",
                country="Kenya",
                sector=sector,
            )
            intro_r = client.post("/api/introductions", json={
                "project_id": project.id,
                "investor_id": investor_id,
            }, headers=analyst_headers)
            assert intro_r.status_code == 201

        # Verify all introductions appear in list
        list_r = client.get("/api/introductions", headers=analyst_headers)
        assert list_r.status_code == 200
        assert list_r.json()["count"] == 3
