"""Africa Infrastructure Radar models for signal detection and analysis."""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Numeric, Integer, Boolean, DateTime,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class RadarSignal(Base):
        """Raw intelligence signal detected by the radar system."""

    __tablename__ = "radar_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    # Source information
    source_type = Column(String(50), nullable=False)   # government, dfi, corporate, media, …
    source_name = Column(String(255), nullable=False)  # e.g. "AfDB", "Kenya Investment Authority"
    source_url = Column(Text)
    source_date = Column(DateTime)

    # Signal content
    title = Column(String(500), nullable=False)
    raw_content = Column(Text)
    content_hash = Column(String(64))  # SHA-256 for deduplication

    # Classification
    signal_type = Column(String(100))  # tender, announcement, financing, milestone …
    countries = Column(JSON)           # list of affected country names
    sectors = Column(JSON)             # list of affected sector names
    estimated_value_usd = Column(Numeric(18, 2))

    # Processing pipeline
    is_processed = Column(Boolean, default=False, nullable=False)
    processed_at = Column(DateTime)
    radar_project_id = Column(Integer, ForeignKey("radar_projects.id", ondelete="SET NULL"))

    # Metadata
    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    radar_project = relationship("RadarProject", back_populates="signals")

    def __repr__(self) -> str:
                return f"<RadarSignal {self.title[:60]!r}>"


class StrategicCorridor(Base):
        """Strategic multi-country infrastructure corridor across Africa."""

    __tablename__ = "strategic_corridors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    # Identity
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text)

    # Geography
    countries = Column(JSON, nullable=False)  # list of country names
    regions = Column(JSON)                    # list of region names
    coordinates = Column(JSON)               # GeoJSON LineString / Polygon

    # Classification
    corridor_type = Column(String(100))    # Multi-modal, Rail, Maritime, Road …
    primary_sector = Column(String(100))   # Transport, Energy …

    # Scale
    total_investment_usd = Column(Numeric(18, 2))
    length_km = Column(Numeric(10, 2))

    # Strategic narrative
    strategic_significance = Column(Text)
    economic_impact = Column(Text)
    key_infrastructure = Column(JSON)      # list of key infrastructure names

    # Development status
    development_status = Column(String(100))  # Planned, Partial, Operational
    completion_target = Column(String(50))    # e.g. "2030"

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    projects = relationship("RadarProject", back_populates="corridor")

    def __repr__(self) -> str:
                return f"<StrategicCorridor {self.name!r}>"


class RadarProject(Base):
        """Analysed infrastructure project surfaced by radar detection."""

    __tablename__ = "radar_projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    # Basic information
    name = Column(String(500), nullable=False)
    description = Column(Text)
    summary = Column(Text)  # AI-generated summary

    # Location
    primary_country = Column(String(100), nullable=False)
    countries = Column(JSON)           # all countries involved
    region = Column(String(100))       # West Africa, East Africa, …
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))

    # Classification
    sector = Column(String(100), nullable=False)   # Transport, Energy, Mining Logistics …
    sub_sector = Column(String(100))
    project_type = Column(String(100))             # Railway, Port, Solar, Hydro …

    # Financial information
    estimated_investment_usd = Column(Numeric(18, 2))
    investment_range = Column(String(50))          # "$100M+", "$500M+", "$1B+" …
    funding_sources = Column(JSON)                 # list of identified funding-source names

    # Status
    # Allowed values: detected | analyzing | verified | queued_for_editorial | published | archived
    status = Column(String(50), default="detected", nullable=False)
    # Allowed values: early_stage | feasibility | tender_open | financing_sought |
    #                 under_construction | operational
    investment_readiness = Column(String(50))
    timeline = Column(JSON)  # dict of key dates / milestones

    # Strategic analysis (AI-generated)
    strategic_importance = Column(Text)
    regional_impact = Column(Text)
    investment_opportunity = Column(Text)
    risk_factors = Column(JSON)      # list of risk-factor strings
    key_stakeholders = Column(JSON)  # list of stakeholder names / organisations

    # Corridor association
    corridor_id = Column(Integer, ForeignKey("strategic_corridors.id", ondelete="SET NULL"))

    # Content pipeline
    draft_article = Column(Text)       # AI-generated article draft
    podcast_suggestion = Column(Text)  # AI-generated podcast topic
    editorial_notes = Column(Text)
    is_editorial_approved = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime)

    # AI analysis metadata
    ai_analysis_version = Column(String(50))
    ai_confidence_score = Column(Numeric(5, 2))
    last_analyzed_at = Column(DateTime)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    signals = relationship("RadarSignal", back_populates="radar_project")
    corridor = relationship("StrategicCorridor", back_populates="projects")

    def __repr__(self) -> str:
                return f"<RadarProject {self.name!r}>"


class RadarScanLog(Base):
        """Audit log of radar scan operations."""

    __tablename__ = "radar_scan_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Scan identity
    scan_type = Column(String(50), nullable=False)   # scheduled | manual | targeted
    source_type = Column(String(50))

    # Results
    signals_detected = Column(Integer, default=0)
    projects_created = Column(Integer, default=0)
    projects_updated = Column(Integer, default=0)

    # Status
    status = Column(String(50), nullable=False)  # started | completed | failed
    error_message = Column(Text)

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)

    def __repr__(self) -> str:
                return f"<RadarScanLog {self.scan_type!r} at {self.started_at}>"
        
