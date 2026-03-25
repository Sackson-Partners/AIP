"""
AIP SQLAlchemy ORM Models
--------------------------
All models import Base from backend.database to avoid circular imports.
"""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database import Base

import enum


class Sector(str, enum.Enum):
    AGRICULTURE    = "agriculture"
    ENERGY         = "energy"
    FINANCE        = "finance"
    HEALTHCARE     = "healthcare"
    INFRASTRUCTURE = "infrastructure"
    MANUFACTURING  = "manufacturing"
    REAL_ESTATE    = "real_estate"
    TECHNOLOGY     = "technology"
    TRANSPORT      = "transport"
    WATER          = "water"
    OTHER          = "other"


class ProjectStage(str, enum.Enum):
    CONCEPT        = "concept"
    FEASIBILITY    = "feasibility"
    PREPARATION    = "preparation"
    APPROVAL       = "approval"
    IMPLEMENTATION = "implementation"
    COMPLETION     = "completion"
    OPERATIONAL    = "operational"
    CANCELLED      = "cancelled"



def _uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True, default=_uuid)
    email           = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name       = Column(String, nullable=True)
    organisation    = Column(String, nullable=True)
    role            = Column(String, default="analyst")
    is_active       = Column(Boolean, default=True)
    is_verified     = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    introductions = relationship("Introduction", back_populates="user")
    analytics     = relationship("AnalyticsEvent", back_populates="user")
    verifications = relationship("Verification", back_populates="user")


# ---------------------------------------------------------------------------
# Infrastructure Projects
# ---------------------------------------------------------------------------


