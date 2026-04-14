"""
Tests for backend/routers/deal_rooms.py
Covers the 57% coverage gap.
"""
import uuid
import pytest
from backend.models import User, DealRoom, InfrastructureProject
from backend.security.auth import hash_password, create_access_token


def make_email():
    return f"deal_{uuid.uuid4().hex[:8]}@aip.test"


def _make_user(db_session, role="admin"):
    user = User(
        email=make_email(),
        hashed_password=hash_password("DealPass@123!"),
        full_name=f"Deal {role}",
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
        project_name=f"Deal Project {uuid.uuid4().hex[:6]}",
        country="Nigeria",
        sector="transport",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _create_room(db_session, project_id, created_by):
    room = DealRoom(
        project_id=project_id,
        name=f"Room {uuid.uuid4().hex[:6]}",
        status="active",
        created_by=created_by,
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room


class TestDealRoomAuth:
    def test_list_requires_auth(self, client):
        assert client.get("/api/deal-rooms").status_code == 401

    def test_get_requires_auth(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        assert client.get(f"/api/deal-rooms/{room.id}").status_code == 401

    def test_messages_requires_auth(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        assert client.get(f"/api/deal-rooms/{room.id}/messages").status_code == 401


class TestDealRoomCRUD:
    def test_list_empty(self, client, db_session):
        admin_h, _ = _make_user(db_session)
        r = client.get("/api/deal-rooms", headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        assert "deal_rooms" in data
        assert data["count"] == 0

    def test_admin_creates_room(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        r = client.post("/api/deal-rooms", json={
            "project_id": project.id,
            "name": "Lagos Port Deal Room",
            "status": "active",
        }, headers=admin_h)
        assert r.status_code == 201
        assert r.json()["name"] == "Lagos Port Deal Room"

    def test_analyst_cannot_create(self, client, db_session):
        analyst_h, _ = _make_user(db_session, "analyst")
        project = _create_project(db_session)
        r = client.post("/api/deal-rooms", json={
            "project_id": project.id,
            "name": "Unauthorized",
        }, headers=analyst_h)
        assert r.status_code == 403

    def test_get_by_id(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        r = client.get(f"/api/deal-rooms/{room.id}", headers=admin_h)
        assert r.status_code == 200
        assert r.json()["id"] == room.id

    def test_get_not_found(self, client, db_session):
        admin_h, _ = _make_user(db_session)
        assert client.get("/api/deal-rooms/nonexistent", headers=admin_h).status_code == 404

    def test_list_returns_active_rooms(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        _create_room(db_session, project.id, admin.id)
        r = client.get("/api/deal-rooms", headers=admin_h)
        assert r.status_code == 200
        assert r.json()["count"] >= 1


class TestDealRoomMessages:
    def test_get_messages_empty(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        r = client.get(f"/api/deal-rooms/{room.id}/messages", headers=admin_h)
        assert r.status_code == 200

    def test_post_message(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        r = client.post(f"/api/deal-rooms/{room.id}/messages", json={
            "content": "Initial message",
            "message_type": "text",
        }, headers=admin_h)
        assert r.status_code in (200, 201)

    def test_post_message_nonexistent_room(self, client, db_session):
        admin_h, _ = _make_user(db_session)
        r = client.post("/api/deal-rooms/nonexistent/messages", json={
            "content": "msg",
        }, headers=admin_h)
        assert r.status_code == 404


class TestDealRoomMembers:
    def test_list_members_empty(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        r = client.get(f"/api/deal-rooms/{room.id}/members", headers=admin_h)
        assert r.status_code == 200

    def test_add_member(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        analyst_h, analyst = _make_user(db_session, "analyst")
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        r = client.post(f"/api/deal-rooms/{room.id}/members", json={
            "user_id": analyst.id,
            "role": "viewer",
        }, headers=admin_h)
        assert r.status_code in (200, 201)

    def test_remove_member_requires_room_ownership(self, client, db_session):
        """Third-party user (non-owner) cannot remove members."""
        admin_h, admin = _make_user(db_session)
        analyst_h, analyst = _make_user(db_session, "analyst")
        third_h, third = _make_user(db_session, "analyst")
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        # Add analyst as member
        client.post(f"/api/deal-rooms/{room.id}/members", json={
            "user_id": analyst.id, "role": "viewer"
        }, headers=admin_h)
        # Third user (non-owner) tries to remove
        r = client.delete(f"/api/deal-rooms/{room.id}/members/{analyst.id}", headers=third_h)
        assert r.status_code == 403

    def test_owner_can_remove_member(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        analyst_h, analyst = _make_user(db_session, "analyst")
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        # Add then remove
        client.post(f"/api/deal-rooms/{room.id}/members", json={
            "user_id": analyst.id, "role": "viewer"
        }, headers=admin_h)
        r = client.delete(f"/api/deal-rooms/{room.id}/members/{analyst.id}", headers=admin_h)
        assert r.status_code in (200, 204)


class TestDealRoomMeetings:
    def test_list_meetings_empty(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        r = client.get(f"/api/deal-rooms/{room.id}/meetings", headers=admin_h)
        assert r.status_code == 200

    def test_schedule_meeting(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        r = client.post(f"/api/deal-rooms/{room.id}/meetings", json={
            "title": "Deal Review",
            "scheduled_at": "2026-06-01T10:00:00",
            "duration_mins": 60,
        }, headers=admin_h)
        assert r.status_code in (200, 201)

    def test_cancel_meeting_requires_ownership(self, client, db_session):
        """Non-owner cannot cancel meetings."""
        admin_h, admin = _make_user(db_session)
        analyst_h, _ = _make_user(db_session, "analyst")
        project = _create_project(db_session)
        room = _create_room(db_session, project.id, admin.id)
        # Schedule a meeting
        r = client.post(f"/api/deal-rooms/{room.id}/meetings", json={
            "title": "Meeting",
            "scheduled_at": "2026-07-01T10:00:00",
        }, headers=admin_h)
        if r.status_code in (200, 201):
            meeting_id = r.json().get("id") or r.json().get("meeting_id")
            if meeting_id:
                r2 = client.delete(f"/api/deal-rooms/{room.id}/meetings/{meeting_id}", headers=analyst_h)
                assert r2.status_code == 403
