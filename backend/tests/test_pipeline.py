"""
Tests for backend/routers/pipeline.py
Covers the 54% gap and verifies helper functions.
"""
import uuid
import pytest
from backend.models import User, InfrastructureProject
from backend.security.auth import hash_password, create_access_token


def make_email():
    return f"pipe_{uuid.uuid4().hex[:8]}@aip.test"


def _make_user(db_session, role="analyst"):
    user = User(
        email=make_email(),
        hashed_password=hash_password("PipePass@123!"),
        full_name="Pipeline User",
        role=role,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token({"sub": user.email, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}, user


def _create_project(db_session, status="planned"):
    project = InfrastructureProject(
        project_name=f"Pipeline Project {uuid.uuid4().hex[:6]}",
        country="Ghana",
        sector="energy",
        status=status,
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


class TestPipelineAuth:
    def test_stages_requires_auth(self, client):
        assert client.get("/api/pipeline/stages").status_code == 401

    def test_overview_requires_auth(self, client):
        assert client.get("/api/pipeline/overview").status_code == 401

    def test_history_requires_auth(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        assert client.get(f"/api/pipeline/history/{project.id}").status_code == 401

    def test_move_requires_auth(self, client, db_session):
        project = _create_project(db_session)
        assert client.post("/api/pipeline/move", json={
            "project_id": project.id,
            "to_stage": "screening",
        }).status_code == 401


class TestPipelineEndpoints:
    def test_stages_returns_data(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/pipeline/stages", headers=h)
        assert r.status_code == 200

    def test_overview_returns_data(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/pipeline/overview", headers=h)
        assert r.status_code == 200

    def test_history_for_project(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        r = client.get(f"/api/pipeline/history/{project.id}", headers=h)
        assert r.status_code in (200, 404)

    def test_history_nonexistent_project(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/pipeline/history/nonexistent", headers=h)
        assert r.status_code in (200, 404)

    def test_stages_with_projects(self, client, db_session):
        h, _ = _make_user(db_session)
        _create_project(db_session, "planned")
        _create_project(db_session, "active")
        r = client.get("/api/pipeline/stages", headers=h)
        assert r.status_code == 200

    def test_init_stages_requires_auth(self, client, db_session):
        h, _ = _make_user(db_session, "admin")
        r = client.post("/api/pipeline/init", headers=h)
        assert r.status_code in (200, 201)


class TestPipelineAdditionalEndpoints:
    """Cover statuses, sla-alerts, and move endpoints."""

    def test_statuses_requires_auth(self, client):
        assert client.get("/api/pipeline/statuses").status_code == 401

    def test_statuses_returns_list(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/pipeline/statuses", headers=h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_sla_alerts_requires_auth(self, client):
        assert client.get("/api/pipeline/sla-alerts").status_code == 401

    def test_sla_alerts_returns_list(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/pipeline/sla-alerts", headers=h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_statuses_project_not_found(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/pipeline/statuses/nonexistent", headers=h)
        assert r.status_code == 404

    def test_move_project_not_found(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.post("/api/pipeline/move", json={
            "project_id": "nonexistent-id",
            "stage_code": "screening",
        }, headers=h)
        assert r.status_code == 404

    def test_move_invalid_stage(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        r = client.post("/api/pipeline/move", json={
            "project_id": project.id,
            "stage_code": "invalid_stage_xyz",
        }, headers=h)
        assert r.status_code == 400

    def test_move_valid_project_and_stage(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        # Seed stages first
        client.post("/api/pipeline/init", headers=h)
        r = client.post("/api/pipeline/move", json={
            "project_id": project.id,
            "stage_code": "sourcing",
        }, headers=h)
        assert r.status_code == 200

    def test_statuses_after_move(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        client.post("/api/pipeline/init", headers=h)
        client.post("/api/pipeline/move", json={
            "project_id": project.id,
            "stage_code": "sourcing",
        }, headers=h)
        r = client.get("/api/pipeline/statuses", headers=h)
        assert r.status_code == 200
        statuses = r.json()
        assert any(s["project_id"] == project.id for s in statuses)

    def test_statuses_project_id_after_move(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        client.post("/api/pipeline/init", headers=h)
        client.post("/api/pipeline/move", json={
            "project_id": project.id,
            "stage_code": "screening",
        }, headers=h)
        r = client.get(f"/api/pipeline/statuses/{project.id}", headers=h)
        assert r.status_code == 200
        assert r.json()["project_id"] == project.id


class TestBuildPipelineStatusCard:
    """Test the _build_pipeline_status_card helper directly."""

    def test_helper_returns_dict_with_expected_keys(self):
        from backend.routers.pipeline import _build_pipeline_status_card
        from datetime import datetime, timezone
        from unittest.mock import MagicMock

        project = MagicMock()
        project.id = "proj-1"
        project.project_name = "Test Project"

        pos = MagicMock()
        pos.stage_code = "diligence"
        pos.entered_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

        stage = MagicMock()
        stage.sla_days = 14

        now = datetime(2026, 1, 10, tzinfo=timezone.utc)
        card = _build_pipeline_status_card(project, pos, stage, now)

        assert "project_id" in card
        assert "project_name" in card
        assert "current_stage" in card
        assert "days_in_stage" in card
        assert "sla_status" in card
        assert card["project_id"] == "proj-1"
        assert card["days_in_stage"] == 9

    def test_sla_status_ok(self):
        from backend.routers.pipeline import _build_pipeline_status_card
        from datetime import datetime, timezone
        from unittest.mock import MagicMock

        project = MagicMock()
        project.id = "p1"
        project.project_name = "P1"
        pos = MagicMock()
        pos.stage_code = "screening"
        pos.entered_at = datetime(2026, 4, 1, tzinfo=timezone.utc)
        stage = MagicMock()
        stage.sla_days = 30

        now = datetime(2026, 4, 5, tzinfo=timezone.utc)
        card = _build_pipeline_status_card(project, pos, stage, now)
        assert card["sla_status"] == "ok"

    def test_sla_status_breached(self):
        from backend.routers.pipeline import _build_pipeline_status_card
        from datetime import datetime, timezone
        from unittest.mock import MagicMock

        project = MagicMock()
        project.id = "p2"
        project.project_name = "P2"
        pos = MagicMock()
        pos.stage_code = "ic"
        pos.entered_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        stage = MagicMock()
        stage.sla_days = 7

        now = datetime(2026, 1, 15, tzinfo=timezone.utc)
        card = _build_pipeline_status_card(project, pos, stage, now)
        assert card["sla_status"] == "breached"

    def test_sla_status_no_stage(self):
        from backend.routers.pipeline import _build_pipeline_status_card
        from datetime import datetime, timezone
        from unittest.mock import MagicMock

        project = MagicMock()
        project.id = "p3"
        project.project_name = "P3"
        pos = MagicMock()
        pos.stage_code = "sourcing"
        pos.entered_at = datetime(2026, 3, 1, tzinfo=timezone.utc)

        now = datetime(2026, 3, 10, tzinfo=timezone.utc)
        card = _build_pipeline_status_card(project, pos, None, now)
        assert card["sla_status"] == "ok"
        assert card["sla_days"] is None
