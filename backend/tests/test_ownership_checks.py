"""
STEP-2: Ownership Check Tests
Verify that users cannot access or modify resources they don't own.
"""
import uuid
import pytest
from backend.models import User
from backend.security.auth import hash_password, create_access_token


def make_email():
    return f"owner_{uuid.uuid4().hex[:8]}@aip.com"


def _create_user_headers(db_session, role="analyst"):
    """Create a user directly in the DB and return auth headers."""
    email = make_email()
    user = User(
        email=email,
        hashed_password=hash_password("TestPass@123!"),
        full_name="Ownership Test User",
        role=role,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token({"sub": user.email, "user_id": user.id})
    return user, {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def user_a_headers(db_session, client):
    _, headers = _create_user_headers(db_session, role="analyst")
    return headers


@pytest.fixture(scope="function")
def user_b_headers(db_session, client):
    _, headers = _create_user_headers(db_session, role="analyst")
    return headers


class TestDocumentOwnership:
    """User A cannot access or delete User B's documents."""

    def _create_project(self, client, headers):
        r = client.post("/api/projects", json={
            "project_name": f"Ownership Test {uuid.uuid4().hex[:4]}",
            "country": "Kenya",
            "sector": "energy",
        }, headers=headers)
        assert r.status_code in (200, 201), f"Project creation failed: {r.text}"
        return r.json()["id"]

    def test_user_a_cannot_get_url_for_user_b_document(
        self, client, db_session, user_a_headers, user_b_headers
    ):
        """
        Upload a document as User B, then attempt to get its URL as User A.
        Expect 403 (or 503 if Azure not configured but still not 200/401).
        """
        # Create a project as User B
        project_id = self._create_project(client, user_b_headers)

        # Insert document record directly as User B (owned by User B)
        from backend.models import ProjectDocument, _uuid, User
        user_b_resp = client.get("/api/auth/me", headers=user_b_headers)
        user_b_id = user_b_resp.json()["id"]

        doc = ProjectDocument(
            id=_uuid(),
            project_id=project_id,
            file_name="secret_report.pdf",
            blob_path=f"projects/{project_id}/documents/other/test-doc/secret_report.pdf",
            document_type="other",
            file_size_kb=100,
            content_type="application/pdf",
            uploaded_by=user_b_id,
        )
        db_session.add(doc)
        db_session.commit()

        # User A tries to get the URL — should be 403 (not 200)
        r = client.get(f"/api/documents/{doc.id}/url", headers=user_a_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_user_a_cannot_delete_user_b_document(
        self, client, db_session, user_a_headers, user_b_headers
    ):
        """User A cannot delete a document owned by User B."""
        project_id = self._create_project(client, user_b_headers)

        from backend.models import ProjectDocument, _uuid
        user_b_resp = client.get("/api/auth/me", headers=user_b_headers)
        user_b_id = user_b_resp.json()["id"]

        doc = ProjectDocument(
            id=_uuid(),
            project_id=project_id,
            file_name="private.pdf",
            blob_path=f"projects/{project_id}/documents/other/doc2/private.pdf",
            document_type="other",
            file_size_kb=50,
            content_type="application/pdf",
            uploaded_by=user_b_id,
        )
        db_session.add(doc)
        db_session.commit()

        r = client.delete(f"/api/documents/{doc.id}", headers=user_a_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_owner_can_delete_own_document(
        self, client, db_session, user_a_headers
    ):
        """Document owner can delete their own document."""
        project_id = self._create_project(client, user_a_headers)

        from backend.models import ProjectDocument, _uuid
        user_a_resp = client.get("/api/auth/me", headers=user_a_headers)
        user_a_id = user_a_resp.json()["id"]

        doc = ProjectDocument(
            id=_uuid(),
            project_id=project_id,
            file_name="myfile.pdf",
            blob_path=f"projects/{project_id}/documents/other/doc3/myfile.pdf",
            document_type="other",
            file_size_kb=25,
            content_type="application/pdf",
            uploaded_by=user_a_id,
        )
        db_session.add(doc)
        db_session.commit()

        r = client.delete(f"/api/documents/{doc.id}", headers=user_a_headers)
        assert r.status_code == 204, f"Expected 204, got {r.status_code}: {r.text}"


class TestDealRoomOwnership:
    """Non-owner cannot remove members, cancel meetings, or delete documents."""

    def _create_deal_room(self, client, admin_headers, db_session):
        """Create a deal room using admin credentials."""
        from backend.models import User, DealRoom, _uuid

        # Get the admin user ID
        me_resp = client.get("/api/auth/me", headers=admin_headers)
        admin_id = me_resp.json()["id"]

        room = DealRoom(
            id=_uuid(),
            project_id="test-project-id",
            name=f"Test Room {uuid.uuid4().hex[:4]}",
            created_by=admin_id,
            status="active",
        )
        db_session.add(room)
        db_session.commit()
        return room.id, admin_id

    def test_non_owner_cannot_remove_member(
        self, client, db_session, user_a_headers, user_b_headers
    ):
        """User B (non-owner) cannot remove a member from User A's deal room."""
        room_id, _ = self._create_deal_room(client, user_a_headers, db_session)

        # Add User B as a member via direct DB insert
        from backend.models import DealRoomMember, _uuid
        user_b_resp = client.get("/api/auth/me", headers=user_b_headers)
        user_b_id = user_b_resp.json()["id"]

        member = DealRoomMember(
            id=_uuid(),
            deal_room_id=room_id,
            user_id=user_b_id,
            role="viewer",
        )
        db_session.add(member)
        db_session.commit()

        # User B tries to remove themselves — only room admin can remove members
        r = client.delete(
            f"/api/deal-rooms/{room_id}/members/{user_b_id}",
            headers=user_b_headers,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_owner_can_remove_member(
        self, client, db_session, user_a_headers, user_b_headers
    ):
        """Room owner (User A) can remove a member."""
        room_id, _ = self._create_deal_room(client, user_a_headers, db_session)

        from backend.models import DealRoomMember, _uuid
        user_b_resp = client.get("/api/auth/me", headers=user_b_headers)
        user_b_id = user_b_resp.json()["id"]

        member = DealRoomMember(
            id=_uuid(),
            deal_room_id=room_id,
            user_id=user_b_id,
            role="viewer",
        )
        db_session.add(member)
        db_session.commit()

        r = client.delete(
            f"/api/deal-rooms/{room_id}/members/{user_b_id}",
            headers=user_a_headers,
        )
        assert r.status_code == 204, f"Expected 204, got {r.status_code}: {r.text}"
