"""Africa Infrastructure Radar models for signal detection and analysis."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, Integer, Boolean, DateTime, ForeignKey, Text, JSON, Enum
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class SignalSourceType(enum.Enum):
    """Types of signal sources for radar detection."""
    GOVERNMENT = "government"
    DFI = "dfi"  # Development Finance Institution
    CORPORATE = "corporate"
    MEDIA = "media"
    PPP_UNIT = "ppp_unit"
    INVESTMENT_AGENCY = "investment_agency"


class ProjectStatus(enum.Enum):
    """Status of radar-detected projects."""
    DETECTED = "detected"
    ANALYZING = "analyzing"
    VERIFIED = "verified"
    QUEUED_FOR_EDITORIAL = "queued_for_editorial"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class InvestmentReadiness(enum.Enum):
    """Investment readiness levels."""
    EARLY_STAGE = "early_stage"
    FEASIBILITY = "feasibility"
    TENDER_OPEN = "tender_open"
    FINANCING_SOUGHT = "financing_sought"
    UNDER_CONSTRUCTION = "under_construction"
    OPERATIONAL = "operational"


class RadarSignal(Base):
    """Raw signal detected by the radar system."""

    __tablename__ = "radar_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    # Source information
    source_type = Column(String(50), nullable=False)  # SignalSourceType value
    source_name = Column(String(255), nullable=False)  # e.g., "AfDB", "Kenya Investment Authority"
    source_url = Column(Text)
    source_date = Column(DateTime)

    # Signal content
    title = Column(String(500), nullable=False)
    raw_content = Column(Text)
    content_hash = Column(String(64))  # For deduplication

    # Classification
    signal_type = Column(String(100))  # tender, announcement, financing, etc.
    countries = Column(JSON)  # List of affected countries
    sectors = Column(JSON)  # List of affected sectors
    estimated_value_usd = Column(Numeric(18, 2))

    # Processing status
    is_processed = Column(Boolean, default=False, nullable=False)
    processed_at = Column(DateTime)
    radar_project_id = Column(Integer, ForeignKey("radar_projects.id", ondelete="SET NULL"))

    # Metadata
    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    radar_project = relationship("RadarProject", back_populates="signals")

    def __repr__(self):
        return f"<RadarSignal {self.title[:50]}>"


class RadarProject(Base):
    """Analyzed infrastructure project from radar detection."""

    __tablename__ = "radar_projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    # Basic Information
    name = Column(String(500), nullable=False)
    description = Column(Text)
    summary = Column(Text)  # AI-generated summary

    # Location
    primary_country = Column(String(100), nullable=False)
    countries = Column(JSON)  # All countries involved
    region = Column(String(100))  # West Africa, East Africa, etc.
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))

    # Classification
    sector = Column(String(100), nullable=False)  # Transport, Energy, Mining Logistics, etc.
    sub_sector = Column(String(100))
    project_type = Column(String(100))  # Railway, Port, Solar, Hydro, etc.

    # Financial Information
    estimated_investment_usd = Column(Numeric(18, 2))
    investment_range = Column(String(50))  # $100M+, $500M+, $1B+, etc.
    funding_sources = Column(JSON)  # List of identified funding sources

    # Status and Readiness
    status = Column(String(50), default=ProjectStatus.DETECTED.value, nullable=False)
    investment_readiness = Column(String(50))
    timeline = Column(JSON)  # Key dates and milestones

    # Strategic Analysis (AI-generated)
    strategic_importance = Column(Text)
    regional_impact = Column(Text)
    investment_opportunity = Column(Text)
    risk_factors = Column(JSON)
    key_stakeholders = Column(JSON)

    # Corridor association
    corridor_id = Column(Integer, ForeignKey("strategic_corridors.id", ondelete="SET NULL"))

    # Content Pipeline
    draft_article = Column(Text)  # AI-generated draft
    podcast_suggestion = Column(Text)  # AI-generated podcast topic
    editorial_notes = Column(Text)
    is_editorial_approved = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime)

    # AI Analysis metadata
    ai_analysis_version = Column(String(50))
    ai_confidence_score = Column(Numeric(5, 2))
    last_analyzed_at = Column(DateTime)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    signals = relationship("RadarSignal", back_populates="radar_project")
    corridor = relationship("StrategicCorridor", back_populates="projects")

    def __repr__(self):
        return f"<RadarProject {self.name}>"


class StrategicCorridor(Base):
    """Strategic infrastructure corridors across Africa."""

    __tablename__ = "strategic_corridors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)

    # Corridor Information
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text)

    # Geography
    countries = Column(JSON, nullable=False)  # List of countries
    regions = Column(JSON)  # List of regions
    coordinates = Column(JSON)  # GeoJSON line/polygon

    # Classification
    corridor_type = Column(String(100))  # Multi-modal, Rail, Maritime, etc.
    primary_sector = Column(String(100))

    # Scale
    total_investment_usd = Column(Numeric(18, 2))
    length_km = Column(Numeric(10, 2))

    # Strategic importance
    strategic_significance = Column(Text)
    economic_impact = Column(Text)
    key_infrastructure = Column(JSON)  # List of key infrastructure projects

    # Status
    development_status = Column(String(100))  # Planned, Partial, Operational
    completion_target = Column(String(50))  # e.g., "2030"

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    projects = relationship("RadarProject", back_populates="corridor")

    def __repr__(self):
        return f"<StrategicCorridor {self.name}>"


class RadarScanLog(Base):
    """Log of radar scan operations."""

    __tablename__ = "radar_scan_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Scan information
    scan_type = Column(String(50), nullable=False)  # scheduled, manual, targeted
    source_type = Column(String(50))

    # Results
    signals_detected = Column(Integer, default=0)
    projects_created = Column(Integer, default=0)
    projects_updated = Column(Integer, default=0)

    # Status
    status = Column(String(50), nullable=False)  # started, completed, failed
    error_message = Column(Text)

    # Timing
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)

    def __repr__(self):
        return f"<RadarScanLog {self.scan_type} at {self.started_at}>"
