"""
AIP Platform — Extended ORM Models (v2)
========================================
New tables for the full AIP deal lifecycle:
  - Organization / Partner ecosystem
  - Pipeline stages & immutable audit trail
  - PETFEL DD Engine (assessments, scores, flags)
  - Executive Investment Notes (EIN) with 9 sections
  - IC Governance (committees, votes)
  - AI Intelligence (analyses, partner matches)

Append-only import: imported by models.py via  ``from backend.models_aip_v2 import *``
All existing tables remain unchanged.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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

from backend.models import Base, _uuid


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


class Organization(Base):
    """
    Entities operating in the AIP ecosystem:
    government | investor | sponsor | epc | operator | advisor | dfi | internal
    """
    __tablename__ = "organizations"

    id          = Column(String, primary_key=True, default=_uuid)
    name        = Column(String, nullable=False)
    type        = Column(String, nullable=False)   # see docstring
    country     = Column(String, nullable=True)
    website     = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    partners    = relationship("Partner", back_populates="organization")


# ---------------------------------------------------------------------------
# Partners / Sponsors / EPCs
# ---------------------------------------------------------------------------


class Partner(Base):
    """Project originators, sponsors, EPCs, and operators."""
    __tablename__ = "partners"

    id              = Column(String, primary_key=True, default=_uuid)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    name            = Column(String, nullable=False)
    partner_type    = Column(String, nullable=True)  # sponsor | epc | operator | developer
    country         = Column(String, nullable=True)
    contact_name    = Column(String, nullable=True)
    contact_email   = Column(String, nullable=True)
    track_record    = Column(Text, nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    organization    = relationship("Organization", back_populates="partners")
    projects        = relationship("PartnerProject", back_populates="partner")


class PartnerProject(Base):
    """M2M link between partners and projects."""
    __tablename__ = "partner_projects"

    id          = Column(String, primary_key=True, default=_uuid)
    partner_id  = Column(String, ForeignKey("partners.id"), nullable=False)
    project_id  = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    role        = Column(String, nullable=True)  # lead_developer | co-developer | epc | o_and_m
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    partner     = relationship("Partner", back_populates="projects")


# ---------------------------------------------------------------------------
# Project Extended Details  (1-to-1 with infrastructure_projects)
# ---------------------------------------------------------------------------


class ProjectDetail(Base):
    """
    Financial and operational detail for a project —
    extends infrastructure_projects without altering the core table.
    """
    __tablename__ = "project_details"

    id                  = Column(String, primary_key=True, default=_uuid)
    project_id          = Column(String, ForeignKey("infrastructure_projects.id"),
                                 unique=True, nullable=False)
    stage               = Column(String, default="L1")   # L1 | L2 | L3 | L4
    verification_level  = Column(String, default="V0")   # V0 … V5
    ppp_model           = Column(String, nullable=True)  # PPP | IPP | EPC+F | BOT | DBFOM | JV_SPV
    revenue_model       = Column(String, nullable=True)  # tariff | AP | offtake | user_fees
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
    # submitted | screening | diligence | ic | approved | rejected | on_hold
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class PipelineStage(Base):
    """Static lookup table — seeded once."""
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
    INSERT-ONLY — no UPDATE or DELETE permitted.
    """
    __tablename__ = "pipeline_logs"

    id          = Column(String, primary_key=True, default=_uuid)
    project_id  = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    from_stage  = Column(String, nullable=True)
    to_stage    = Column(String, nullable=False)
    changed_by  = Column(String, ForeignKey("users.id"), nullable=True)
    timestamp   = Column(DateTime(timezone=True), server_default=func.now())
    notes       = Column(Text, nullable=True)


# ---------------------------------------------------------------------------
# PETFEL Due Diligence Engine
# ---------------------------------------------------------------------------


