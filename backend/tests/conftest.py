import pytest
import uuid
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import Base, engine

# Create tables once for the test session
Base.metadata.create_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sample_user_data():
    uid = str(uuid.uuid4())[:8]
    return {
        "email": f"test_{uid}@aip.com",
        "password": "Test@123!",
        "full_name": f"Test User {uid}"
    }


@pytest.fixture
def sample_project_data():
    uid = str(uuid.uuid4())[:8]
    return {
        "name": f"Test Project {uid}",
        "sector": "Energy",
        "country": "Kenya",
        "stage": "Concept",
        "estimated_capex": 5000000.0,
        "revenue_model": "PPA"
    }


@pytest.fixture
def sample_investor(client, sample_user_data):
    uid = str(uuid.uuid4())[:8]
    return {
        "organisation_name": f"Test Fund {uid}",
        "investor_type": "DFI",
        "focus_sectors": "Energy,Transport",
        "focus_regions": "East Africa",
        "min_ticket_usd": "1000000",
        "max_ticket_usd": "50000000"
    }


@pytest.fixture
def registered_user(client, sample_user_data):
    """Register + login, return token and headers."""
    # Register
    reg = client.post("/api/auth/register", json=sample_user_data)
    assert reg.status_code in [200, 201], f"Register failed: {reg.text}"

    # Login - uses /api/auth/token (OAuth2 form OR JSON)
    login = client.post(
        "/api/auth/token",
        json={
            "username": sample_user_data["email"],
            "password": sample_user_data["password"]
        }
    )
    token = login.json().get("access_token", "")
    return {
        "user": reg.json(),
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "credentials": sample_user_data
    }


@pytest.fixture
def admin_user(client):
    uid = str(uuid.uuid4())[:8]
    data = {
        "email": f"admin_{uid}@aip.com",
        "password": "Admin@123!",
        "full_name": f"Admin {uid}"
    }
    reg = client.post("/api/auth/register", json=data)
    token = ""
    if reg.status_code in [200, 201]:
        login = client.post(
            "/api/auth/token",
            json={"username": data["email"], "password": data["password"]}
        )
        token = login.json().get("access_token", "")
    return {
        "user": reg.json() if reg.status_code in [200, 201] else {},
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }


# Aliases used by some test files
@pytest.fixture
def admin_token(admin_user):
    return admin_user["token"]


@pytest.fixture
def admin_headers(admin_user):
    return admin_user["headers"]


@pytest.fixture
def analyst_user(client, sample_user_data):
    reg = client.post("/api/auth/register", json=sample_user_data)
    token = ""
    if reg.status_code in [200, 201]:
        login = client.post(
            "/api/auth/token",
            json={"username": sample_user_data["email"], "password": sample_user_data["password"]}
        )
        token = login.json().get("access_token", "")
    return {
        "user": reg.json() if reg.status_code in [200, 201] else {},
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"}
    }


@pytest.fixture
def analyst_token(analyst_user):
    return analyst_user["token"]


@pytest.fixture
def analyst_headers(analyst_user):
    return analyst_user["headers"]


@pytest.fixture
def db_session():
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
