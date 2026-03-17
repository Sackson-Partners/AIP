"""Infrastructure Map models for geospatial project tracking."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Numeric, JSON, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class InfrastructureMapLayer(Base):
      """A map layer grouping infrastructure assets by theme."""
      __tablename__ = "infrastructure_map_layers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    layer_type = Column(String(50), nullable=False)
    # energy, transport, water, telecom, health, education, mixed
    color_hex = Column(String(7), default="#1E88E5", nullable=False)  # Map pin colour
    icon = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    assets = relationship("InfrastructureAsset", back_populates="layer", cascade="all, delete-orphan")

    def __repr__(self):
              return f"<InfrastructureMapLayer name={self.name} type={self.layer_type}>"


class InfrastructureAsset(Base):
      """A single infrastructure asset plotted on the map."""
      __tablename__ = "infrastructure_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    # Layer grouping
    layer_id = Column(Integer, ForeignKey("infrastructure_map_layers.id", ondelete="SET NULL"), nullable=True)

    # Optional link to formal project
    project_id = Column(Integer, ForeignKey("aip_projects.id", ondelete="SET NULL"), nullable=True)

    # Identification
    name = Column(String(255), nullable=False)
    asset_type = Column(String(100), nullable=False)
    # power-plant, substation, road, rail, port, airport, dam, hospital, school, tower, etc.
    country = Column(String(100), nullable=False)
    region = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    address = Column(String(500), nullable=True)

    # Geospatial
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    geometry_json = Column(JSON, nullable=True)  # GeoJSON for polygons / lines

    # Status
    status = Column(String(50), default="planned", nullable=False)
    # planned, under-construction, operational, decommissioned
    completion_year = Column(Integer, nullable=True)
    operator = Column(String(255), nullable=True)
    owner = Column(String(255), nullable=True)

    # Capacity / specs
    capacity_value = Column(Numeric(18, 4), nullable=True)
    capacity_unit = Column(String(50), nullable=True)

    # Financial
    investment_usd = Column(Numeric(18, 2), nullable=True)
    funding_source = Column(String(500), nullable=True)

    # Metadata
    description = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)
    data_source = Column(String(255), nullable=True)
    external_id = Column(String(255), nullable=True)  # ID from external data source
    is_verified = Column(Boolean, default=False, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)

    added_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    layer = relationship("InfrastructureMapLayer", back_populates="assets")
    project = relationship("Project", back_populates=None)

    def __repr__(self):
              return f"<InfrastructureAsset name={self.name} type={self.asset_type} country={self.country}>"
