"""
Tests for backend/schemas.py — Pydantic schema validation.
Covers instantiation, validation, and field constraints for all schema classes.
"""
import pytest
from datetime import date, datetime, timezone


class TestProjectSchemas:
    def test_project_base_minimal(self):
        from backend.schemas import ProjectCreate
        p = ProjectCreate(
            name="Nairobi Solar",
            sector="energy",
            country="Kenya",
            stage="Feasibility",
            estimated_capex=50_000_000.0,
            revenue_model="PPA",
        )
        assert p.name == "Nairobi Solar"
        assert p.country == "Kenya"
        assert p.region is None

    def test_project_base_full(self):
        from backend.schemas import ProjectCreate
        p = ProjectCreate(
            name="Lagos Port",
            sector="transport",
            country="Nigeria",
            region="West Africa",
            stage="Concept",
            estimated_capex=200_000_000.0,
            funding_gap=50_000_000.0,
            revenue_model="Tariff",
            offtaker="Government",
            fx_exposure="USD",
            esg_category="B",
        )
        assert p.funding_gap == 50_000_000.0

    def test_project_read_schema_config(self):
        from backend.schemas import Project
        assert Project.model_config.get("from_attributes") or hasattr(Project, "Config")


class TestBankabilityScore:
    def test_valid_bankability_score(self):
        from backend.schemas import BankabilityScore
        b = BankabilityScore(
            technical_readiness=80,
            financial_robustness=70,
            legal_clarity=90,
            esg_compliance=85,
            overall_score=81.25,
            last_verified=date.today(),
        )
        assert b.overall_score == 81.25
        assert b.risk_flags == []

    def test_bankability_score_with_flags(self):
        from backend.schemas import BankabilityScore
        b = BankabilityScore(
            technical_readiness=40,
            financial_robustness=30,
            legal_clarity=50,
            esg_compliance=60,
            overall_score=45.0,
            risk_flags=["Land not secured", "Offtaker unrated"],
            last_verified=date.today(),
        )
        assert len(b.risk_flags) == 2

    def test_bankability_score_bounds(self):
        from backend.schemas import BankabilityScore
        import pydantic
        with pytest.raises((ValueError, pydantic.ValidationError)):
            BankabilityScore(
                technical_readiness=101,  # out of range
                financial_robustness=70,
                legal_clarity=90,
                esg_compliance=85,
                overall_score=81.25,
                last_verified=date.today(),
            )


class TestVerificationSchemas:
    def test_verification_create(self):
        from backend.schemas import VerificationCreate
        v = VerificationCreate(
            level="V0: Submitted",
            project_id="proj-123",
        )
        assert v.project_id == "proj-123"
        assert v.bankability is None

    def test_verification_with_bankability(self):
        from backend.schemas import VerificationCreate, BankabilityScore
        b = BankabilityScore(
            technical_readiness=70,
            financial_robustness=75,
            legal_clarity=80,
            esg_compliance=85,
            overall_score=77.5,
            last_verified=date.today(),
        )
        v = VerificationCreate(
            level="V1: Preliminary",
            project_id="proj-456",
            bankability=b,
        )
        assert v.bankability.overall_score == 77.5


class TestInvestorSchemas:
    def test_investor_create_minimal(self):
        from backend.schemas import InvestorCreate
        inv = InvestorCreate(
            fund_name="Helios Fund IV",
            ticket_size_min=5_000_000.0,
            ticket_size_max=50_000_000.0,
            instruments=["Equity"],
            country_focus=["Nigeria", "Kenya"],
            sector_focus=["energy"],
        )
        assert inv.fund_name == "Helios Fund IV"
        assert inv.aum is None

    def test_investor_create_full(self):
        from backend.schemas import InvestorCreate
        inv = InvestorCreate(
            fund_name="AfDB Infrastructure Fund",
            aum=2_000_000_000.0,
            ticket_size_min=20_000_000.0,
            ticket_size_max=200_000_000.0,
            instruments=["Equity", "Debt", "Mezzanine"],
            target_irr=15.0,
            country_focus=["Pan-African"],
            sector_focus=["energy", "transport"],
            esg_constraints="IFC Performance Standards",
        )
        assert inv.target_irr == 15.0
        assert len(inv.instruments) == 3