class PetfelAssessment(Base):
    """
    Top-level PETFEL assessment record.
    Each project can have multiple versioned assessments.
    """
    __tablename__ = "petfel_assessments"

    id              = Column(String, primary_key=True, default=_uuid)
    project_id      = Column(String, ForeignKey("infrastructure_projects.id"), nullable=False)
    version         = Column(Integer, default=1)
    status          = Column(String, default="draft")
    # draft | submitted | reviewed | approved
    assessed_by     = Column(String, ForeignKey("users.id"), nullable=True)
    assessed_at     = Column(DateTime(timezone=True), server_default=func.now())
    overall_score   = Column(Numeric(5, 2), nullable=True)  # 0–100
    rating          = Column(String, nullable=True)          # A | B | C | D
    gating_result   = Column(String, nullable=True)          # GO | HOLD | NO_GO
    recommendation  = Column(Text, nullable=True)
    notes           = Column(Text, nullable=True)
    ai_augmented    = Column(Boolean, default=False)
    ai_augmented_at = Column(DateTime(timezone=True), nullable=True)

    scores          = relationship("PetfelScore", back_populates="assessment",
                                   cascade="all, delete-orphan")
    flags           = relationship("PetfelFlag",  back_populates="assessment",
                                   cascade="all, delete-orphan")


class PetfelScore(Base):
    """
    Individual sub-criterion score within a PETFEL assessment.
    30 rows per assessment (5 sub-criteria × 6 pillars).
    """
    __tablename__ = "petfel_scores"

    id              = Column(String, primary_key=True, default=_uuid)
    assessment_id   = Column(String, ForeignKey("petfel_assessments.id",
                                                  ondelete="CASCADE"), nullable=False)
    pillar          = Column(String, nullable=False)
    # political | economic | technical | financial | environmental | legal
    sub_criterion   = Column(String, nullable=False)
    score           = Column(Integer, nullable=True)   # 1–5
    sub_weight      = Column(Numeric(4, 2), nullable=True)
    weighted_score  = Column(Numeric(6, 4), nullable=True)
    evidence_notes  = Column(Text, nullable=True)
    mitigation      = Column(Text, nullable=True)
    owner           = Column(String, nullable=True)

    assessment      = relationship("PetfelAssessment", back_populates="scores")


class PetfelFlag(Base):
    """Red flags surfaced during PETFEL scoring."""
    __tablename__ = "petfel_flags"

    id              = Column(String, primary_key=True, default=_uuid)
    assessment_id   = Column(String, ForeignKey("petfel_assessments.id"), nullable=False)
    flag_type       = Column(String, nullable=True)
    # land_unresolved | no_legal_mandate | no_offtake | eia_resettlement | pillar_low
    pillar          = Column(String, nullable=True)
    description     = Column(Text, nullable=False)
    is_resolved     = Column(Boolean, default=False)
    resolved_by     = Column(String, ForeignKey("users.id"), nullable=True)
    resolved_at     = Column(DateTime(timezone=True), nullable=True)

    assessment      = relationship("PetfelAssessment", back_populates="flags")


# ---------------------------------------------------------------------------
# Executive Investment Notes (EIN)
# ---------------------------------------------------------------------------


