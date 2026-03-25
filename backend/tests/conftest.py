# tests/conftest.py
"""
Shared pytest fixtures for the AIP backend test suite.

Uses in-memory SQLite so tests are fast and isolated.
CRITICAL: imports Base from backend.models (not backend.database) so that
all ORM models — including v2 extensions — are registered in the metadata.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# IMPORTANT: use models.Base (has all table definitions incl. v2 models)
from backend.models import Base
from backend.database import get_db
from backend.main import app
from backend.security.auth import hash_password, create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Core DB / Client Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="function")
def db_session():
    """Create all tables in a fresh in-memory SQLite DB for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient backed by the in-memory test DB."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth Helpers
# ---------------------------------------------------------------------------


@pytest.fixture(scope="function")
def admin_user(db_session):
    """Create and return an admin user in the test DB."""
    from backend.models import User
    user = User(
        email="admin@aip.test",
        hashed_password=hash_password("AdminPass123!"),
        full_name="AIP Admin",
        role="admin",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def analyst_user(db_session):
    """Create and return an analyst user."""
    from backend.models import User
    user = User(
        email="analyst@aip.test",
        hashed_password=hash_password("AnalystPass123!"),
        full_name="AIP Analyst",
        role="analyst",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_token(admin_user):
    """JWT token for the admin user."""
    return create_access_token({"sub": admin_user.email, "user_id": admin_user.id})


@pytest.fixture(scope="function")
def analyst_token(analyst_user):
    """JWT token for the analyst user."""
    return create_access_token({"sub": analyst_user.email, "user_id": analyst_user.id})


@pytest.fixture(scope="function")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="function")
def analyst_headers(analyst_token):
    return {"Authorization": f"Bearer {analyst_token}"}


# ---------------------------------------------------------------------------
# Domain Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="function")
def sample_project(db_session, admin_user):
    """Create a sample InfrastructureProject in the test DB."""
    from backend.models import InfrastructureProject
    project = InfrastructureProject(
        project_name="Nairobi Solar Farm",
        country="Kenya",
        region="East Africa",
        sector="energy",
        project_type="IPP",
        estimated_cost="USD 85M",
        status="planned",
        description="100MW solar IPP serving Nairobi industrial zones",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


@pytest.fixture(scope="function")
def sample_investor(db_session):
    """Create a sample Investor in the test DB."""
    from backend.models import Investor
    import json
    inv = Investor(
        organisation_name="Africa Infrastructure Fund I",
        investor_type="private_fund",
        focus_sectors=json.dumps(["energy", "transport"]),
        focus_regions=json.dumps(["East Africa", "West Africa"]),
        min_ticket_usd="5000000",
        max_ticket_usd="100000000",
        is_active=True,
    )
    db_session.add(inv)
    db_session.commit()
    db_session.refresh(inv)
    return inv


@pytest.fixture
def sample_project_data():
    """Dict for project creation API calls."""
    return {
        "project_name": "Lagos Port Expansion",
        "country": "Nigeria",
        "sector": "transport",
        "project_type": "PPP",
        "estimated_cost": "USD 1.2B",
        "description": "Phase 3 expansion of Apapa Container Terminal",
    }
@pytest.fixture
def sample_user_data():
    return {
        "email": "fixture@test.com",
        "password": "Test@123!",
        "full_name": "Fixture User"
    }
EOF
