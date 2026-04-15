# tests/test_data_rooms.py
import pytest


class TestCreateDataRoom:
    """Tests for data room creation endpoint."""

    def test_create_data_room_success(self, client, db_session):
        """Test successful data room creation."""
        from backend.models import Project, Sector, ProjectStage
        project = Project(
            name="Data Room Test Project",
            sector=Sector.ENERGY,
            country="Nigeria",
            stage=ProjectStage.FEASIBILITY,
            estimated_capex=25000000.0,
            revenue_model="PPA"
        )
        db_session.add(project)
        db_session.commit()

        data_room_data = {
            "project_id": project.id,
            "nda_required": True,
            "access_users": [1, 2, 3],
            "documents": {"feasibility_study": "s3://bucket/doc1.pdf"}
        }
        response = client.post("/data-rooms/", json=data_room_data)
        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == project.id
        assert data["nda_required"] == True
        assert "id" in data

    def test_create_data_room_no_nda_required(self, client, db_session):
        """Test creating data room without NDA requirement."""
        from backend.models import Project, Sector, ProjectStage
        project = Project(
            name="Public Data Room Project",
            sector=Sector.WATER,
            country="Kenya",
            stage=ProjectStage.CONCEPT,
            estimated_capex=5000000.0,
            revenue_model="Government contract"
        )
        db_session.add(project)
        db_session.commit()

        data_room_data = {
            "project_id": project.id,
            "nda_required": False
        }
        response = client.post("/data-rooms/", json=data_room_data)
        assert response.status_code == 200
        data = response.json()
        assert data["nda_required"] == False

    def test_create_data_room_with_documents(self, client, db_session):
        """Test creating data room with multiple documents."""
        from backend.models import Project, Sector, ProjectStage
        project = Project(
            name="Document Test Project",
            sector=Sector.TRANSPORT,
            country="Ghana",
            stage=ProjectStage.PROCUREMENT,
            estimated_capex=80000000.0,
            revenue_model="Toll collection"
        )
        db_session.add(project)
        db_session.commit()

        documents = {
            "feasibility_study": "s3://bucket/feasibility.pdf",
            "environmental_impact": "s3://bucket/eia.pdf",
            "financial_model": "s3://bucket/model.xlsx",
            "legal_documents": "s3://bucket/contracts.pdf"
        }
        data_room_data = {
            "project_id": project.id,
            "nda_required": True,
            "documents": documents
        }
        response = client.post("/data-rooms/", json=data_room_data)
        assert response.status_code == 200

    def test_create_data_room_missing_project_id(self, client, admin_headers):
        """Test that missing project_id is rejected."""
        data_room_data = {
            "nda_required": True
        }
        response = client.post("/api/data-rooms", json=data_room_data, headers=admin_headers)
        assert response.status_code == 422


class TestGetDataRoom:
    """Tests for data room retrieval endpoint."""

    def test_get_data_room_success(self, client, db_session):
        """Test successful data room retrieval."""
        from backend.models import Project, Sector, ProjectStage
        project = Project(
            name="Get Data Room Project",
            sector=Sector.MINING,
            country="South Africa",
            stage=ProjectStage.CONSTRUCTION,
            estimated_capex=150000000.0,
            revenue_model="Commodity sales"
        )
        db_session.add(project)
        db_session.commit()

        # Create data room
        data_room_data = {
            "project_id": project.id,
            "nda_required": True,
            "access_users": [10, 20],
            "documents": {"report": "s3://bucket/report.pdf"}
        }
        create_response = client.post("/data-rooms/", json=data_room_data)
        room_id = create_response.json()["id"]

        # Retrieve data room
        response = client.get(f"/data-rooms/{room_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == room_id
        assert data["project_id"] == project.id

    def test_get_data_room_not_found(self, client):
        """Test retrieving non-existent data room returns 404."""
        response = client.get("/data-rooms/99999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_data_room_invalid_id(self, client):
        """Test retrieving with invalid ID format."""
        response = client.get("/data-rooms/invalid")
        assert response.status_code == 422


class TestDataRoomAccessControl:
    """Tests for data room access control features."""

    def test_data_room_empty_access_list(self, client, db_session):
        """Test data room with empty access list."""
        from backend.models import Project, Sector, ProjectStage
        project = Project(
            name="Empty Access Project",
            sector=Sector.AGRICULTURE,
            country="Ethiopia",
            stage=ProjectStage.FEASIBILITY,
            estimated_capex=8000000.0,
            revenue_model="Crop sales"
        )
        db_session.add(project)
        db_session.commit()

        data_room_data = {
            "project_id": project.id,
            "nda_required": True,
            "access_users": []
        }
        response = client.post("/data-rooms/", json=data_room_data)
        assert response.status_code == 200

    def test_data_room_large_access_list(self, client, db_session):
        """Test data room with many users."""
        from backend.models import Project, Sector, ProjectStage
        project = Project(
            name="Large Access Project",
            sector=Sector.HEALTH,
            country="Rwanda",
            stage=ProjectStage.OPERATION,
            estimated_capex=12000000.0,
            revenue_model="Healthcare services"
        )
        db_session.add(project)
        db_session.commit()

        # Create access list with 50 users
        access_users = list(range(1, 51))
        data_room_data = {
            "project_id": project.id,
            "nda_required": True,
            "access_users": access_users
        }
        response = client.post("/data-rooms/", json=data_room_data)
        assert response.status_code == 200


class TestDataRoomDocuments:
    """Tests for data room document management."""

    def test_data_room_empty_documents(self, client, db_session):
        """Test data room with no documents."""
        from backend.models import Project, Sector, ProjectStage
        project = Project(
            name="No Docs Project",
            sector=Sector.PORTS,
            country="Tanzania",
            stage=ProjectStage.CONCEPT,
            estimated_capex=300000000.0,
            revenue_model="Port fees"
        )
        db_session.add(project)
        db_session.commit()

        data_room_data = {
            "project_id": project.id,
            "nda_required": False,
            "documents": {}
        }
        response = client.post("/data-rooms/", json=data_room_data)
        assert response.status_code == 200

    def test_data_room_document_types(self, client, db_session):
        """Test data room with various document types."""
        from backend.models import Project, Sector, ProjectStage
        project = Project(
            name="Doc Types Project",
            sector=Sector.RAIL,
            country="Mozambique",
            stage=ProjectStage.PROCUREMENT,
            estimated_capex=1000000000.0,
            revenue_model="Rail freight"
        )
        db_session.add(project)
        db_session.commit()

        documents = {
            "pdf_doc": "s3://bucket/document.pdf",
            "excel_model": "s3://bucket/model.xlsx",
            "word_doc": "s3://bucket/memo.docx",
            "presentation": "s3://bucket/pitch.pptx",
            "image": "s3://bucket/site_photo.jpg"
        }
        data_room_data = {
            "project_id": project.id,
            "nda_required": True,
            "documents": documents
        }
        response = client.post("/data-rooms/", json=data_room_data)
        assert response.status_code == 200
