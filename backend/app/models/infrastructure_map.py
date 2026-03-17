"""Strategic Intelligence Map models for infrastructure visualization."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class MapProjectStatus(enum.Enum):
    """Status of map projects."""
    PLANNED = "planned"
    UNDER_CONSTRUCTION = "under_construction"
    OPERATIONAL = "operational"
    SUSPENDED = "suspended"


class InfrastructureMapProject(Base):
    """Infrastructure project for the Strategic Intelligence Map."""

    __tablename__ = "infrastructure_map_projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    # Basic Information
    name = Column(String(500), nullable=False)
    description = Column(Text)
    summary = Column(Text)

    # Geographic Location
    primary_country = Column(String(100), nullable=False)
    countries = Column(JSON)  # All countries involved
    region = Column(String(100))  # West Africa, East Africa, etc.
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)
    location_name = Column(String(255))  # City/region name
    geo_json = Column(JSON)  # Optional GeoJSON for project extent

    # Classification
    sector = Column(String(100), nullable=False)  # Transport, Energy, Mining Logistics, Ports, Digital Infrastructure
    sub_sector = Column(String(100))
    project_type = Column(String(100))  # Railway, Port, Solar, Hydro, Highway, Airport, etc.

    # Scale
    investment_usd = Column(Numeric(18, 2))
    investment_range = Column(String(50))  # $100M+, $500M+, $1B+, $5B+, $10B+
    capacity_value = Column(Numeric(18, 2))
    capacity_unit = Column(String(50))  # MW, km, TEU, etc.

    # Status
    status = Column(String(50), default=MapProjectStatus.PLANNED.value, nullable=False)
    development_phase = Column(String(100))  # Pre-feasibility, Feasibility, EPC, Construction, Commissioning
    completion_year = Column(Integer)
    start_year = Column(Integer)

    # Key Stakeholders
    sponsor = Column(String(255))
    developers = Column(JSON)  # List of developers/contractors
    financiers = Column(JSON)  # List of financing institutions
    government_agencies = Column(JSON)

    # Strategic Information (AI-generated)
    strategic_importance = Column(Text)
    regional_impact = Column(Text)
    investment_opportunity = Column(Text)

    # Corridor association (links to radar corridors)
    corridor_id = Column(Integer, ForeignKey("strategic_corridors.id", ondelete="SET NULL"))

    # Intelligence Brief
    last_brief_generated = Column(DateTime)
    brief_content = Column(JSON)  # Cached intelligence brief

    # Display settings
    is_featured = Column(Boolean, default=False, nullable=False)
    display_priority = Column(Integer, default=0)  # Higher = more prominent
    marker_color = Column(String(20))  # Custom marker color
    marker_icon = Column(String(50))  # Custom marker icon

    # Data source linkage
    radar_project_id = Column(Integer, ForeignKey("radar_projects.id", ondelete="SET NULL"))
    aip_project_id = Column(Integer, ForeignKey("aip_projects.id", ondelete="SET NULL"))

    # Metadata
    data_source = Column(String(100))  # Where the data came from
    last_verified = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    corridor = relationship("StrategicCorridor")
    radar_project = relationship("RadarProject")
    aip_project = relationship("Project")
    intelligence_briefs = relationship("IntelligenceBrief", back_populates="map_project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<InfrastructureMapProject {self.name}>"


class IntelligenceBrief(Base):
    """AI-generated intelligence brief for a map project."""

    __tablename__ = "intelligence_briefs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)
    map_project_id = Column(Integer, ForeignKey("infrastructure_map_projects.id", ondelete="CASCADE"), nullable=False)

    # Brief content
    executive_summary = Column(Text)
    strategic_importance = Column(JSON)  # {rating, analysis}
    investment_opportunity = Column(JSON)  # {attractiveness, key_factors, recommended_investors, analysis}
    regional_impact = Column(JSON)  # {economic, connectivity, development}
    risk_assessment = Column(JSON)  # {overall_risk, risks[]}
    key_milestones = Column(JSON)  # List of milestones
    related_projects = Column(JSON)  # List of related project IDs/names

    # Generation metadata
    ai_model_version = Column(String(50))
    confidence_score = Column(Numeric(5, 2))
    processing_time_ms = Column(Integer)

    # User interactions
    view_count = Column(Integer, default=0)
    last_viewed = Column(DateTime)

    # Metadata
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime)  # When the brief should be regenerated

    # Relationships
    map_project = relationship("InfrastructureMapProject", back_populates="intelligence_briefs")

    def __repr__(self):
        return f"<IntelligenceBrief for project {self.map_project_id}>"


class MapLayer(Base):
    """Custom map layers for visualization."""

    __tablename__ = "map_layers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Layer type
    layer_type = Column(String(50), nullable=False)  # corridor, region, custom
    geo_json = Column(JSON)  # GeoJSON data

    # Styling
    style = Column(JSON)  # Mapbox/Leaflet style properties
    color = Column(String(20))
    opacity = Column(Numeric(3, 2), default=0.5)

    # Display settings
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0)
    min_zoom = Column(Integer, default=0)
    max_zoom = Column(Integer, default=22)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<MapLayer {self.name}>"
