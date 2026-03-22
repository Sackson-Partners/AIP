"""
AIP Platform — Extended ORM Models (v2)
========================================
New tables for the full AIP deal lifecycle per the PRD v2.0 specification:

  Domain A+  — UserOrganization (user ↔ org membership)
  Domain B+  — ProjectDetail, ProjectDocument
  Domain C   — PipelineStage, ProjectPipeline, PipelineLog (immutable)
  Domain D   — Partner, PartnerProject
  Domain E+  — InvestorInterest
  Domain F   — InvestmentCommittee, ICVote
  Domain G   — PetfelAssessment, PetfelScore, PetfelFlag
  Domain H   — ExecutiveNote, EINSection
  Domain I   — AiAnalysis, InvestorMatch
  Orgs       — Organization

This module is imported at the BOTTOM of backend/models.py.
It uses models.Base so all tables share a single MetaData object.
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
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# Import Base and _uuid from models — defined before this import runs
from backend.models import Base, _uuid


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


class Organization(Base):
    """
    Legal entities operating in the AIP ecosystem.
    type: government | investor | sponsor | epc | operator | advisor | dfi | internal
    """
    __tablename__ = "organizations"

    id         = Column(String, primary_key=True, default=_uuid)
    name       = Column(String, nullable=False)
    type       = Column(String, nullable=False)
    country    = Column(String, nullable=True)
    website    = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    partners      = relationship("Partner", back_populates="organization")
    memberships   = relationship("UserOrganization", back_populates="organization")


# ---------------------------------------------------------------------------
# Domain A+ — UserOrganization
# ---------------------------------------------------------------------------


class UserOrganization(Base):
    """Links users to their organizations with a role context."""
    __tablename__ = "user_organizations"

    id              = Column(String, primary_key=True, default=_uuid)
    user_id         = Column(String, ForeignKey("users.id"), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    role_in_org     = Column(String, nullable=True)  # lead | member | observer
    joined_at       = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="memberships")
    __table_args__ = (UniqueConstraint("user_id", "organization_id", name="uq_user_org"),)


# ---------------------------------------------------------------------------
# Domain B+ — ProjectDetail & ProjectDocument
# ---------------------------------------------------------------------------


class ProjectDetail(Base):
    """
    Financial and operational detail extending infrastructure_projects (1-to-1).
    stage:   L1 (concept) | L2 (pre-feasibility) | L3 (feasibility) | L4 (bankable)
    verification_level: V0 (unverified) → V5 (fully verified)
    project_status: submitted | screening | diligence | ic | approved | rejected | on_hold
    """
    __tablename__ = "project_details"

    id                  = Column(String, primary_key=True, default=_uuid)
    project_id          = Column(String, ForeignKey("infrastructure_projects.id"),
                                 unique=True, nullable=False)
    stage               = Column(String, default="L1")
    verification_level  = Column(String, default="V0")
    ppp_model           = Column(String, nullable=True)
    # PPP | IPP | EPC+F | BOT | DBFOM | JV_SPV
    revenue_model       = Column(String, nullable=True)
    # tariff | availability_payment | offtake | user_fees
    capex_usd           = Column(Numeric(20, 2), nullable=True)
    funding_need_usd    = Column(Numeric(20, 2), nullable=True)
    expected_irr        = Column(Numeric(6, 2), nullable=True)
    ticket_size_usd     = Column(Numeric(20, 2), nullable=True)
    currency            = Column(String(3), default="USD")
    offtaker            = Column(String, nullable=True)
    timeline_months     = Column(Integer, nullable=True)
    construction_months = Column(Integer, nullable=True)
    jobs_created        = Column(Integer, nullable=True)
    local_content_pct   = Column(Numeric(5, 2), nullable=True)
    project_status      = Column(String, default="submitted")
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())


class ProjectDocument(Base):
    """
    Project documents stored in Azure Blob Storage (private containers).
    blob_path: /projects/{project_id}/documents/{document_type}/{file_id}
    document_type: pis | feasibility | financial_model | eia | permit | legal | offtake_term | other
    """
    __tablename__ = "project_documents"

    id            = Column(String, primary_key=True, default=_uuid)
    project_id    = Column(String, ForeignKey("infrastructure_projects.id",
                                               ondelete="CASCADE"), nullable=False)
    file_name     = Column(String, nullable=False)
    blob_path     = Column(String, nullable=False)   # Azure Blob path (private container)
    document_type = Column(String, nullable=True)    # see docstring
    file_size_kb  = Column(Integer, nullable=True)
    content_type  = Column(String, nullable=True)    # MIME type
    uploaded_by   = Column(String, ForeignKey("users.id"), nullable=True)
    uploaded_at   = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Domain D — Partners / Sponsors / EPCs
# ---------------------------------------------------------------------------


class Partner(Base):
    """Project originators, sponsors, EPCs, and operators."""
    __tablename__ = "partners"

    id              = Column(String, primary_key=True, default=_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    name            = Column(String, nullable=False)
    partner_type    = Column(String, nullable=True)
    # sponsor | epc | operator | developer
    country         = Column(String, nullable=True)
    contact_name    = Column(String, nullable=True)
    contact_email   = Column(String, nullable=True)
    track_record    = Column(Text, nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    organization = relationship("Organization", back_populates="partners")
    projects     = relationship("PartnerProject", back_populates="partner")


class PartnerProject(Base):
    """M2M link between partners and projects."""
    __tablename__ = "partner_projects"

    id         = Column(String, primary_key=True, default=_uuid)
    partner_id = Column(String, ForeignKey("partners.id"), nullable=False)
    project_id = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    role       = Column(String, nullable=True)
    # lead_developer | co-developer | epc | o_and_m
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    partner = relationship("Partner", back_populates="projects")


# ---------------------------------------------------------------------------
# Domain E+ — InvestorInterest
# ---------------------------------------------------------------------------


class InvestorInterest(Base):
    """
    Tracks formal investor interest in a specific project.
    status: new | reviewing | interested | passed | engaged
    """
    __tablename__ = "investor_interests"

    id              = Column(String, primary_key=True, default=_uuid)
    investor_id     = Column(String, ForeignKey("investors.id"), nullable=False)
    project_id      = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    status          = Column(String, default="new")
    interest_level  = Column(Integer, nullable=True)   # 1–5
    notes           = Column(Text, nullable=True)
    contacted_date  = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("investor_id", "project_id", name="uq_investor_project_interest"),
    )


# ---------------------------------------------------------------------------
# Domain C — Pipeline
# ---------------------------------------------------------------------------


class PipelineStage(Base):
    """Static lookup — seeded once at startup."""
    __tablename__ = "pipeline_stages"

    id          = Column(String, primary_key=True, default=_uuid)
    name        = Column(String, nullable=False)
    code        = Column(String, unique=True, nullable=False)
    order_index = Column(Integer, nullable=False)
    sla_days    = Column(Integer, nullable=True)


class ProjectPipeline(Base):
    """Current pipeline position for a project."""
    __tablename__ = "project_pipeline"

    id              = Column(String, primary_key=True, default=_uuid)
    project_id      = Column(String, ForeignKey("infrastructure_projects.id"),
                             unique=True, nullable=False)
    stage_code      = Column(String, ForeignKey("pipeline_stages.code"), nullable=False)
    entered_at      = Column(DateTime(timezone=True), server_default=func.now())
    sla_due_at      = Column(DateTime(timezone=True), nullable=True)
    is_sla_breached = Column(Boolean, default=False)


class PipelineLog(Base):
    """
    Immutable audit trail of every pipeline stage movement.
    INSERT-ONLY — no UPDATE or DELETE permitted on this table.
    Required for investor-grade and regulatory auditability.
    """
    __tablename__ = "pipeline_logs"

    id         = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    from_stage = Column(String, nullable=True)
    to_stage   = Column(String, nullable=False)
    changed_by = Column(String, ForeignKey("users.id"), nullable=True)
    timestamp  = Column(DateTime(timezone=True), server_default=func.now())
    notes      = Column(Text, nullable=True)


# ---------------------------------------------------------------------------
# Domain F — IC Governance
# ---------------------------------------------------------------------------


class InvestmentCommittee(Base):
    """Scheduled IC session for a specific project."""
    __tablename__ = "investment_committees"

    id              = Column(String, primary_key=True, default=_uuid)
    project_id      = Column(String, ForeignKey("infrastructure_projects.id"),
                             nullable=False)
    ein_id          = Column(String, ForeignKey("executive_notes.id"), nullable=True)
    scheduled_date  = Column(DateTime(timezone=True), nullable=True)
    status          = Column(String, default="scheduled")
    # scheduled | in_progress | decided | deferred | cancelled
    quorum_required = Column(Integer, default=3)
    outcome         = Column(String, nullable=True)
    # approved | rejected | deferred
    outcome_notes   = Column(Text, nullable=True)
    created_by      = Column(String, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    votes = relationship("ICVote", back_populates="committee",
                         cascade="all, delete-orphan")


class ICVote(Base):
    """Individual IC member vote on a project (immutable once cast)."""
    __tablename__ = "ic_votes"

    id           = Column(String, primary_key=True, default=_uuid)
    committee_id = Column(String, ForeignKey("investment_committees.id",
                                              ondelete="CASCADE"), nullable=False)
    voter_id     = Column(String, ForeignKey("users.id"), nullable=False)
    vote         = Column(String, nullable=False)
    # approve | reject | abstain | defer
    rationale    = Column(Text, nullable=True)
    conditions   = Column(Text, nullable=True)
    voted_at     = Column(DateTime(timezone=True), server_default=func.now())

    committee = relationship("InvestmentCommittee", back_populates="votes")

    __table_args__ = (
        UniqueConstraint("committee_id", "voter_id", name="uq_ic_vote_per_member"),
    )


# ---------------------------------------------------------------------------
# Domain G — PETFEL Due Diligence Engine
# ---------------------------------------------------------------------------


class PetfelAssessment(Base):
    """
    Top-level PETFEL assessment record.
    Each project can have multiple versioned assessments.
    rating:       A | B | C | D
    gating_result: GO | HOLD | NO_GO
    """
    __tablename__ = "petfel_assessments"

    id               = Column(String, primary_key=True, default=_uuid)
    project_id       = Column(String, ForeignKey("infrastructure_projects.id"),
                              nullable=False)
    version          = Column(Integer, default=1)
    status           = Column(String, default="draft")
    # draft | submitted | reviewed | approved
    assessed_by      = Column(String, ForeignKey("users.id"), nullable=True)
    assessed_at      = Column(DateTime(timezone=True), server_default=func.now())
    overall_score    = Column(Numeric(5, 2), nullable=True)   # 0–100
    rating           = Column(String, nullable=True)           # A | B | C | D
    gating_result    = Column(String, nullable=True)           # GO | HOLD | NO_GO
    recommendation   = Column(Text, nullable=True)
    notes            = Column(Text, nullable=True)
    ai_augmented     = Column(Boolean, default=False)
    ai_augmented_at  = Column(DateTime(timezone=True), nullable=True)

    scores = relationship("PetfelScore", back_populates="assessment",
                          cascade="all, delete-orphan")
    flags  = relationship("PetfelFlag",  back_populates="assessment",
                          cascade="all, delete-orphan")


class PetfelScore(Base):
    """
    One row per sub-criterion per assessment (30 rows per complete assessment).
    score: 1 (critical risk) – 5 (best practice)
    """
    __tablename__ = "petfel_scores"

    id             = Column(String, primary_key=True, default=_uuid)
    assessment_id  = Column(String, ForeignKey("petfel_assessments.id",
                                                ondelete="CASCADE"), nullable=False)
    pillar         = Column(String, nullable=False)
    # political | economic | technical | financial | environmental | legal
    sub_criterion  = Column(String, nullable=False)
    score          = Column(Integer, nullable=True)    # 1–5
    sub_weight     = Column(Numeric(4, 2), nullable=True)
    weighted_score = Column(Numeric(6, 4), nullable=True)
    evidence_notes = Column(Text, nullable=True)
    mitigation     = Column(Text, nullable=True)
    owner          = Column(String, nullable=True)

    assessment = relationship("PetfelAssessment", back_populates="scores")


class PetfelFlag(Base):
    """Red flags surfaced during PETFEL scoring (scores 1–2 or gating triggers)."""
    __tablename__ = "petfel_flags"

    id            = Column(String, primary_key=True, default=_uuid)
    assessment_id = Column(String, ForeignKey("petfel_assessments.id"), nullable=False)
    flag_type     = Column(String, nullable=True)
    # land_unresolved | no_legal_mandate | no_offtake | eia_resettlement | pillar_low
    pillar        = Column(String, nullable=True)
    description   = Column(Text, nullable=False)
    is_resolved   = Column(Boolean, default=False)
    resolved_by   = Column(String, ForeignKey("users.id"), nullable=True)
    resolved_at   = Column(DateTime(timezone=True), nullable=True)

    assessment = relationship("PetfelAssessment", back_populates="flags")


# ---------------------------------------------------------------------------
# Domain H — Executive Investment Notes (EIN)
# ---------------------------------------------------------------------------


class ExecutiveNote(Base):
    """
    EIN header — one per project (versioned on material update).
    status: draft | in_review | approved | sent
    recommendation: go | hold | no_go
    """
    __tablename__ = "executive_notes"

    id                = Column(String, primary_key=True, default=_uuid)
    project_id        = Column(String, ForeignKey("infrastructure_projects.id"),
                               nullable=False)
    title             = Column(String, nullable=True)
    # auto: {Project Name} — EIN v{version}
    version           = Column(Integer, default=1)
    status            = Column(String, default="draft")
    author_id         = Column(String, ForeignKey("users.id"), nullable=True)
    recommendation    = Column(String, nullable=True)   # go | hold | no_go
    executive_summary = Column(Text, nullable=True)
    key_gaps          = Column(Text, nullable=True)
    next_steps        = Column(Text, nullable=True)
    petfel_score      = Column(Numeric(5, 2), nullable=True)
    red_flags_count   = Column(Integer, default=0)
    export_ready      = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())

    sections = relationship("EINSection", back_populates="ein",
                            cascade="all, delete-orphan",
                            order_by="EINSection.section_code")


class EINSection(Base):
    """
    One row per EIN section (9 sections per EIN, codes 0–8).
    section_code: 0=Cover, 1=Strategy, 2=Political, 3=Economic,
                  4=Financial, 5=Legal, 6=Risk Register, 7=Next Steps, 8=Annexes
    generated_by: ai | analyst | hybrid
    """
    __tablename__ = "ein_sections"

    id           = Column(String, primary_key=True, default=_uuid)
    ein_id       = Column(String, ForeignKey("executive_notes.id",
                                              ondelete="CASCADE"), nullable=False)
    section_code = Column(Integer, nullable=False)
    section_name = Column(String, nullable=True)
    content      = Column(Text, nullable=True)      # Markdown narrative
    generated_by = Column(String, nullable=True)    # ai | analyst | hybrid
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    ein = relationship("ExecutiveNote", back_populates="sections")


# ---------------------------------------------------------------------------
# Domain I — AI Intelligence Layer
# ---------------------------------------------------------------------------


class AiAnalysis(Base):
    """
    Stores every AI-generated analysis output.
    analysis_type: full | country_risk | sector | petfel_augment | ein_draft | radar_signal
    raw_response: full raw JSON from Claude API (stored as Text for SQLite compat)
    """
    __tablename__ = "ai_analyses"

    id                = Column(String, primary_key=True, default=_uuid)
    project_id        = Column(String, ForeignKey("infrastructure_projects.id"),
                               nullable=True)
    analysis_type     = Column(String, nullable=False)
    entity_type       = Column(String, nullable=True)   # project | country | sector | platform
    entity_id         = Column(String, nullable=True)
    content           = Column(Text, nullable=True)
    model_version     = Column(String, nullable=True)
    raw_response      = Column(Text, nullable=True)     # JSON stored as text (JSONB in PostgreSQL)
    prompt_tokens     = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    generated_at      = Column(DateTime(timezone=True), server_default=func.now())


class InvestorMatch(Base):
    """
    Investor matching scores for a project.
    Factors: sector(30%) + geography(25%) + ticket(20%) + risk(15%) + affinity(10%)
    status: suggested | contacted | engaged | closed
    """
    __tablename__ = "investor_matches"

    id              = Column(String, primary_key=True, default=_uuid)
    project_id      = Column(String, ForeignKey("infrastructure_projects.id"),
                             nullable=False)
    investor_id     = Column(String, ForeignKey("investors.id"), nullable=False)
    match_score     = Column(Numeric(5, 2), nullable=True)    # 0–100
    sector_score    = Column(Numeric(5, 2), nullable=True)
    geography_score = Column(Numeric(5, 2), nullable=True)
    ticket_score    = Column(Numeric(5, 2), nullable=True)
    risk_score      = Column(Numeric(5, 2), nullable=True)
    affinity_score  = Column(Numeric(5, 2), nullable=True)
    status          = Column(String, default="suggested")
    run_at          = Column(DateTime(timezone=True), server_default=func.now())
    notes           = Column(Text, nullable=True)
