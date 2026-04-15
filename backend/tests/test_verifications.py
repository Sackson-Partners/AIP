# tests/test_verifications.py
import pytest

VERIFICATIONS = "/api/verifications"


class TestSubmitVerification:
    """Tests for verification submission endpoint."""

    def test_submit_email_verification(self, client, analyst_headers):
        """Test submitting an email verification request."""
        response = client.post(VERIFICATIONS, json={
            "verification_type": "email",
        }, headers=analyst_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["verification_type"] == "email"
        assert "id" in data

    def test_submit_identity_verification(self, client, analyst_headers):
        """Test submitting an identity verification request."""
        response = client.post(VERIFICATIONS, json={
            "verification_type": "identity",
            "document_url": "s3://bucket/passport.jpg",
        }, headers=analyst_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["verification_type"] == "identity"

    def test_submit_accreditation_verification(self, client, analyst_headers):
        """Test submitting an accreditation verification request."""
        response = client.post(VERIFICATIONS, json={
            "verification_type": "accreditation",
            "document_url": "s3://bucket/certificate.pdf",
        }, headers=analyst_headers)
        assert response.status_code == 201
        assert response.json()["verification_type"] == "accreditation"

    def test_submit_verification_requires_auth(self, client):
        """Test that verification submission requires auth."""
        response = client.post(VERIFICATIONS, json={"verification_type": "email"})
        assert response.status_code == 401

    def test_submit_verification_missing_type(self, client, analyst_headers):
        """Test that missing verification_type is rejected."""
        response = client.post(VERIFICATIONS, json={
            "document_url": "s3://bucket/doc.pdf",
        }, headers=analyst_headers)
        assert response.status_code == 422

    def test_submit_verification_with_document_url(self, client, analyst_headers):
        """Test submitting verification with optional document_url."""
        response = client.post(VERIFICATIONS, json={
            "verification_type": "identity",
            "document_url": "https://storage.example.com/docs/id.pdf",
        }, headers=analyst_headers)
        assert response.status_code == 201
        assert response.json()["document_url"] == "https://storage.example.com/docs/id.pdf"

    def test_submit_verification_without_document_url(self, client, analyst_headers):
        """Test submitting verification without optional document_url."""
        response = client.post(VERIFICATIONS, json={
            "verification_type": "email",
        }, headers=analyst_headers)
        assert response.status_code == 201


class TestVerificationStatus:
    """Tests for user's own verification status endpoint."""

    def test_get_own_status_empty(self, client, analyst_headers):
        """Test getting verification status when none submitted."""
        response = client.get(f"{VERIFICATIONS}/status", headers=analyst_headers)
        assert response.status_code == 200
        data = response.json()
        assert "verifications" in data
        assert data["verifications"] == []

    def test_get_own_status_after_submission(self, client, analyst_headers):
        """Test that submitted verification appears in status."""
        client.post(VERIFICATIONS, json={"verification_type": "email"}, headers=analyst_headers)
        response = client.get(f"{VERIFICATIONS}/status", headers=analyst_headers)
        assert response.status_code == 200
        assert len(response.json()["verifications"]) == 1

    def test_status_requires_auth(self, client):
        """Test that status endpoint requires authentication."""
        response = client.get(f"{VERIFICATIONS}/status")
        assert response.status_code == 401


class TestListVerifications:
    """Tests for admin verification listing endpoint."""

    def test_admin_can_list_verifications(self, client, admin_headers, analyst_headers):
        """Test that admin can list all verifications."""
        # Submit a verification as analyst
        client.post(VERIFICATIONS, json={"verification_type": "email"}, headers=analyst_headers)

        response = client.get(VERIFICATIONS, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "verifications" in data
        assert data["count"] >= 1

    def test_non_admin_cannot_list_verifications(self, client, analyst_headers):
        """Test that non-admin cannot list all verifications."""
        response = client.get(VERIFICATIONS, headers=analyst_headers)
        assert response.status_code == 403

    def test_list_requires_auth(self, client):
        """Test that list endpoint requires authentication."""
        response = client.get(VERIFICATIONS)
        assert response.status_code == 401


class TestReviewVerification:
    """Tests for admin verification review endpoint."""

    def test_admin_can_approve_verification(self, client, admin_headers, analyst_headers):
        """Test that admin can approve a verification."""
        submit_r = client.post(VERIFICATIONS, json={
            "verification_type": "identity",
        }, headers=analyst_headers)
        ver_id = submit_r.json()["id"]

        response = client.put(f"{VERIFICATIONS}/{ver_id}/review", json={
            "status": "approved",
            "reviewer_notes": "Documents verified successfully.",
        }, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"

    def test_admin_can_reject_verification(self, client, admin_headers, analyst_headers):
        """Test that admin can reject a verification."""
        submit_r = client.post(VERIFICATIONS, json={
            "verification_type": "accreditation",
        }, headers=analyst_headers)
        ver_id = submit_r.json()["id"]

        response = client.put(f"{VERIFICATIONS}/{ver_id}/review", json={
            "status": "rejected",
            "reviewer_notes": "Insufficient documentation.",
        }, headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "rejected"

    def test_review_not_found(self, client, admin_headers):
        """Test reviewing non-existent verification returns 404."""
        response = client.put(f"{VERIFICATIONS}/nonexistent-id/review", json={
            "status": "approved",
        }, headers=admin_headers)
        assert response.status_code == 404

    def test_non_admin_cannot_review(self, client, analyst_headers, admin_headers):
        """Test that non-admin cannot review verifications."""
        submit_r = client.post(VERIFICATIONS, json={
            "verification_type": "email",
        }, headers=analyst_headers)
        ver_id = submit_r.json()["id"]

        response = client.put(f"{VERIFICATIONS}/{ver_id}/review", json={
            "status": "approved",
        }, headers=analyst_headers)
        assert response.status_code == 403