class TestIntroductionSchemas:
    def test_introduction_create_defaults(self):
        from backend.schemas import IntroductionCreate
        intro = IntroductionCreate(
            investor_id="inv-123",
            project_id="proj-456",
        )
        assert intro.nda_executed is False
        assert intro.sponsor_approved is False
        assert intro.status == "Pending"

    def test_introduction_create_with_message(self):
        from backend.schemas import IntroductionCreate
        intro = IntroductionCreate(
            investor_id="inv-789",
            project_id="proj-012",
            message="We believe this project aligns with your mandate.",
        )
        assert intro.message is not None


class TestDataRoomSchemas:
    def test_data_room_create(self):
        from backend.schemas import DataRoomCreate
        dr = DataRoomCreate(
            project_id="proj-111",
            nda_required=True,
        )
        assert dr.nda_required is True
        assert dr.access_users is None

    def test_data_room_with_users(self):
        from backend.schemas import DataRoomCreate
        dr = DataRoomCreate(
            project_id="proj-222",
            access_users=["user1@aip.test", "user2@aip.test"],
            documents={"memo.pdf": "https://storage.example.com/memo.pdf"},
        )
        assert len(dr.access_users) == 2


class TestAnalyticReportSchemas:
    def test_analytic_report_create(self):
        from backend.schemas import AnalyticReportCreate
        report = AnalyticReportCreate(
            title="East Africa Energy Sector Q1 2026",
            sector="energy",
            country="Kenya",
            content="Detailed analysis of renewable energy projects...",
        )
        assert report.title.startswith("East Africa")

    def test_analytic_report_minimal(self):
        from backend.schemas import AnalyticReportCreate
        report = AnalyticReportCreate(
            title="Q1 Overview",
            content="Content here",
        )
        assert report.sector is None
        assert report.country is None


class TestEventSchemas:
    def test_event_create(self):
        from backend.schemas import EventCreate
        ev = EventCreate(
            name="Africa Infrastructure Summit",
            description="Annual summit for infrastructure finance",
            event_date=date(2026, 9, 15),
            type="conference",
            projects_involved=["proj-1", "proj-2"],
        )
        assert len(ev.projects_involved) == 2

    def test_event_minimal(self):
        from backend.schemas import EventCreate
        ev = EventCreate(
            name="Roundtable",
            description="Investor roundtable",
            event_date=date(2026, 6, 1),
            type="roundtable",
        )
        assert ev.projects_involved is None


class TestUserSchemas:
    def test_user_create(self):
        from backend.schemas import UserCreate
        u = UserCreate(
            username="analyst_001",
            role="analyst",
            password="SecurePass@123",
        )
        assert u.role == "analyst"

    def test_user_register(self):
        from backend.schemas import UserRegister
        u = UserRegister(
            email="newuser@aip.test",
            password="StrongPass@456!",
            full_name="New User",
            phone="+1234567890",
        )
        assert u.email == "newuser@aip.test"

    def test_token_schema(self):
        from backend.schemas import Token
        t = Token(access_token="eyJ...", token_type="bearer")
        assert t.token_type == "bearer"


class TestDealRoomSchemas:
    def test_deal_room_create_defaults(self):
        from backend.schemas import DealRoomCreate
        dr = DealRoomCreate(
            project_id="proj-333",
            name="Nairobi Solar Deal Room",
        )
        assert dr.deal_currency == "USD"
        assert dr.is_video_enabled is True
        assert dr.require_nda is True

    def test_deal_room_update_partial(self):
        from backend.schemas import DealRoomUpdate
        upd = DealRoomUpdate(status="closed", deal_value=100_000_000.0)
        assert upd.status == "closed"
        assert upd.name is None

    def test_deal_room_member_create(self):
        from backend.schemas import DealRoomMemberCreate
        m = DealRoomMemberCreate(email="investor@fund.com", role="viewer")
        assert m.role == "viewer"

    def test_deal_room_document_create(self):
        from backend.schemas import DealRoomDocumentCreate
        doc = DealRoomDocumentCreate(
            title="Financial Model",
            document_type="financial",
            file_name="model.xlsx",
            file_url="https://storage.example.com/model.xlsx",
        )
        assert doc.requires_signature is False

    def test_deal_room_meeting_create_defaults(self):
        from backend.schemas import DealRoomMeetingCreate
        meeting = DealRoomMeetingCreate(
            title="IC Call",
            scheduled_at=datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc),
        )
        assert meeting.duration_minutes == 60
        assert meeting.timezone == "UTC"

    def test_deal_room_message_create(self):
        from backend.schemas import DealRoomMessageCreate
        msg = DealRoomMessageCreate(message="Hello deal team!")
        assert msg.message_type == "text"
        assert msg.parent_id is None
