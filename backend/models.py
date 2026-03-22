# models.py
from sqlalchemy import Column, Integer, String, Float, Date, Enum as SQLEnum, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from backend.database import Base
from enum import Enum as PyEnum
import datetime


class Sector(PyEnum):
    ENERGY = "Energy"
    MINING = "Mining"
    WATER = "Water"
    TRANSPORT = "Transport"
    PORTS = "Ports"
    RAIL = "Rail"
    ROADS = "Roads"
    AGRICULTURE = "Agriculture"
    HEALTH = "Health"


class ProjectStage(PyEnum):
    CONCEPT = "Concept"
    FEASIBILITY = "Feasibility"
    PROCUREMENT = "Procurement"
    CONSTRUCTION = "Construction"
    OPERATION = "Operation"


class VerificationLevel(PyEnum):
    V0_SUBMITTED = "V0: Submitted"
    V1_SPONSOR_VERIFIED = "V1: Sponsor Identity Verified"
    V2_DOCUMENTS_VERIFIED = "V2: Documents Verified"
    V3_BANKABILITY_SCREENED = "V3: Bankability Screened"


class Instrument(PyEnum):
    EQUITY = "Equity"
    DEBT = "Debt"
    MEZZANINE = "Mezzanine"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String, index=True)
    sector = Column(SQLEnum(Sector))
    country = Column(String)
    region = Column(String, nullable=True)
    gps_location = Column(String, nullable=True)
    stage = Column(SQLEnum(ProjectStage))
    estimated_capex = Column(Float)
    funding_gap = Column(Float, nullable=True)
    timeline_fid = Column(Date, nullable=True)
    timeline_cod = Column(Date, nullable=True)
    revenue_model = Column(String)
    offtaker = Column(String, nullable=True)
    tariff_mechanism = Column(String, nullable=True)
    concession_length = Column(Integer, nullable=True)
    fx_exposure = Column(String, nullable=True)
    political_risk_mitigation = Column(String, nullable=True)
    sovereign_support = Column(String, nullable=True)
    technology = Column(String, nullable=True)
    epc_status = Column(String, nullable=True)
    land_acquisition_status = Column(String, nullable=True)
    esg_category = Column(String, nullable=True)
    permits_status = Column(String, nullable=True)
    attachments = Column(String, nullable=True)
    created_at = Column(Date, default=datetime.date.today)
    updated_at = Column(Date, default=datetime.date.today)


class Verification(Base):
    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    level = Column(SQLEnum(VerificationLevel))
    technical_readiness = Column(Integer, nullable=True)
    financial_robustness = Column(Integer, nullable=True)
    legal_clarity = Column(Integer, nullable=True)
    esg_compliance = Column(Integer, nullable=True)
    overall_score = Column(Float, nullable=True)
    risk_flags = Column(String, nullable=True)
    last_verified = Column(Date)

    project = relationship("Project")


class Investor(Base):
    __tablename__ = "investors"

    id = Column(Integer, primary_key=True)
    fund_name = Column(String)
    aum = Column(Float, nullable=True)
    ticket_size_min = Column(Float)
    ticket_size_max = Column(Float)
    instruments = Column(String)
    target_irr = Column(Float, nullable=True)
    country_focus = Column(String)
    sector_focus = Column(String)
    esg_constraints = Column(String, nullable=True)