class ExecutiveNote(Base):
    """
    EIN header record — one per project (versioned on material update).
    """
    __tablename__ = "executive_notes"

    id                  = Column(String, primary_key=True, default=_uuid)
    project_id          = Column(String, ForeignKey("infrastructure_projects.id"),
                                 nullable=False)
    title               = Column(String, nullable=True)
    version             = Column(Integer, default=1)
    status              = Column(String, default="draft")
    # draft | in_review | approved | sent
    author_id           = Column(String, ForeignKey("users.id"), nullable=True)
    recommendation      = Column(String, nullable=True)  # go | hold | no_go
    executive_summary   = Column(Text, nullable=True)
    key_gaps            = Column(Text, nullable=True)
    next_steps          = Column(Text, nullable=True)
    petfel_score        = Column(Numeric(5, 2), nullable=True)
    red_flags_count     = Column(Integer, default=0)
    export_ready        = Column(Boolean, default=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    sections            = relationship("EINSection", back_populates="ein",
                                       cascade="all, delete-orphan",
                                       order_by="EINSection.section_code")


class EINSection(Base):
    """
    One row per section of an EIN (9 sections, codes 0–8).
    Content is Markdown narrative.
    """
    __tablename__ = "ein_sections"

    id              = Column(String, primary_key=True, default=_uuid)
    ein_id          = Column(String, ForeignKey("executive_notes.id",
                                                  ondelete="CASCADE"), nullable=False)
    section_code    = Column(Integer, nullable=False)
    # 0=Cover, 1=Strategy, 2=Political, 3=Economic,
    # 4=Financial, 5=Legal, 6=Risk Register, 7=Next Steps, 8=Annexes
    section_name    = Column(String, nullable=True)
    content         = Column(Text, nullable=True)
    generated_by    = Column(String, nullable=True)  # ai | analyst | hybrid
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    ein             = relationship("ExecutiveNote", back_populates="sections")


# ---------------------------------------------------------------------------
# Investment Committee (IC) Governance
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
    outcome         = Column(String, nullable=True)  # approved | rejected | deferred
    outcome_notes   = Column(Text, nullable=True)
    created_by      = Column(String, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    votes           = relationship("ICVote", back_populates="committee",
                                   cascade="all, delete-orphan")


class ICVote(Base):
    """Individual IC member vote on a project."""
    __tablename__ = "ic_votes"

    id              = Column(String, primary_key=True, default=_uuid)
    committee_id    = Column(String, ForeignKey("investment_committees.id",
                                                  ondelete="CASCADE"), nullable=False)
    voter_id        = Column(String, ForeignKey("users.id"), nullable=False)
    vote            = Column(String, nullable=False)  # approve | reject | abstain | defer
    rationale       = Column(Text, nullable=True)
    conditions      = Column(Text, nullable=True)
    voted_at        = Column(DateTime(timezone=True), server_default=func.now())

    committee       = relationship("InvestmentCommittee", back_populates="votes")
    UniqueConstraint("committee_id", "voter_id", name="uq_ic_vote_per_member")


# ---------------------------------------------------------------------------
# AI Intelligence Layer
# ---------------------------------------------------------------------------


class AiAnalysis(Base):
    """Stores every AI-generated analysis output for a project."""
    __tablename__ = "ai_analyses"

    id              = Column(String, primary_key=True, default=_uuid)
    project_id      = Column(String, ForeignKey("infrastructure_projects.id"),
                             nullable=True)
    analysis_type   = Column(String, nullable=False)
    # full | country_risk | sector | petfel_augment | ein_draft | radar_signal
    entity_type     = Column(String, nullable=True)   # project | country | sector
    entity_id       = Column(String, nullable=True)
    content         = Column(Text, nullable=True)
    model_version   = Column(String, nullable=True)
    prompt_tokens   = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    generated_at    = Column(DateTime(timezone=True), server_default=func.now())


class InvestorMatch(Base):
    """Investor matching scores for a project."""
    __tablename__ = "investor_matches"

    id              = Column(String, primary_key=True, default=_uuid)
    project_id      = Column(String, ForeignKey("infrastructure_projects.id"),
                             nullable=False)
    investor_id     = Column(String, ForeignKey("investors.id"), nullable=False)
    match_score     = Column(Numeric(5, 2), nullable=True)   # 0–100
    sector_score    = Column(Numeric(5, 2), nullable=True)
    geography_score = Column(Numeric(5, 2), nullable=True)
    ticket_score    = Column(Numeric(5, 2), nullable=True)
    risk_score      = Column(Numeric(5, 2), nullable=True)
    affinity_score  = Column(Numeric(5, 2), nullable=True)
    status          = Column(String, default="suggested")
    # suggested | contacted | engaged | closed
    run_at          = Column(DateTime(timezone=True), server_default=func.now())
    notes           = Column(Text, nullable=True)
