"""Tests for admin user management endpoints."""
import pytest


USERS = "/api/users"


class TestUsersAdmin:

    def test_list_users_requires_admin(self, client, analyst_headers):
        r = client.get(USERS, headers=analyst_headers)
        assert r.status_code == 403

    def test_list_users_as_admin(self, client, admin_headers):
        r = client.get(USERS, headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_users_with_role_filter(self, client, admin_headers):
        r = client.get(USERS, params={"role": "analyst"}, headers=admin_headers)
        assert r.status_code == 200

    def test_list_users_with_search(self, client, admin_headers):
        r = client.get(USERS, params={"search": "admin"}, headers=admin_headers)
        assert r.status_code == 200

    def test_create_user_as_admin(self, client, admin_headers):
        r = client.post(USERS, json={
            "email": "newuser_admin_test@example.com",
            "password": "NewPass@1!",
            "full_name": "New Admin User",
            "role": "viewer",
        }, headers=admin_headers)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["email"] == "newuser_admin_test@example.com"
        assert data["role"] == "viewer"

    def test_create_user_duplicate_email(self, client, admin_headers):
        payload = {
            "email": "dupe_admin@example.com",
            "password": "DupePass@1!",
            "role": "viewer",
        }
        client.post(USERS, json=payload, headers=admin_headers)
        r = client.post(USERS, json=payload, headers=admin_headers)
        assert r.status_code == 400

    def test_get_user_by_id(self, client, admin_headers, admin_user):
        r = client.get(f"{USERS}/{admin_user.id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == admin_user.email

    def test_get_user_not_found(self, client, admin_headers):
        r = client.get(f"{USERS}/nonexistent-id-999", headers=admin_headers)
        assert r.status_code == 404

    def test_patch_user_role(self, client, admin_headers, analyst_user):
        r = client.patch(f"{USERS}/{analyst_user.id}", json={"role": "viewer"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "viewer"

    def test_activate_user(self, client, admin_headers, analyst_user):
        r = client.post(f"{USERS}/{analyst_user.id}/activate", headers=admin_headers)
        assert r.status_code == 200

    def test_deactivate_user(self, client, admin_headers, analyst_user):
        r = client.post(f"{USERS}/{analyst_user.id}/deactivate", headers=admin_headers)
        assert r.status_code == 200

    def test_verify_user(self, client, admin_headers, analyst_user):
        r = client.post(f"{USERS}/{analyst_user.id}/verify", headers=admin_headers)
        assert r.status_code == 200

    def test_get_me(self, client, admin_headers, admin_user):
        r = client.get(f"{USERS}/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == admin_user.email

    def test_user_stats(self, client, admin_headers):
        r = client.get(f"{USERS}/stats/summary", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert "active" in data