class Introduction(Base):
    __tablename__ = "introductions"

    id = Column(Integer, primary_key=True)
    investor_id = Column(Integer, ForeignKey("investors.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    message = Column(String, nullable=True)
    nda_executed = Column(Integer, default=0)
    sponsor_approved = Column(Integer, default=0)
    status = Column(String, default="Pending")

    investor = relationship("Investor")
    project = relationship("Project")


class DataRoom(Base):
    __tablename__ = "data_rooms"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    nda_required = Column(Boolean, default=True)
    access_users = Column(String, nullable=True)
    documents = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)

    project = relationship("Project")


class AnalyticReport(Base):
    __tablename__ = "analytic_reports"

    id = Column(Integer, primary_key=True)
    title = Column(String)
    sector = Column(SQLEnum(Sector), nullable=True)
    country = Column(String, nullable=True)
    content = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.now)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)
    event_date = Column(Date)
    type = Column(String)
    projects_involved = Column(String, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    is_phone_verified = Column(Boolean, default=False, nullable=False)
    status = Column(String(50), default='active', nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.now, nullable=False)


# ============================================================================
# DEAL ROOM MODELS
# ============================================================================

class DealRoomStatus(PyEnum):
    ACTIVE = "active"
    NEGOTIATING = "negotiating"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"
    ARCHIVED = "archived"


class DealRoomMemberRole(PyEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class DocumentType(PyEnum):
    MOU = "mou"
    TERM_SHEET = "term_sheet"
    CONTRACT = "contract"
    NDA = "nda"
    FINANCIAL = "financial"
    LEGAL = "legal"
    TECHNICAL = "technical"
    OTHER = "other"


class MeetingStatus(PyEnum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DealRoom(Base):
    """Main Deal Room entity for project negotiations"""
    __tablename__ = "deal_rooms"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    status = Column(SQLEnum(DealRoomStatus), default=DealRoomStatus.ACTIVE)

    # Deal details
    deal_value = Column(Float, nullable=True)  # Expected deal value in USD
    deal_currency = Column(String(10), default="USD")
    target_close_date = Column(Date, nullable=True)

    # Settings
    is_video_enabled = Column(Boolean, default=True)
    is_chat_enabled = Column(Boolean, default=True)
    require_nda = Column(Boolean, default=True)

    # Ownership
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    closed_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project")
    members = relationship("DealRoomMember", back_populates="deal_room")
    documents = relationship("DealRoomDocument", back_populates="deal_room")
    meetings = relationship("DealRoomMeeting", back_populates="deal_room")
    messages = relationship("DealRoomMessage", back_populates="deal_room")


class DealRoomMember(Base):
    """Members/Collaborators in a Deal Room"""
    __tablename__ = "deal_room_members"

    id = Column(Integer, primary_key=True)
    deal_room_id = Column(Integer, ForeignKey("deal_rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(SQLEnum(DealRoomMemberRole), default=DealRoomMemberRole.MEMBER)

    # Invitation details
    invited_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    invited_email = Column(String(255), nullable=True)  # For pending invitations
    invitation_status = Column(String(50), default="accepted")  # pending, accepted, declined

    # Access control
    can_upload = Column(Boolean, default=True)
    can_delete = Column(Boolean, default=False)
    can_invite = Column(Boolean, default=False)
    can_edit_documents = Column(Boolean, default=True)

    # NDA status
    nda_signed = Column(Boolean, default=False)
    nda_signed_at = Column(DateTime, nullable=True)

    # Activity tracking
    last_accessed_at = Column(DateTime, nullable=True)
    access_count = Column(Integer, default=0)

    # Timestamps
    joined_at = Column(DateTime, default=datetime.datetime.now)
    access_expires_at = Column(DateTime, nullable=True)

    # Relationships
    deal_room = relationship("DealRoom", back_populates="members")


class DealRoomDocument(Base):
    """Documents in a Deal Room (MoU, Term Sheets, Contracts, etc.)"""
    __tablename__ = "deal_room_documents"

    id = Column(Integer, primary_key=True)
    deal_room_id = Column(Integer, ForeignKey("deal_rooms.id"), nullable=False)

    # Document info
    title = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    document_type = Column(SQLEnum(DocumentType), default=DocumentType.OTHER)

    # File details
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)  # in bytes
    mime_type = Column(String(100), nullable=True)

    # Versioning
    version = Column(Integer, default=1)
    parent_document_id = Column(Integer, ForeignKey("deal_room_documents.id"), nullable=True)
    is_latest = Column(Boolean, default=True)

    # Signature tracking
    requires_signature = Column(Boolean, default=False)
    signature_status = Column(String(50), default="none")  # none, pending, partial, completed
    signed_by = Column(String, nullable=True)  # JSON list of user IDs who signed

    # Metadata
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    # Relationships
    deal_room = relationship("DealRoom", back_populates="documents")


class DealRoomMeeting(Base):
    """Video meetings/calls in a Deal Room"""
    __tablename__ = "deal_room_meetings"

    id = Column(Integer, primary_key=True)
    deal_room_id = Column(Integer, ForeignKey("deal_rooms.id"), nullable=False)

    # Meeting info
    title = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    agenda = Column(String, nullable=True)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=60)
    timezone = Column(String(50), default="UTC")

    # Video conference details
    meeting_url = Column(String(500), nullable=True)
    meeting_id = Column(String(100), nullable=True)  # External provider ID
    meeting_password = Column(String(50), nullable=True)
    provider = Column(String(50), default="daily")  # daily, zoom, teams

    # Recording
    is_recorded = Column(Boolean, default=False)
    recording_url = Column(String(500), nullable=True)
    recording_duration = Column(Integer, nullable=True)  # in seconds

    # Status
    status = Column(SQLEnum(MeetingStatus), default=MeetingStatus.SCHEDULED)

    # Participants
    invited_members = Column(String, nullable=True)  # JSON list of member IDs
    attended_members = Column(String, nullable=True)  # JSON list of member IDs who attended

    # Ownership
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    deal_room = relationship("DealRoom", back_populates="meetings")


class DealRoomMessage(Base):
    """Chat messages in a Deal Room"""
    __tablename__ = "deal_room_messages"

    id = Column(Integer, primary_key=True)
    deal_room_id = Column(Integer, ForeignKey("deal_rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Message content
    message = Column(String, nullable=False)
    message_type = Column(String(50), default="text")  # text, file, system

    # Threading
    parent_id = Column(Integer, ForeignKey("deal_room_messages.id"), nullable=True)

    # Attachments
    attachments = Column(String, nullable=True)  # JSON list of file URLs

    # Status
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)

    # Read receipts
    read_by = Column(String, nullable=True)  # JSON list of user IDs

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    # Relationships
    deal_room = relationship("DealRoom", back_populates="messages")


# ============================================================================
# VERIFICATION SYSTEM MODELS (V0-V3 with FP/LP workflows)
# ============================================================================

class VerificationStatus(PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVISION = "needs_revision"


class VerifierType(PyEnum):
    FUND_PREPARER = "fund_preparer"  # FP
    LEAD_PARTNER = "lead_partner"    # LP
    SYSTEM = "system"
    EXTERNAL = "external"


class VerificationRequest(Base):
    """Verification requests for projects (V0-V3 workflow)"""
    __tablename__ = "verification_requests"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # Verification level being requested
    requested_level = Column(SQLEnum(VerificationLevel), nullable=False)
    current_level = Column(SQLEnum(VerificationLevel), nullable=True)

    # Status tracking
    status = Column(SQLEnum(VerificationStatus), default=VerificationStatus.PENDING)

    # Assignees
    fund_preparer_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # FP
    lead_partner_id = Column(Integer, ForeignKey("users.id"), nullable=True)   # LP

    # Workflow tracking
    fp_review_status = Column(String(50), nullable=True)  # pending, approved, rejected
    fp_review_date = Column(DateTime, nullable=True)
    fp_review_notes = Column(String, nullable=True)

    lp_review_status = Column(String(50), nullable=True)
    lp_review_date = Column(DateTime, nullable=True)
    lp_review_notes = Column(String, nullable=True)

    # Scores (V3 bankability screening)
    technical_score = Column(Integer, nullable=True)  # 0-100
    financial_score = Column(Integer, nullable=True)
    legal_score = Column(Integer, nullable=True)
    esg_score = Column(Integer, nullable=True)
    overall_score = Column(Float, nullable=True)

    # Risk assessment
    risk_flags = Column(String, nullable=True)  # JSON array of risk flags
    risk_level = Column(String(20), nullable=True)  # low, medium, high, critical

    # Documentation
    required_documents = Column(String, nullable=True)  # JSON array
    submitted_documents = Column(String, nullable=True)  # JSON array of document IDs
    missing_documents = Column(String, nullable=True)  # JSON array

    # Blockchain verification
    blockchain_hash = Column(String(66), nullable=True)
    blockchain_tx = Column(String(66), nullable=True)
    blockchain_verified_at = Column(DateTime, nullable=True)

    # Metadata
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project")


class VerificationDocument(Base):
    """Documents submitted for verification"""
    __tablename__ = "verification_documents"

    id = Column(Integer, primary_key=True)
    verification_request_id = Column(Integer, ForeignKey("verification_requests.id"), nullable=False)

    # Document info
    document_name = Column(String(255), nullable=False)
    document_type = Column(String(100), nullable=False)  # identity, financial, legal, technical, etc.
    description = Column(String, nullable=True)

    # File details
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)

    # Verification status
    status = Column(String(50), default="pending")  # pending, verified, rejected
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(String, nullable=True)

    # Blockchain hash
    document_hash = Column(String(64), nullable=True)
    blockchain_verified = Column(Boolean, default=False)

    # AI analysis
    ai_analysis = Column(String, nullable=True)  # JSON with AI analysis results
    ai_risk_score = Column(Float, nullable=True)

    # Timestamps
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.now)

    # Relationships
    verification_request = relationship("VerificationRequest")


class VerificationHistory(Base):
    """Audit trail for verification activities"""
    __tablename__ = "verification_history"

    id = Column(Integer, primary_key=True)
    verification_request_id = Column(Integer, ForeignKey("verification_requests.id"), nullable=False)

    # Action details
    action = Column(String(100), nullable=False)  # created, submitted, reviewed, approved, rejected, etc.
    action_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_by_type = Column(SQLEnum(VerifierType), nullable=True)

    # Details
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    notes = Column(String, nullable=True)
    extra_data = Column(String, nullable=True)  # JSON for additional data

    # Timestamp
    created_at = Column(DateTime, default=datetime.datetime.now)


# ============================================================================
# ENHANCED DATA ROOM MODELS
# ============================================================================

class DataRoomAccessLevel(PyEnum):
    FULL = "full"
    LIMITED = "limited"
    VIEW_ONLY = "view_only"
    RESTRICTED = "restricted"


class NDAStatus(PyEnum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    SENT = "sent"
    SIGNED = "signed"
    EXPIRED = "expired"
    REVOKED = "revoked"


class DataRoomV2(Base):
    """Enhanced Data Room with comprehensive document management"""
    __tablename__ = "data_rooms_v2"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # Data room details
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)

    # Access control
    is_public = Column(Boolean, default=False)
    require_nda = Column(Boolean, default=True)
    require_verification = Column(Boolean, default=False)
    min_verification_level = Column(SQLEnum(VerificationLevel), nullable=True)

    # Watermarking
    enable_watermark = Column(Boolean, default=True)
    watermark_text = Column(String(255), nullable=True)

    # Download controls
    allow_download = Column(Boolean, default=False)
    allow_print = Column(Boolean, default=False)

    # Activity tracking
    enable_tracking = Column(Boolean, default=True)

    # Expiration
    access_expires_at = Column(DateTime, nullable=True)

    # Status
    status = Column(String(50), default="active")  # active, archived, suspended

    # Ownership
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    # Relationships
    project = relationship("Project")
    folders = relationship("DataRoomFolder", back_populates="data_room")
    access_grants = relationship("DataRoomAccess", back_populates="data_room")


class DataRoomFolder(Base):
    """Folder structure within data room"""
    __tablename__ = "data_room_folders"

    id = Column(Integer, primary_key=True)
    data_room_id = Column(Integer, ForeignKey("data_rooms_v2.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("data_room_folders.id"), nullable=True)

    # Folder info
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    order = Column(Integer, default=0)

    # Access control (can override data room settings)
    access_level = Column(SQLEnum(DataRoomAccessLevel), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    # Relationships
    data_room = relationship("DataRoomV2", back_populates="folders")
    documents = relationship("DataRoomDocumentV2", back_populates="folder")


class DataRoomDocumentV2(Base):
    """Documents within enhanced data room"""
    __tablename__ = "data_room_documents_v2"

    id = Column(Integer, primary_key=True)
    data_room_id = Column(Integer, ForeignKey("data_rooms_v2.id"), nullable=False)
    folder_id = Column(Integer, ForeignKey("data_room_folders.id"), nullable=True)

    # Document info
    title = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    document_category = Column(String(100), nullable=True)  # financial, legal, technical, etc.

    # File details
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    page_count = Column(Integer, nullable=True)

    # Versioning
    version = Column(Integer, default=1)
    is_latest = Column(Boolean, default=True)

    # Security
    document_hash = Column(String(64), nullable=True)
    is_confidential = Column(Boolean, default=False)

    # Blockchain verification
    blockchain_hash = Column(String(66), nullable=True)
    blockchain_tx = Column(String(66), nullable=True)
    blockchain_verified_at = Column(DateTime, nullable=True)

    # AI analysis
    ai_summary = Column(String, nullable=True)
    ai_key_terms = Column(String, nullable=True)  # JSON
    ai_risk_analysis = Column(String, nullable=True)  # JSON

    # Statistics
    view_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)

    # Metadata
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    # Relationships
    folder = relationship("DataRoomFolder", back_populates="documents")


class DataRoomAccess(Base):
    """Access grants and NDA tracking for data room"""
    __tablename__ = "data_room_access"

    id = Column(Integer, primary_key=True)
    data_room_id = Column(Integer, ForeignKey("data_rooms_v2.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Access level
    access_level = Column(SQLEnum(DataRoomAccessLevel), default=DataRoomAccessLevel.VIEW_ONLY)

    # NDA tracking
    nda_status = Column(SQLEnum(NDAStatus), default=NDAStatus.PENDING)
    nda_document_id = Column(Integer, nullable=True)  # Reference to NDA document
    nda_sent_at = Column(DateTime, nullable=True)
    nda_signed_at = Column(DateTime, nullable=True)
    nda_expires_at = Column(DateTime, nullable=True)
    nda_ip_address = Column(String(45), nullable=True)  # IP when NDA was signed

    # Access control
    granted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    access_granted_at = Column(DateTime, default=datetime.datetime.now)
    access_expires_at = Column(DateTime, nullable=True)
    access_revoked_at = Column(DateTime, nullable=True)
    revoke_reason = Column(String, nullable=True)

    # Folder-specific access (JSON array of folder IDs)
    allowed_folders = Column(String, nullable=True)

    # Activity tracking
    last_accessed_at = Column(DateTime, nullable=True)
    total_views = Column(Integer, default=0)
    total_downloads = Column(Integer, default=0)
    total_time_seconds = Column(Integer, default=0)

    # Relationships
    data_room = relationship("DataRoomV2", back_populates="access_grants")


class DataRoomActivity(Base):
    """Activity log for data room access"""
    __tablename__ = "data_room_activity"

    id = Column(Integer, primary_key=True)
    data_room_id = Column(Integer, ForeignKey("data_rooms_v2.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("data_room_documents_v2.id"), nullable=True)

    # Activity details
    action = Column(String(50), nullable=False)  # view, download, print, search, etc.
    details = Column(String, nullable=True)  # JSON with additional details

    # Session info
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    session_id = Column(String(100), nullable=True)

    # Duration (for view actions)
    duration_seconds = Column(Integer, nullable=True)
    pages_viewed = Column(String, nullable=True)  # JSON array of page numbers

    # Timestamp
    created_at = Column(DateTime, default=datetime.datetime.now)


# ============================================================================
# BLOCKCHAIN VERIFICATION MODELS
# ============================================================================

class BlockchainCertificate(Base):
    """Blockchain verification certificates"""
    __tablename__ = "blockchain_certificates"

    id = Column(Integer, primary_key=True)

    # Certificate info
    certificate_id = Column(String(100), unique=True, nullable=False)
    certificate_type = Column(String(50), nullable=False)  # document, verification, identity

    # Document reference
    document_type = Column(String(50), nullable=True)  # which type of document
    document_id = Column(Integer, nullable=True)  # ID in respective table

    # Hash details
    document_hash = Column(String(64), nullable=False)
    metadata_hash = Column(String(64), nullable=True)

    # Blockchain details
    network = Column(String(50), nullable=False)  # polygon-mainnet, polygon-mumbai
    transaction_hash = Column(String(66), nullable=False)
    block_number = Column(Integer, nullable=False)
    contract_address = Column(String(42), nullable=True)
    issuer_address = Column(String(42), nullable=True)

    # Verification URLs
    explorer_url = Column(String(500), nullable=True)
    verification_url = Column(String(500), nullable=True)

    # Certificate metadata
    cert_metadata = Column(String, nullable=True)  # JSON

    # Status
    status = Column(String(50), default="active")  # active, revoked, expired
    revoked_at = Column(DateTime, nullable=True)
    revoke_reason = Column(String, nullable=True)

    # Ownership
    issued_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    issued_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    issued_at = Column(DateTime, default=datetime.datetime.now)
    expires_at = Column(DateTime, nullable=True)


class AIAnalysisResult(Base):
    """Store AI analysis results for documents"""
    __tablename__ = "ai_analysis_results"

    id = Column(Integer, primary_key=True)

    # Document reference
    document_type = Column(String(50), nullable=False)  # data_room, deal_room, verification
    document_id = Column(Integer, nullable=False)

    # Analysis details
    analysis_type = Column(String(50), nullable=False)  # summary, risk, compliance, due_diligence
    provider = Column(String(50), nullable=False)  # openai, anthropic
    model = Column(String(100), nullable=False)

    # Results
    result = Column(String, nullable=False)  # JSON with analysis results
    confidence_score = Column(Float, nullable=True)

    # Usage
    tokens_used = Column(Integer, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)

    # Status
    status = Column(String(50), default="completed")  # pending, completed, failed
    error_message = Column(String, nullable=True)

    # Metadata
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)


# ============================================================================
# PETFEL DUE DILIGENCE ENGINE (PRD Section 6)
# ============================================================================

class PillarType(PyEnum):
    """PETFEL pillars for due diligence assessment"""
    POLITICAL = "political"
    ECONOMIC = "economic"
    TECHNICAL = "technical"
    FINANCIAL = "financial"
    ENVIRONMENTAL = "environmental"
    LEGAL = "legal"


class PETFELRating(PyEnum):
    """PETFEL rating bands (PRD Section 6.5)"""
    A = "A"  # 80-100: GO - Investment Ready
    B = "B"  # 65-79: Near-Ready (GO with conditions)
    C = "C"  # 50-64: HOLD - Material Gaps
    D = "D"  # <50: NO-GO - Early Stage / High Risk


class AssessmentStatus(PyEnum):
    """PETFEL assessment workflow status"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    APPROVED = "approved"


class GatingResult(PyEnum):
    """PETFEL gating decision"""
    GO = "GO"
    HOLD = "HOLD"


class FlagType(PyEnum):
    """PETFEL red flag types (PRD Section 6.6)"""
    LAND_UNRESOLVED = "land_unresolved"
    NO_LEGAL_MANDATE = "no_legal_mandate"
    NO_OFFTAKE = "no_offtake"
    EIA_RESETTLEMENT = "eia_resettlement"
    PILLAR_LOW = "pillar_low"


class PETFELAssessment(Base):
    """PETFEL Due Diligence Assessment for a project"""
    __tablename__ = "petfel_assessments"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    version = Column(Integer, default=1)
    status = Column(SQLEnum(AssessmentStatus), default=AssessmentStatus.DRAFT)

    # Assessor info
    assessed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    assessed_at = Column(DateTime, default=datetime.datetime.now)

    # Overall results
    overall_score = Column(Float, nullable=True)  # 0-100
    rating = Column(SQLEnum(PETFELRating), nullable=True)
    gating_result = Column(SQLEnum(GatingResult), nullable=True)

    # Pillar scores (weighted: P=15%, E=15%, T=20%, F=20%, En=15%, L=15%)
    political_score = Column(Float, nullable=True)
    economic_score = Column(Float, nullable=True)
    technical_score = Column(Float, nullable=True)
    financial_score = Column(Float, nullable=True)
    environmental_score = Column(Float, nullable=True)
    legal_score = Column(Float, nullable=True)

    # Recommendation and notes
    recommendation = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    # AI augmentation
    ai_augmented = Column(Boolean, default=False)
    ai_model_version = Column(String(50), nullable=True)
    ai_confidence_score = Column(Float, nullable=True)
    last_analyzed_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    # Relationships
    project = relationship("Project")
    scores = relationship("PETFELScore", back_populates="assessment", cascade="all, delete-orphan")
    flags = relationship("PETFELFlag", back_populates="assessment", cascade="all, delete-orphan")


class PETFELScore(Base):
    """Individual sub-criteria scores for PETFEL assessment (30 total)"""
    __tablename__ = "petfel_scores"

    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("petfel_assessments.id"), nullable=False)

    # Criteria identification
    pillar = Column(SQLEnum(PillarType), nullable=False)
    sub_criterion = Column(String(255), nullable=False)

    # Scoring (1-5 scale per PRD Section 6.2)
    score = Column(Integer, nullable=True)  # 1=Critical, 2=High Risk, 3=Moderate, 4=Low Risk, 5=Best Practice
    sub_weight = Column(Float, default=0.20)  # Weight within pillar (5 criteria = 0.20 each)
    weighted_score = Column(Float, nullable=True)  # score * sub_weight

    # Evidence and mitigation
    evidence_notes = Column(String, nullable=True)
    mitigation = Column(String, nullable=True)
    owner = Column(String(255), nullable=True)

    # AI suggestions
    ai_suggested_score = Column(Integer, nullable=True)
    ai_rationale = Column(String, nullable=True)

    # Timestamps
    scored_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    # Relationships
    assessment = relationship("PETFELAssessment", back_populates="scores")


class PETFELFlag(Base):
    """Risk flags identified during PETFEL assessment"""
    __tablename__ = "petfel_flags"

    id = Column(Integer, primary_key=True)
    assessment_id = Column(Integer, ForeignKey("petfel_assessments.id"), nullable=False)

    # Flag details
    flag_type = Column(SQLEnum(FlagType), nullable=False)
    pillar = Column(String(50), nullable=True)
    description = Column(String, nullable=False)

    # Resolution tracking
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)

    # Relationships
    assessment = relationship("PETFELAssessment", back_populates="flags")


# ============================================================================
# EXECUTIVE INVESTMENT NOTE (EIN) - PRD Section 7
# ============================================================================

class EINStatus(PyEnum):
    """EIN workflow status"""
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    SENT = "sent"


class Recommendation(PyEnum):
    """EIN recommendation"""
    GO = "go"
    HOLD = "hold"
    NO_GO = "no_go"


class ExecutiveNote(Base):
    """Executive Investment Note (EIN) - 9 section investment memo"""
    __tablename__ = "executive_notes"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # EIN metadata
    title = Column(String(500), nullable=True)  # Auto: {Project Name} — EIN v{version}
    version = Column(Integer, default=1)
    status = Column(SQLEnum(EINStatus), default=EINStatus.DRAFT)

    # Author and reviewers
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Key content
    executive_summary = Column(String, nullable=True)
    recommendation = Column(SQLEnum(Recommendation), nullable=True)
    key_gaps = Column(String, nullable=True)
    next_steps = Column(String, nullable=True)

    # PETFEL linkage
    petfel_assessment_id = Column(Integer, ForeignKey("petfel_assessments.id"), nullable=True)
    petfel_score = Column(Float, nullable=True)  # Rollup from assessment
    red_flags_count = Column(Integer, default=0)

    # Export status
    export_ready = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    approved_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project")
    petfel_assessment = relationship("PETFELAssessment")
    sections = relationship("EINSection", back_populates="ein", cascade="all, delete-orphan")


class EINSection(Base):
    """Individual sections of an Executive Investment Note (9 sections per PRD 7.3)"""
    __tablename__ = "ein_sections"

    id = Column(Integer, primary_key=True)
    ein_id = Column(Integer, ForeignKey("executive_notes.id"), nullable=False)

    # Section identification (0-8 per PRD)
    section_code = Column(Integer, nullable=False)  # 0=Cover, 1=Strategy, 2=Political, etc.
    section_name = Column(String(255), nullable=False)

    # Content
    content = Column(String, nullable=True)  # Markdown narrative

    # Generation tracking
    generated_by = Column(String(50), nullable=True)  # 'ai' | 'analyst' | 'hybrid'
    ai_prompt_used = Column(String, nullable=True)

    # Review status
    is_reviewed = Column(Boolean, default=False)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)

    # Relationships
    ein = relationship("ExecutiveNote", back_populates="sections")


# ============================================================================
# PIPELINE & AUDIT TRAIL - PRD Section 4.3
# ============================================================================

class PipelineStageEnum(PyEnum):
    """Pipeline stages per PRD"""
    SOURCING = "sourcing"
    SCREENING = "screening"
    DILIGENCE = "diligence"
    IC = "ic"
    EXECUTION = "execution"


class PipelineStage(Base):
    """Pipeline stage configuration with SLA"""
    __tablename__ = "pipeline_stages"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    order_index = Column(Integer, nullable=False)
    sla_days = Column(Integer, nullable=True)  # Max days allowed in this stage
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.datetime.now)


class PipelineLog(Base):
    """Immutable audit trail for pipeline movements (INSERT-ONLY per PRD)"""
    __tablename__ = "pipeline_logs"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # Stage movement
    from_stage = Column(String(50), nullable=True)  # NULL for initial entry
    to_stage = Column(String(50), nullable=False)

    # Actor and context
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.now, nullable=False)
    notes = Column(String, nullable=True)

    # SLA tracking
    days_in_previous_stage = Column(Integer, nullable=True)
    sla_breached = Column(Boolean, default=False)

    # NOTE: No updated_at - this table is INSERT-ONLY for audit compliance

    # Relationships
    project = relationship("Project")


# ============================================================================
# INVESTMENT COMMITTEE (IC) GOVERNANCE - PRD Section 4.6
# ============================================================================

class VoteDecision(PyEnum):
    """IC vote options"""
    APPROVE = "approve"
    REJECT = "reject"
    DEFER = "defer"
    ABSTAIN = "abstain"


class InvestmentCommittee(Base):
    """Investment Committee meeting/session"""
    __tablename__ = "investment_committees"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    ein_id = Column(Integer, ForeignKey("executive_notes.id"), nullable=True)

    # Meeting details
    scheduled_date = Column(DateTime, nullable=False)
    meeting_type = Column(String(50), default="regular")  # regular, extraordinary

    # Status and decision
    status = Column(String(50), default="scheduled")  # scheduled, in_progress, completed, cancelled
    decision = Column(String(50), nullable=True)  # approved, rejected, deferred
    decision_notes = Column(String, nullable=True)

    # Quorum
    quorum_required = Column(Integer, default=3)
    quorum_met = Column(Boolean, default=False)

    # Attendees
    attendees = Column(String, nullable=True)  # JSON array of user IDs

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.now)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project")
    ein = relationship("ExecutiveNote")
    votes = relationship("ICVote", back_populates="committee", cascade="all, delete-orphan")


class ICVote(Base):
    """Individual IC member vote on a project"""
    __tablename__ = "ic_votes"

    id = Column(Integer, primary_key=True)
    committee_id = Column(Integer, ForeignKey("investment_committees.id"), nullable=False)

    # Voter
    voter_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Vote details
    vote = Column(SQLEnum(VoteDecision), nullable=False)
    rationale = Column(String, nullable=True)
    conditions = Column(String, nullable=True)  # JSON array of conditions if any

    # Timestamp
    voted_at = Column(DateTime, default=datetime.datetime.now)

    # Relationships
    committee = relationship("InvestmentCommittee", back_populates="votes")


# ============================================================================
# AI INTELLIGENCE LAYER - PRD Section 9
# ============================================================================

class AIAnalysis(Base):
    """AI-generated analyses for projects"""
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # Analysis type
    analysis_type = Column(String(50), nullable=False)  # full, country_risk, sector, petfel_augment, ein_draft

    # Content
    content = Column(String, nullable=True)  # Main analysis text
    model_version = Column(String(100), nullable=True)
    raw_response = Column(String, nullable=True)  # JSON of full API response

    # Metadata
    generated_at = Column(DateTime, default=datetime.datetime.now)
    tokens_used = Column(Integer, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)

    # Relationships
    project = relationship("Project")


class PartnerMatch(Base):
    """Investor-project matching results"""
    __tablename__ = "partner_matches"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    investor_id = Column(Integer, ForeignKey("investors.id"), nullable=False)

    # Match scoring (per PRD Section 9.3)
    match_score = Column(Float, nullable=False)  # 0-100
    sector_score = Column(Float, nullable=True)  # 30% weight
    geography_score = Column(Float, nullable=True)  # 25% weight
    ticket_score = Column(Float, nullable=True)  # 20% weight
    risk_score = Column(Float, nullable=True)  # 15% weight
    strategic_score = Column(Float, nullable=True)  # 10% weight

    # Status
    status = Column(String(50), default="suggested")  # suggested, contacted, engaged, closed

    # Timestamps
    run_at = Column(DateTime, default=datetime.datetime.now)
    contacted_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project")
    investor = relationship("Investor")

