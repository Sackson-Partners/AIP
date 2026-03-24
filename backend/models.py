"""
AIP SQLAlchemy ORM Models
--------------------------
Defines all database tables for the AIP platform.
Compatible with both SQLite (development) and PostgreSQL (production via Supabase).

Tables:
    users                   - Authenticated platform users
    infrastructure_projects - Africa infrastructure project knowledge base
    countries               - Country-level infrastructure profiles
    stakeholders            - Key people in the Africa infrastructure ecosystem
    investors               - Investor profiles and mandates
    introductions           - Connections between investors and projects
    data_rooms              - Secure document repositories for projects
    data_room_documents     - Individual files within a data room
    deal_rooms              - Collaborative deal negotiation spaces
    deal_room_messages      - Messages within a deal room
    analytics_events        - Platform usage and engagement tracking
    project_events          - Timeline events for infrastructure projects
    verifications           - User identity and accreditation verification
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    """Generate a new UUID string (compatible with both SQLite and PostgreSQL)."""
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
    role            = Column(String, default="analyst")  # viewer | analyst | admin
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
    """
    Core knowledge base for Africa infrastructure projects.
    Data sourced from Airtable integration and AI Radar detection.
    """

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
    investors             = Column(Text, nullable=True)   # JSON array as text
    developers            = Column(Text, nullable=True)   # JSON array as text
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
    """Country-level infrastructure and investment profiles."""

    __tablename__ = "countries"

    id                      = Column(String, primary_key=True, default=_uuid)
    name                    = Column(String, unique=True, nullable=False, index=True)
    iso_code                = Column(String(3), nullable=True)
    region                  = Column(String, nullable=True)
    infrastructure_strategy = Column(Text, nullable=True)
    investment_priority     = Column(Text, nullable=True)
    logistics_corridors     = Column(Text, nullable=True)   # JSON array as text
    energy_capacity         = Column(String, nullable=True)
    key_contacts            = Column(Text, nullable=True)   # JSON array as text
    ai_brief                = Column(Text, nullable=True)
    ai_brief_generated_at   = Column(DateTime(timezone=True), nullable=True)
    created_at              = Column(DateTime(timezone=True), server_default=func.now())
    updated_at              = Column(DateTime(timezone=True), onupdate=func.now())


# ---------------------------------------------------------------------------
# Stakeholders
# ---------------------------------------------------------------------------


class Stakeholder(Base):
    """Key individuals in the Africa infrastructure ecosystem."""

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
    """Institutional investor profiles and mandates."""

    __tablename__ = "investors"

    id                    = Column(String, primary_key=True, default=_uuid)
    user_id               = Column(String, ForeignKey("users.id"), nullable=True)
    organisation_name     = Column(String, nullable=False)
    investor_type         = Column(String, nullable=True)
    aum_usd               = Column(String, nullable=True)
    focus_sectors         = Column(Text, nullable=True)   # JSON array as text
    focus_regions         = Column(Text, nullable=True)   # JSON array as text
    min_ticket_usd        = Column(String, nullable=True)
    max_ticket_usd        = Column(String, nullable=True)
    preferred_structures  = Column(Text, nullable=True)   # JSON array as text
    contact_name          = Column(String, nullable=True)
    contact_email         = Column(String, nullable=True)
    website               = Column(String, nullable=True)
    is_active             = Column(Boolean, default=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    introductions = relationship("Introduction", back_populates="investor")


# ---------------------------------------------------------------------------
# Introductions
# ---------------------------------------------------------------------------


class Introduction(Base):
    """
    Managed connections between investors and infrastructure projects.
    Tracks the lifecycle of investor engagement from interest to close.
    """

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
    """Secure document repositories for infrastructure projects."""

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
    """Individual files within a data room."""

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
    """Collaborative spaces for deal negotiation and due diligence."""

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
    """Messages and activity within a deal room."""

    __tablename__ = "deal_room_messages"

    id               = Column(String, primary_key=True, default=_uuid)
    deal_room_id     = Column(String, ForeignKey("deal_rooms.id"), nullable=False)
    user_id          = Column(String, ForeignKey("users.id"), nullable=True)
    message_type     = Column(String, default="text")
    content          = Column(Text, nullable=True)
    message_metadata = Column(Text, nullable=True)   # JSON as text
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    deal_room = relationship("DealRoom", back_populates="messages")


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


class AnalyticsEvent(Base):
    """Platform engagement and usage analytics."""

    __tablename__ = "analytics_events"

    id             = Column(String, primary_key=True, default=_uuid)
    user_id        = Column(String, ForeignKey("users.id"), nullable=True)
    event_type     = Column(String, nullable=False)
    entity_type    = Column(String, nullable=True)
    entity_id      = Column(String, nullable=True)
    event_metadata = Column(Text, nullable=True)   # JSON as text
    ip_hash        = Column(String, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="analytics")


# ---------------------------------------------------------------------------
# Project Events (Timeline)
# ---------------------------------------------------------------------------


class ProjectEvent(Base):
    """Timeline events for tracking infrastructure project milestones."""

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
    """User identity and accreditation verification records."""

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
# AIP v2 Extended Models
# ---------------------------------------------------------------------------

# AIP v2 extended models — PETFEL, EIN, Pipeline, IC, AI (PRD v2.0)
from backend.models_aip_v2 import (
    Organization,
    UserOrganization,
    Partner, PartnerProject,
    ProjectDetail, ProjectDocument,
    InvestorInterest,
    PipelineStage, ProjectPipeline, PipelineLog,
    InvestmentCommittee, ICVote,
    PetfelAssessment, PetfelScore, PetfelFlag,
    ExecutiveNote, EINSection,
    AiAnalysis, InvestorMatch,
)