class InfrastructureProject(Base):
    __tablename__ = "infrastructure_projects"

    id                    = Column(String, primary_key=True, default=_uuid)
    airtable_record_id    = Column(String, unique=True, nullable=True, index=True)
    project_name          = Column(String, nullable=False, index=True)
    country               = Column(String, nullable=True, index=True)
    region                = Column(String, nullable=True)
    latitude              = Column(Float, nullable=True)
    longitude             = Column(Float, nullable=True)
    sector                = Column(String, nullable=True)
    project_type          = Column(String, nullable=True)
    estimated_cost        = Column(String, nullable=True)
    status                = Column(String, default="planned")
    investors             = Column(Text, nullable=True)
    developers            = Column(Text, nullable=True)
    description           = Column(Text, nullable=True)
    strategic_notes       = Column(Text, nullable=True)
    ai_brief              = Column(Text, nullable=True)
    ai_brief_generated_at = Column(DateTime(timezone=True), nullable=True)
    source_url            = Column(String, nullable=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    data_rooms    = relationship("DataRoom", back_populates="project")
    deal_rooms    = relationship("DealRoom", back_populates="project")
    events        = relationship("ProjectEvent", back_populates="project")
    introductions = relationship("Introduction", back_populates="project")


# ---------------------------------------------------------------------------
# Countries
# ---------------------------------------------------------------------------


class Country(Base):
    __tablename__ = "countries"

    id                      = Column(String, primary_key=True, default=_uuid)
    name                    = Column(String, unique=True, nullable=False, index=True)
    iso_code                = Column(String(3), nullable=True)
    region                  = Column(String, nullable=True)
    infrastructure_strategy = Column(Text, nullable=True)
    investment_priority     = Column(Text, nullable=True)
    logistics_corridors     = Column(Text, nullable=True)
    energy_capacity         = Column(String, nullable=True)
    key_contacts            = Column(Text, nullable=True)
    ai_brief                = Column(Text, nullable=True)
    ai_brief_generated_at   = Column(DateTime(timezone=True), nullable=True)
    created_at              = Column(DateTime(timezone=True), server_default=func.now())
    updated_at              = Column(DateTime(timezone=True), onupdate=func.now())


# ---------------------------------------------------------------------------
# Stakeholders
# ---------------------------------------------------------------------------


class Stakeholder(Base):
    __tablename__ = "stakeholders"

    id                    = Column(String, primary_key=True, default=_uuid)
    name                  = Column(String, nullable=False)
    role                  = Column(String, nullable=True)
    organisation          = Column(String, nullable=True)
    country               = Column(String, nullable=True)
    sector                = Column(String, nullable=True)
    email                 = Column(String, nullable=True)
    linkedin              = Column(String, nullable=True)
    podcast_guest         = Column(Boolean, default=False)
    podcast_episode_count = Column(Integer, default=0)
    notes                 = Column(Text, nullable=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Investors
# ---------------------------------------------------------------------------


class Investor(Base):
    __tablename__ = "investors"

    id                   = Column(String, primary_key=True, default=_uuid)
    user_id              = Column(String, ForeignKey("users.id"), nullable=True)
    organisation_name    = Column(String, nullable=False)
    investor_type        = Column(String, nullable=True)
    aum_usd              = Column(String, nullable=True)
    focus_sectors        = Column(Text, nullable=True)
    focus_regions        = Column(Text, nullable=True)
    min_ticket_usd       = Column(String, nullable=True)
    max_ticket_usd       = Column(String, nullable=True)
    preferred_structures = Column(Text, nullable=True)
    contact_name         = Column(String, nullable=True)
    contact_email        = Column(String, nullable=True)
    website              = Column(String, nullable=True)
    is_active            = Column(Boolean, default=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    introductions = relationship("Introduction", back_populates="investor")


# ---------------------------------------------------------------------------
# Introductions
# ---------------------------------------------------------------------------


class Introduction(Base):
    __tablename__ = "introductions"

    id           = Column(String, primary_key=True, default=_uuid)
    project_id   = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    investor_id  = Column(String, ForeignKey("investors.id"), nullable=True)
    user_id      = Column(String, ForeignKey("users.id"), nullable=True)
    status       = Column(String, default="pending")
    notes        = Column(Text, nullable=True)
    initiated_by = Column(String, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project  = relationship("InfrastructureProject", back_populates="introductions")
    investor = relationship("Investor", back_populates="introductions")
    user     = relationship("User", back_populates="introductions")


# ---------------------------------------------------------------------------
# Data Rooms
# ---------------------------------------------------------------------------


class DataRoom(Base):
    __tablename__ = "data_rooms"

    id           = Column(String, primary_key=True, default=_uuid)
    project_id   = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    name         = Column(String, nullable=False)
    description  = Column(Text, nullable=True)
    is_active    = Column(Boolean, default=True)
    access_level = Column(String, default="restricted")
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project   = relationship("InfrastructureProject", back_populates="data_rooms")
    documents = relationship("DataRoomDocument", back_populates="data_room")


class DataRoomDocument(Base):
    __tablename__ = "data_room_documents"

    id              = Column(String, primary_key=True, default=_uuid)
    data_room_id    = Column(String, ForeignKey("data_rooms.id"), nullable=False)
    file_name       = Column(String, nullable=False)
    file_type       = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    azure_blob_url  = Column(String, nullable=True)
    uploaded_by     = Column(String, ForeignKey("users.id"), nullable=True)
    description     = Column(Text, nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    data_room = relationship("DataRoom", back_populates="documents")


# ---------------------------------------------------------------------------
# Deal Rooms
# ---------------------------------------------------------------------------


class DealRoom(Base):
    __tablename__ = "deal_rooms"

    id          = Column(String, primary_key=True, default=_uuid)
    project_id  = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    name        = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status      = Column(String, default="active")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project  = relationship("InfrastructureProject", back_populates="deal_rooms")
    messages = relationship("DealRoomMessage", back_populates="deal_room")


class DealRoomMessage(Base):
    __tablename__ = "deal_room_messages"

    id               = Column(String, primary_key=True, default=_uuid)
    deal_room_id     = Column(String, ForeignKey("deal_rooms.id"), nullable=False)
    user_id          = Column(String, ForeignKey("users.id"), nullable=True)
    message_type     = Column(String, default="text")
    content          = Column(Text, nullable=True)
    message_metadata = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    deal_room = relationship("DealRoom", back_populates="messages")


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id             = Column(String, primary_key=True, default=_uuid)
    user_id        = Column(String, ForeignKey("users.id"), nullable=True)
    event_type     = Column(String, nullable=False)
    entity_type    = Column(String, nullable=True)
    entity_id      = Column(String, nullable=True)
    event_metadata = Column(Text, nullable=True)
    ip_hash        = Column(String, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="analytics")


# ---------------------------------------------------------------------------
# Project Events
# ---------------------------------------------------------------------------


class ProjectEvent(Base):
    __tablename__ = "project_events"

    id          = Column(String, primary_key=True, default=_uuid)
    project_id  = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    event_type  = Column(String, nullable=False)
    title       = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_date  = Column(DateTime(timezone=True), nullable=True)
    source_url  = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("InfrastructureProject", back_populates="events")


# ---------------------------------------------------------------------------
# Verifications
# ---------------------------------------------------------------------------


class Verification(Base):
    __tablename__ = "verifications"

    id                = Column(String, primary_key=True, default=_uuid)
    user_id           = Column(String, ForeignKey("users.id"), nullable=False)
    verification_type = Column(String, nullable=False)
    status            = Column(String, default="pending")
    submitted_at      = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at       = Column(DateTime(timezone=True), nullable=True)
    reviewer_notes    = Column(Text, nullable=True)
    document_url      = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="verifications")


# ---------------------------------------------------------------------------
# AIP v2 Extended Models — import AFTER all base models are defined
# ---------------------------------------------------------------------------


import enum


class Sector(str, enum.Enum):
    AGRICULTURE    = "agriculture"
    ENERGY         = "energy"
    FINANCE        = "finance"
    HEALTHCARE     = "healthcare"
    INFRASTRUCTURE = "infrastructure"
    MANUFACTURING  = "manufacturing"
    REAL_ESTATE    = "real_estate"
    TECHNOLOGY     = "technology"
    TRANSPORT      = "transport"
    WATER          = "water"
    OTHER          = "other"


class ProjectStage(str, enum.Enum):
    CONCEPT        = "concept"
    FEASIBILITY    = "feasibility"
    PREPARATION    = "preparation"
    APPROVAL       = "approval"
    IMPLEMENTATION = "implementation"
    COMPLETION     = "completion"
    OPERATIONAL    = "operational"
    CANCELLED      = "cancelled"


# ---------------------------------------------------------------------------
# AIP v2 Extended Models — import AFTER all base models are defined
# ---------------------------------------------------------------------------

from backend.models_aip_v2 import (  # noqa: E402
    Organization,
    UserOrganization,
    Partner,
    PartnerProject,
    ProjectDetail,
    ProjectDocument,
    InvestorInterest,
    PipelineStage,
    ProjectPipeline,
    PipelineLog,
    InvestmentCommittee,
    ICVote,
    PetfelAssessment,
    PetfelScore,
    PetfelFlag,
    ExecutiveNote,
    EINSection,
    AiAnalysis,
    InvestorMatch,
)
