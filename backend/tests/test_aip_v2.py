"""
AIP v2 — Comprehensive tests for all new routes.

Tests cover: PETFEL Engine, EIN, Pipeline, IC Governance,
Investor Matching, Infrastructure Radar, Documents.

Each test is isolated with a fresh in-memory SQLite DB via conftest.py.
"""

import json
import pytest


# ===========================================================================
# Health & Root
# ===========================================================================


class TestHealth:
    def test_root_returns_v2_features(self, client):
        r = client.get("/")
        assert r.status_code == 200
        body = r.json()
        assert body["version"] == "2.1.0"
        assert "petfel" in body["features"]
        assert "ein" in body["features"]
        assert "pipeline" in body["features"]

    def test_health_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_ping(self, client):
        r = client.get("/ping")
        assert r.status_code == 200
        assert r.json()["pong"] is True


# ===========================================================================
# Authentication
# ===========================================================================


class TestAuth:
    def test_register_user(self, client):
        r = client.post("/api/auth/register", json={
            "email": "test@aip.io",
            "password": "StrongPass123!",
            "full_name": "Test User",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == "test@aip.io"
        assert "id" in data

    def test_register_duplicate_email(self, client):
        payload = {"email": "dup@aip.io", "password": "StrongPass123!"}
        client.post("/api/auth/register", json=payload)
        r = client.post("/api/auth/register", json=payload)
        assert r.status_code == 400

    def test_login_and_get_token(self, client, admin_user):
        r = client.post("/api/auth/token", data={
            "username": "admin@aip.test",
            "password": "AdminPass123!",
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_wrong_password(self, client, admin_user):
        r = client.post("/api/auth/token", data={
            "username": "admin@aip.test",
            "password": "WrongPass!",
        })
        assert r.status_code == 401

    def test_get_me(self, client, admin_headers):
        r = client.get("/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@aip.test"

    def test_protected_route_no_token(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401


# ===========================================================================
# Pipeline
# ===========================================================================


class TestPipeline:
    def test_init_stages(self, client, admin_headers):
        r = client.post("/api/pipeline/init", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["total_stages"] == 5

    def test_list_stages(self, client, admin_headers):
        client.post("/api/pipeline/init", headers=admin_headers)
        r = client.get("/api/pipeline/stages", headers=admin_headers)
        assert r.status_code == 200
        stages = r.json()
        assert len(stages) == 5
        codes = [s["code"] for s in stages]
        assert "sourcing" in codes
        assert "diligence" in codes
        assert "execution" in codes

    def test_move_project_to_stage(self, client, admin_headers, sample_project):
        client.post("/api/pipeline/init", headers=admin_headers)
        r = client.post("/api/pipeline/move", headers=admin_headers, json={
            "project_id": sample_project.id,
            "stage_code": "sourcing",
            "notes": "Initial intake",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["to_stage"] == "sourcing"
        assert body["from_stage"] is None
        assert "log_id" in body

    def test_pipeline_history_is_immutable(self, client, admin_headers, sample_project):
        client.post("/api/pipeline/init", headers=admin_headers)
        # Move twice to build audit trail
        client.post("/api/pipeline/move", headers=admin_headers, json={
            "project_id": sample_project.id, "stage_code": "sourcing"
        })
        client.post("/api/pipeline/move", headers=admin_headers, json={
            "project_id": sample_project.id, "stage_code": "screening"
        })
        r = client.get(f"/api/pipeline/history/{sample_project.id}", headers=admin_headers)
        assert r.status_code == 200
        history = r.json()
        assert history["total_moves"] == 2
        assert history["history"][0]["to_stage"] == "sourcing"
        assert history["history"][1]["to_stage"] == "screening"

    def test_pipeline_overview(self, client, admin_headers, sample_project):
        client.post("/api/pipeline/init", headers=admin_headers)
        client.post("/api/pipeline/move", headers=admin_headers, json={
            "project_id": sample_project.id, "stage_code": "sourcing"
        })
        r = client.get("/api/pipeline/overview", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "stages" in data
        sourcing = next(s for s in data["stages"] if s["stage_code"] == "sourcing")
        assert sourcing["project_count"] == 1

    def test_move_invalid_stage(self, client, admin_headers, sample_project):
        client.post("/api/pipeline/init", headers=admin_headers)
        r = client.post("/api/pipeline/move", headers=admin_headers, json={
            "project_id": sample_project.id, "stage_code": "nonexistent_stage"
        })
        assert r.status_code == 400


# ===========================================================================
# PETFEL DD Engine
# ===========================================================================


SAMPLE_SCORES = [
    {"pillar": "political",     "sub_criterion": "Mandate / authorization clear",     "score": 4, "evidence_notes": "Ministry letter received"},
    {"pillar": "political",     "sub_criterion": "Sponsor credibility & capacity",    "score": 4},
    {"pillar": "political",     "sub_criterion": "Stakeholder alignment & governance","score": 3},
    {"pillar": "political",     "sub_criterion": "Policy stability / reversal risk",  "score": 3},
    {"pillar": "political",     "sub_criterion": "Social license / community acceptance","score": 3},
    {"pillar": "economic",      "sub_criterion": "Demand validation / need proof",    "score": 4},
    {"pillar": "economic",      "sub_criterion": "Affordability & tariff realism",    "score": 4},
    {"pillar": "economic",      "sub_criterion": "Competitive landscape / alternatives","score": 3},
    {"pillar": "economic",      "sub_criterion": "Macro & FX exposure",               "score": 3},
    {"pillar": "economic",      "sub_criterion": "Local value chain & jobs",          "score": 4},
    {"pillar": "technical",     "sub_criterion": "Design maturity (pre-FS / FS)",     "score": 3, "evidence_notes": "Pre-FS completed"},
    {"pillar": "technical",     "sub_criterion": "Site readiness (land, access, utilities)","score": 3},
    {"pillar": "technical",     "sub_criterion": "Technology risk & performance",     "score": 4},
    {"pillar": "technical",     "sub_criterion": "Implementation plan & schedule realism","score": 3},
    {"pillar": "technical",     "sub_criterion": "O&M concept and lifecycle costs",   "score": 3},
    {"pillar": "financial",     "sub_criterion": "CAPEX / OPEX realism",              "score": 3, "evidence_notes": "BoQ under preparation"},
    {"pillar": "financial",     "sub_criterion": "Revenue model credibility",         "score": 4},
    {"pillar": "financial",     "sub_criterion": "Offtaker credit & payment security","score": 3},
    {"pillar": "financial",     "sub_criterion": "Financing plan & bankability",      "score": 3, "mitigation": "DFI term sheet expected Q2"},
    {"pillar": "financial",     "sub_criterion": "Financial model maturity & sensitivities","score": 2, "mitigation": "Model being built by advisor"},
    {"pillar": "environmental", "sub_criterion": "E&S screening and EIA status",      "score": 3},
    {"pillar": "environmental", "sub_criterion": "Land acquisition & resettlement plan","score": 3},
    {"pillar": "environmental", "sub_criterion": "Biodiversity and critical habitats","score": 4},
    {"pillar": "environmental", "sub_criterion": "Climate risk & resilience",         "score": 3},
    {"pillar": "environmental", "sub_criterion": "HSE management capacity",           "score": 3},
    {"pillar": "legal",         "sub_criterion": "PPP / concession framework fit",    "score": 4},
    {"pillar": "legal",         "sub_criterion": "Permits pathway and status",        "score": 3},
    {"pillar": "legal",         "sub_criterion": "Land title and rights enforceability","score": 3},
    {"pillar": "legal",         "sub_criterion": "Contract enforceability & security package","score": 3},
    {"pillar": "legal",         "sub_criterion": "Dispute resolution / arbitration",  "score": 3},
]


class TestPetfel:
    def test_create_assessment(self, client, admin_headers, sample_project):
        r = client.post(
            f"/api/petfel/assess/{sample_project.id}",
            headers=admin_headers,
            json={"scores": SAMPLE_SCORES, "notes": "Initial assessment"},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["project_id"] == sample_project.id
        assert data["overall_score"] is not None
        assert data["rating"] in ("A", "B", "C", "D")
        assert data["gating_result"] in ("GO", "HOLD", "NO_GO")
        assert data["version"] == 1

    def test_overall_score_in_range(self, client, admin_headers, sample_project):
        r = client.post(
            f"/api/petfel/assess/{sample_project.id}",
            headers=admin_headers,
            json={"scores": SAMPLE_SCORES},
        )
        score = r.json()["overall_score"]
        assert 0 <= score <= 100

    def test_low_score_creates_flag(self, client, admin_headers, sample_project):
        """Score 2 without mitigation must auto-create a red flag."""
        scores_with_low = [
            {"pillar": "financial", "sub_criterion": "CAPEX / OPEX realism", "score": 2},
        ]
        r = client.post(
            f"/api/petfel/assess/{sample_project.id}",
            headers=admin_headers,
            json={"scores": scores_with_low},
        )
        assert r.status_code == 201
        # Red flag should be auto-created
        assessment_id = r.json()["id"]
        flags_r = client.get(
            f"/api/petfel/{assessment_id}/flags", headers=admin_headers
        )
        assert flags_r.status_code == 200
        assert len(flags_r.json()) >= 1

    def test_get_latest_assessment(self, client, admin_headers, sample_project):
        client.post(
            f"/api/petfel/assess/{sample_project.id}",
            headers=admin_headers,
            json={"scores": SAMPLE_SCORES},
        )
        r = client.get(f"/api/petfel/{sample_project.id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["project_id"] == sample_project.id

    def test_get_scorecard(self, client, admin_headers, sample_project):
        r1 = client.post(
            f"/api/petfel/assess/{sample_project.id}",
            headers=admin_headers,
            json={"scores": SAMPLE_SCORES},
        )
        assessment_id = r1.json()["id"]
        r2 = client.get(
            f"/api/petfel/{assessment_id}/scorecard", headers=admin_headers
        )
        assert r2.status_code == 200
        sc = r2.json()
        assert "scorecard" in sc
        assert "political" in sc["scorecard"]
        assert "red_flags" in sc

    def test_resolve_flag(self, client, admin_headers, sample_project):
        r1 = client.post(
            f"/api/petfel/assess/{sample_project.id}",
            headers=admin_headers,
            json={"scores": [{"pillar": "legal", "sub_criterion": "Land title and rights enforceability", "score": 1}]},
        )
        assessment_id = r1.json()["id"]
        flags = client.get(
            f"/api/petfel/{assessment_id}/flags", headers=admin_headers
        ).json()
        flag_id = flags[0]["id"]
        r2 = client.post(
            f"/api/petfel/{assessment_id}/flags/{flag_id}/resolve",
            headers=admin_headers,
            json={"notes": "Land title registered on 15 Mar 2026"},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "resolved"

    def test_versioning_increments(self, client, admin_headers, sample_project):
        """Second assessment must have version 2."""
        client.post(f"/api/petfel/assess/{sample_project.id}",
                    headers=admin_headers, json={"scores": SAMPLE_SCORES})
        r2 = client.post(f"/api/petfel/assess/{sample_project.id}",
                         headers=admin_headers, json={"scores": SAMPLE_SCORES})
        assert r2.json()["version"] == 2

    def test_unknown_project_returns_404(self, client, admin_headers):
        r = client.post("/api/petfel/assess/nonexistent-id",
                        headers=admin_headers, json={"scores": []})
        assert r.status_code == 404


# ===========================================================================
# Executive Investment Notes (EIN)
# ===========================================================================


class TestEIN:
    def _create_assessment(self, client, headers, project_id):
        """Helper: create a PETFEL assessment first."""
        return client.post(
            f"/api/petfel/assess/{project_id}",
            headers=headers, json={"scores": SAMPLE_SCORES}
        )

    def test_create_ein(self, client, admin_headers, sample_project):
        self._create_assessment(client, admin_headers, sample_project.id)
        r = client.post(
            f"/api/ein/{sample_project.id}",
            headers=admin_headers,
            json={"recommendation": "hold", "executive_summary": "Strong demand case."},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["project_id"] == sample_project.id
        assert data["section_count"] == 9
        assert data["version"] == 1
        assert data["status"] == "draft"

    def test_get_latest_ein(self, client, admin_headers, sample_project):
        client.post(f"/api/ein/{sample_project.id}", headers=admin_headers, json={})
        r = client.get(f"/api/ein/{sample_project.id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["project_id"] == sample_project.id

    def test_update_section(self, client, admin_headers, sample_project):
        r1 = client.post(f"/api/ein/{sample_project.id}", headers=admin_headers, json={})
        ein_id = r1.json()["id"]
        r2 = client.put(
            f"/api/ein/{ein_id}/section/1",
            headers=admin_headers,
            json={"content": "## Strategy\n\nThis project aligns with Kenya's Vision 2030 energy agenda.", "generated_by": "analyst"},
        )
        assert r2.status_code == 200
        assert r2.json()["section_code"] == 1

    def test_approve_ein(self, client, admin_headers, sample_project):
        r1 = client.post(f"/api/ein/{sample_project.id}", headers=admin_headers, json={})
        ein_id = r1.json()["id"]
        r2 = client.post(f"/api/ein/{ein_id}/approve", headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["export_ready"] is True

    def test_ein_export(self, client, admin_headers, sample_project):
        r1 = client.post(f"/api/ein/{sample_project.id}", headers=admin_headers, json={})
        ein_id = r1.json()["id"]
        r2 = client.get(f"/api/ein/{ein_id}/export", headers=admin_headers)
        assert r2.status_code == 200
        export = r2.json()
        assert "ein" in export
        assert "sections" in export
        assert len(export["sections"]) == 9

    def test_ein_version_increments(self, client, admin_headers, sample_project):
        client.post(f"/api/ein/{sample_project.id}", headers=admin_headers, json={})
        r2 = client.post(f"/api/ein/{sample_project.id}", headers=admin_headers, json={})
        assert r2.json()["version"] == 2

    def test_no_ein_returns_404(self, client, admin_headers, sample_project):
        r = client.get(f"/api/ein/{sample_project.id}", headers=admin_headers)
        assert r.status_code == 404


# ===========================================================================
# IC Governance
# ===========================================================================


class TestIC:
    def test_schedule_ic(self, client, admin_headers, sample_project):
        r = client.post("/api/ic/committees", headers=admin_headers, json={
            "project_id": sample_project.id,
            "quorum_required": 3,
        })
        assert r.status_code == 201
        data = r.json()
        assert "committee_id" in data
        assert data["status"] == "scheduled"

    def test_list_committees(self, client, admin_headers, sample_project):
        client.post("/api/ic/committees", headers=admin_headers,
                    json={"project_id": sample_project.id})
        r = client.get("/api/ic/committees", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_submit_vote(self, client, admin_headers, sample_project):
        r1 = client.post("/api/ic/committees", headers=admin_headers,
                         json={"project_id": sample_project.id})
        committee_id = r1.json()["committee_id"]
        r2 = client.post(
            f"/api/ic/committees/{committee_id}/vote",
            headers=admin_headers,
            json={"vote": "approve", "rationale": "Strong sponsor, good PETFEL B rating"},
        )
        assert r2.status_code == 200
        assert r2.json()["vote"] == "approve"

    def test_invalid_vote(self, client, admin_headers, sample_project):
        r1 = client.post("/api/ic/committees", headers=admin_headers,
                         json={"project_id": sample_project.id})
        committee_id = r1.json()["committee_id"]
        r2 = client.post(
            f"/api/ic/committees/{committee_id}/vote",
            headers=admin_headers,
            json={"vote": "invalidvote"},
        )
        assert r2.status_code == 400

    def test_record_decision(self, client, admin_headers, sample_project):
        r1 = client.post("/api/ic/committees", headers=admin_headers,
                         json={"project_id": sample_project.id})
        committee_id = r1.json()["committee_id"]
        client.post(f"/api/ic/committees/{committee_id}/vote",
                    headers=admin_headers, json={"vote": "approve"})
        r2 = client.post(
            f"/api/ic/committees/{committee_id}/decide",
            headers=admin_headers,
            json={"outcome": "approved", "outcome_notes": "Approved subject to DFI term sheet"},
        )
        assert r2.status_code == 200
        assert r2.json()["outcome"] == "approved"

    def test_committee_detail_shows_votes(self, client, admin_headers, sample_project):
        r1 = client.post("/api/ic/committees", headers=admin_headers,
                         json={"project_id": sample_project.id, "quorum_required": 1})
        committee_id = r1.json()["committee_id"]
        client.post(f"/api/ic/committees/{committee_id}/vote",
                    headers=admin_headers, json={"vote": "approve"})
        r2 = client.get(f"/api/ic/committees/{committee_id}", headers=admin_headers)
        assert r2.status_code == 200
        detail = r2.json()
        assert detail["vote_summary"]["approve"] == 1
        assert detail["quorum_met"] is True


# ===========================================================================
# Investor Matching
# ===========================================================================


class TestMatching:
    def test_run_matching(self, client, admin_headers, sample_project, sample_investor):
        r = client.post(
            f"/api/matching/run/{sample_project.id}",
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert "top_matches" in data
        assert data["investors_scored"] >= 1

    def test_get_matches(self, client, admin_headers, sample_project, sample_investor):
        client.post(f"/api/matching/run/{sample_project.id}", headers=admin_headers)
        r = client.get(f"/api/matching/{sample_project.id}", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "matches" in data
        assert len(data["matches"]) >= 1

    def test_match_score_in_range(self, client, admin_headers, sample_project, sample_investor):
        r = client.post(f"/api/matching/run/{sample_project.id}", headers=admin_headers)
        for m in r.json()["top_matches"]:
            assert 0 <= m["match_score"] <= 100

    def test_update_match_status(self, client, admin_headers, sample_project, sample_investor):
        client.post(f"/api/matching/run/{sample_project.id}", headers=admin_headers)
        matches = client.get(f"/api/matching/{sample_project.id}", headers=admin_headers).json()
        match_id = matches["matches"][0]["match_id"]
        r = client.put(
            f"/api/matching/{match_id}/status",
            headers=admin_headers,
            json={"status": "contacted", "notes": "Email sent to fund manager"},
        )
        assert r.status_code == 200
        assert r.json()["new_status"] == "contacted"


# ===========================================================================
# Radar
# ===========================================================================


class TestRadar:
    def test_radar_results_endpoint(self, client, admin_headers):
        r = client.get("/api/radar/results", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "country_risk" in data
        assert "radar_signals" in data

    def test_sector_summary(self, client, admin_headers):
        r = client.get("/api/radar/sectors", headers=admin_headers)
        assert r.status_code == 200
        sectors = r.json()["sectors"]
        sector_names = [s["sector"] for s in sectors]
        assert "energy" in sector_names
        assert "transport" in sector_names


# ===========================================================================
# Documents
# ===========================================================================


class TestDocuments:
    def test_upload_document(self, client, admin_headers, sample_project):
        import io
        file_content = b"This is a feasibility study document"
        r = client.post(
            f"/api/documents/upload/{sample_project.id}",
            headers=admin_headers,
            files={"file": ("feasibility_study.pdf", io.BytesIO(file_content), "application/pdf")},
            data={"document_type": "feasibility"},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["file_name"] == "feasibility_study.pdf"
        assert data["document_type"] == "feasibility"
        assert "document_id" in data
        assert "blob_path" in data

    def test_list_project_documents(self, client, admin_headers, sample_project):
        import io
        client.post(
            f"/api/documents/upload/{sample_project.id}",
            headers=admin_headers,
            files={"file": ("report.pdf", io.BytesIO(b"content"), "application/pdf")},
            data={"document_type": "eia"},
        )
        r = client.get(
            f"/api/documents/{sample_project.id}/list",
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 1
        assert data["documents"][0]["document_type"] == "eia"

    def test_invalid_doc_type(self, client, admin_headers, sample_project):
        import io
        r = client.post(
            f"/api/documents/upload/{sample_project.id}",
            headers=admin_headers,
            files={"file": ("x.pdf", io.BytesIO(b"content"), "application/pdf")},
            data={"document_type": "invalid_type"},
        )
        assert r.status_code == 400

    def test_get_url_no_blob_returns_503(self, client, admin_headers, sample_project):
        import io
        r1 = client.post(
            f"/api/documents/upload/{sample_project.id}",
            headers=admin_headers,
            files={"file": ("x.pdf", io.BytesIO(b"content"), "application/pdf")},
            data={"document_type": "permit"},
        )
        doc_id = r1.json()["document_id"]
        r2 = client.get(f"/api/documents/{doc_id}/url", headers=admin_headers)
        # Azure Blob not configured in test env → 503
        assert r2.status_code == 503

    def test_delete_document(self, client, admin_headers, sample_project):
        import io
        r1 = client.post(
            f"/api/documents/upload/{sample_project.id}",
            headers=admin_headers,
            files={"file": ("x.pdf", io.BytesIO(b"content"), "application/pdf")},
            data={"document_type": "other"},
        )
        doc_id = r1.json()["document_id"]
        r2 = client.delete(f"/api/documents/{doc_id}", headers=admin_headers)
        assert r2.status_code == 204


# ===========================================================================
# RBAC
# ===========================================================================


class TestRBAC:
    def test_unauthenticated_petfel_blocked(self, client, sample_project):
        r = client.get(f"/api/petfel/{sample_project.id}")
        assert r.status_code == 401

    def test_unauthenticated_ein_blocked(self, client, sample_project):
        r = client.get(f"/api/ein/{sample_project.id}")
        assert r.status_code == 401

    def test_unauthenticated_pipeline_move_blocked(self, client, sample_project):
        r = client.post("/api/pipeline/move", json={
            "project_id": sample_project.id, "stage_code": "sourcing"
        })
        assert r.status_code == 401

    def test_unauthenticated_ic_vote_blocked(self, client):
        r = client.post("/api/ic/committees/fake-id/vote",
                        json={"vote": "approve"})
        assert r.status_code == 401
