"""
Tests for backend/routers/petfel.py
Covers PETFEL criteria constants, endpoint auth, assessment creation, and scoring.
"""
import uuid
import pytest
from backend.models import User, InfrastructureProject
from backend.security.auth import hash_password, create_access_token


def make_email():
    return f"petfel_{uuid.uuid4().hex[:8]}@aip.test"


def _make_user(db_session, role="analyst"):
    user = User(
        email=make_email(),
        hashed_password=hash_password("PetfelPass@123!"),
        full_name=f"Petfel {role}",
        role=role,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token({"sub": user.email, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}, user


def _create_project(db_session):
    project = InfrastructureProject(
        project_name=f"PETFEL Project {uuid.uuid4().hex[:6]}",
        country="Tanzania",
        sector="energy",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _minimal_scores():
    """One score per pillar (6 total) — sufficient for create_assessment."""
    return [
        {"pillar": "political",     "sub_criterion": "Mandate / authorization clear",   "score": 4},
        {"pillar": "economic",      "sub_criterion": "Demand validation / need proof",  "score": 3},
        {"pillar": "technical",     "sub_criterion": "Design maturity (pre-FS / FS)",   "score": 4},
        {"pillar": "financial",     "sub_criterion": "CAPEX / OPEX realism",            "score": 3},
        {"pillar": "environmental", "sub_criterion": "E&S screening and EIA status",    "score": 4},
        {"pillar": "legal",         "sub_criterion": "PPP / concession framework fit",  "score": 3},
    ]


# ---------------------------------------------------------------------------
# Criteria constants
# ---------------------------------------------------------------------------

class TestPetfelCriteria:
    def test_subcriteria_has_six_pillars(self):
        from backend.routers.petfel import PETFEL_SUBCRITERIA
        assert len(PETFEL_SUBCRITERIA) == 6

    def test_subcriteria_pillar_keys_are_strings(self):
        from backend.routers.petfel import PETFEL_SUBCRITERIA
        for key in PETFEL_SUBCRITERIA:
            assert isinstance(key, str)

    def test_each_pillar_has_five_subcriteria(self):
        from backend.routers.petfel import PETFEL_SUBCRITERIA
        for pillar, criteria in PETFEL_SUBCRITERIA.items():
            assert len(criteria) == 5, f"{pillar} should have 5 sub-criteria"

    def test_subcriteria_weights_sum_to_one_per_pillar(self):
        from backend.routers.petfel import PETFEL_SUBCRITERIA
        for pillar, criteria in PETFEL_SUBCRITERIA.items():
            total = sum(c["weight"] for c in criteria)
            assert abs(total - 1.0) < 1e-9, f"{pillar} weights sum to {total}"

    def test_pillar_weights_sum_to_one(self):
        from backend.routers.petfel import PILLAR_WEIGHTS
        total = sum(PILLAR_WEIGHTS.values())
        assert abs(total - 1.0) < 1e-9

    def test_pillar_weights_has_six_keys(self):
        from backend.routers.petfel import PILLAR_WEIGHTS
        assert len(PILLAR_WEIGHTS) == 6

    def test_all_subcriteria_have_required_fields(self):
        from backend.routers.petfel import PETFEL_SUBCRITERIA
        for pillar, criteria in PETFEL_SUBCRITERIA.items():
            for c in criteria:
                assert "code" in c
                assert "name" in c
                assert "weight" in c


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

class TestPetfelAuth:
    def test_criteria_requires_auth(self, client):
        assert client.get("/api/petfel/criteria").status_code == 401

    def test_list_assessments_requires_auth(self, client):
        assert client.get("/api/petfel/assessments").status_code == 401

    def test_create_assessment_requires_auth(self, client, db_session):
        project = _create_project(db_session)
        r = client.post(f"/api/petfel/assess/{project.id}", json={"scores": []})
        assert r.status_code == 401

    def test_get_root_requires_auth(self, client):
        assert client.get("/api/petfel").status_code == 401


# ---------------------------------------------------------------------------
# Criteria endpoint
# ---------------------------------------------------------------------------

class TestCriteriaEndpoint:
    def test_returns_all_pillars(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/petfel/criteria", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert "political" in data
        assert "financial" in data
        assert "legal" in data

    def test_each_pillar_has_five_items(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/petfel/criteria", headers=h)
        for pillar, items in r.json().items():
            assert len(items) == 5


# ---------------------------------------------------------------------------
# Assessment listing
# ---------------------------------------------------------------------------

class TestListAssessments:
    def test_list_empty_by_default(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/petfel/assessments", headers=h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_by_nonexistent_project(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.get("/api/petfel/assessments?project_id=nonexistent", headers=h)
        assert r.status_code == 200
        assert r.json() == []


# ---------------------------------------------------------------------------
# Assessment creation
# ---------------------------------------------------------------------------

class TestCreateAssessment:
    def test_create_assessment_for_valid_project(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        r = client.post(f"/api/petfel/assess/{project.id}", json={
            "scores": _minimal_scores(),
        }, headers=h)
        assert r.status_code == 201
        data = r.json()
        assert data["project_id"] == project.id
        assert data["version"] == 1
        assert data["status"] == "submitted"
        assert data["overall_score"] is not None
        assert data["rating"] in ("A", "B", "C", "D")

    def test_create_assessment_nonexistent_project(self, client, db_session):
        h, _ = _make_user(db_session)
        r = client.post("/api/petfel/assess/nonexistent", json={
            "scores": _minimal_scores(),
        }, headers=h)
        assert r.status_code == 404

    def test_assessment_version_increments(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        r1 = client.post(f"/api/petfel/assess/{project.id}", json={
            "scores": _minimal_scores(),
        }, headers=h)
        r2 = client.post(f"/api/petfel/assess/{project.id}", json={
            "scores": _minimal_scores(),
        }, headers=h)
        assert r1.json()["version"] == 1
        assert r2.json()["version"] == 2

    def test_low_score_creates_red_flag(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        scores = _minimal_scores()
        # Set first score to 1 (critical)
        scores[0]["score"] = 1
        r = client.post(f"/api/petfel/assess/{project.id}", json={
            "scores": scores,
        }, headers=h)
        assert r.status_code == 201
        assert r.json()["red_flags"] >= 1

    def test_high_scores_produce_go_gating(self, client, db_session):
        h, _ = _make_user(db_session)
        project = _create_project(db_session)
        # All 5s across all 30 criteria
        all_scores = []
        from backend.routers.petfel import PETFEL_SUBCRITERIA
        for pillar, criteria in PETFEL_SUBCRITERIA.items():
            for c in criteria:
                all_scores.append({
                    "pillar": pillar,
                    "sub_criterion": c["name"],
                    "score": 5,
                })
        r = client.post(f"/api/petfel/assess/{project.id}", json={
            "scores": all_scores,
        }, headers=h)
        assert r.status_code == 201
        data = r.json()
        assert data["gating_result"] == "GO"
        assert data["rating"] == "A"


# ---------------------------------------------------------------------------
# _compute_overall_score helper
# ---------------------------------------------------------------------------

class TestComputeOverallScore:
    def test_empty_scores_returns_zero(self):
        from backend.routers.petfel import _compute_overall_score
        overall, rating, gating = _compute_overall_score([])
        assert overall == 0.0
        assert rating == "D"
        assert gating == "HOLD"

    def test_critical_score_forces_hold(self):
        from backend.routers.petfel import _compute_overall_score
        from unittest.mock import MagicMock
        s = MagicMock()
        s.score = 2
        s.pillar = "political"
        s.sub_weight = 0.20
        s.mitigation = None
        overall, rating, gating = _compute_overall_score([s])
        assert gating == "HOLD"

    def test_high_score_computes_correctly(self):
        from backend.routers.petfel import _compute_overall_score
        from unittest.mock import MagicMock
        # Score of 5 in political should contribute positively
        s = MagicMock()
        s.score = 5
        s.pillar = "political"
        s.sub_weight = 0.25
        s.mitigation = None
        overall, rating, gating = _compute_overall_score([s])
        assert overall > 0
