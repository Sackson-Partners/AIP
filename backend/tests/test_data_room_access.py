"""
Tests for data room CRUD and access control.
Covers the 44% coverage gap in backend/routers/data_rooms.py
"""
import uuid
import pytest
from backend.models import User, DataRoom, InfrastructureProject
from backend.security.auth import hash_password, create_access_token


def make_email():
    return f"dr_{uuid.uuid4().hex[:8]}@aip.test"


def _make_user(db_session, role="admin"):
    user = User(
        email=make_email(),
        hashed_password=hash_password("Pass@123!"),
        full_name=f"DR {role}",
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
        project_name=f"DR Project {uuid.uuid4().hex[:6]}",
        country="Kenya",
        sector="energy",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _create_data_room(db_session, project_id, name=None):
    room = DataRoom(
        project_id=project_id,
        name=name or f"Room {uuid.uuid4().hex[:6]}",
        description="Test",
        access_level="restricted",
        is_active=True,
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room


class TestDataRoomAuth:
    def test_list_requires_auth(self, client):
        assert client.get("/api/data-rooms").status_code == 401

    def test_get_requires_auth(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_data_room(db_session, project.id)
        assert client.get(f"/api/data-rooms/{room.id}").status_code == 401

    def test_documents_requires_auth(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_data_room(db_session, project.id)
        assert client.get(f"/api/data-rooms/{room.id}/documents").status_code == 401


class TestDataRoomCRUD:
    def test_list_empty(self, client, db_session):
        admin_h, _ = _make_user(db_session)
        r = client.get("/api/data-rooms", headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        assert "data_rooms" in data
        assert "count" in data

    def test_admin_creates_room(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        r = client.post("/api/data-rooms", json={
            "project_id": project.id,
            "name": "Nairobi Solar DD Room",
            "access_level": "restricted",
        }, headers=admin_h)
        assert r.status_code == 201

    def test_analyst_cannot_create(self, client, db_session):
        analyst_h, _ = _make_user(db_session, "analyst")
        project = _create_project(db_session)
        r = client.post("/api/data-rooms", json={
            "project_id": project.id,
            "name": "Unauthorized",
        }, headers=analyst_h)
        assert r.status_code == 403

    def test_get_room_not_found(self, client, db_session):
        admin_h, _ = _make_user(db_session)
        assert client.get("/api/data-rooms/nonexistent", headers=admin_h).status_code == 404

    def test_get_existing_room(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_data_room(db_session, project.id)
        r = client.get(f"/api/data-rooms/{room.id}", headers=admin_h)
        assert r.status_code == 200

    def test_analyst_can_read_room(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        analyst_h, _ = _make_user(db_session, "analyst")
        project = _create_project(db_session)
        room = _create_data_room(db_session, project.id)
        r = client.get(f"/api/data-rooms/{room.id}", headers=analyst_h)
        assert r.status_code == 200

    def test_admin_sees_multiple_rooms(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        _create_data_room(db_session, project.id, "Room A")
        _create_data_room(db_session, project.id, "Room B")
        r = client.get("/api/data-rooms", headers=admin_h)
        assert r.status_code == 200
        assert r.json()["count"] >= 2

    def test_list_documents_empty(self, client, db_session):
        admin_h, admin = _make_user(db_session)
        project = _create_project(db_session)
        room = _create_data_room(db_session, project.id)
        r = client.get(f"/api/data-rooms/{room.id}/documents", headers=admin_h)
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_pagination_params(self, client, db_session):
        admin_h, _ = _make_user(db_session)
        r = client.get("/api/data-rooms?skip=0&limit=10", headers=admin_h)
        assert r.status_code == 200

    def test_analyst_list_uses_project_filter(self, client, db_session):
        """Non-admin still gets 200 (data rooms visible to all authenticated users)."""
        analyst_h, _ = _make_user(db_session, "analyst")
        r = client.get("/api/data-rooms", headers=analyst_h)
        assert r.status_code == 200
