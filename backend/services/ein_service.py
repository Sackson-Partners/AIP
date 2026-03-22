"""
Executive Investment Note (EIN) Service
Implements the 9-section EIN template per PRD Section 7
"""

from typing import Dict, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from backend.models import (
    ExecutiveNote, EINSection, EINStatus, Recommendation,
    PETFELAssessment, Project
)


# EIN Section Templates per PRD Section 7.3
EIN_SECTIONS = [
    {
        "code": 0,
        "name": "Cover & Executive Summary",
        "objective": "Turn the PIS into a decision-grade executive snapshot",
        "key_questions": [
            "What is the project?",
            "Why now?",
            "Who is the sponsor/executing agency?",
            "Who pays (tariff/offtake/AP/user fees)?",
            "What is missing to reach bankability?",
            "What is the recommended next step (30-90 days)?"
        ],
        "output_guidance": "5-10 lines narrative + 5 bullets: (1) investment ask, (2) revenue security, (3) readiness, (4) key risks, (5) next actions"
    },
    {
        "code": 1,
        "name": "Strategy Perspective",
        "objective": "Explain strategic fit and why the project can be investable",
        "key_questions": [
            "Which national plan does it support?",
            "How does it fit the corridor/industrialization/energy transition agenda?",
            "What is the investor thesis?"
        ],
        "output_guidance": "1-2 pages: narrative + 3-5 bullets on investability drivers"
    },
    {
        "code": 2,
        "name": "Political Perspective",
        "objective": "Map stakeholders, approvals, and political risks with practical mitigations",
        "key_questions": [
            "Who is the political champion?",
            "Which ministries/regulators matter?",
            "What community sensitivities exist?",
            "What is the election/policy reversal risk?"
        ],
        "output_guidance": "0.5-1 page: stakeholder map summary + risk/mitigation bullets"
    },
    {
        "code": 3,
        "name": "Economic Perspective",
        "objective": "Show demand logic, competitiveness, and distributional impact",
        "key_questions": [
            "Who are the users and what are the volumes?",
            "Willingness-to-pay/affordability?",
            "Macro constraints (FX, inflation)?",
            "Jobs and local value chains?"
        ],
        "output_guidance": "0.5-1 page: demand story + affordability + macro sensitivity"
    },
    {
        "code": 4,
        "name": "Financial Perspective",
        "objective": "Summarize project economics and the bankability pathway",
        "key_questions": [
            "CAPEX/OPEX snapshot?",
            "Revenue model?",
            "Financing plan?",
            "Key ratios (DSCR)?",
            "Sensitivities?"
        ],
        "output_guidance": "1-2 pages: tables for CAPEX/funding + narrative on revenue security"
    },
    {
        "code": 5,
        "name": "Legal & Regulatory Perspective",
        "objective": "Confirm legal route and identify legal blockers",
        "key_questions": [
            "Is the PPP/concession route lawful?",
            "Land tenure status?",
            "Permitting pathway?",
            "Contract enforceability?"
        ],
        "output_guidance": "0.5-1 page: legal readiness summary + critical gaps"
    },
    {
        "code": 6,
        "name": "Risk Register & Mitigation Plan",
        "objective": "Translate PETFEL findings into an actionable mitigation plan",
        "key_questions": [
            "What are the top 10 risks?",
            "Which are gating (red flags)?",
            "Who owns each mitigation?",
            "What is the timeline?"
        ],
        "output_guidance": "1 page: risk table with columns - Risk, Severity, Mitigation, Owner, Deadline"
    },
    {
        "code": 7,
        "name": "Required Next Steps (30/60/90 Days)",
        "objective": "Make the decision pathway explicit and time-bound",
        "key_questions": [
            "What must be done in 30/60/90 days?",
            "What data room items are missing?",
            "Which counterparties must be engaged?"
        ],
        "output_guidance": "0.5 page: bullet roadmap with named owners and target dates"
    },
    {
        "code": 8,
        "name": "Annexes",
        "objective": "Provide supporting exhibits without bloating the main note",
        "key_questions": [
            "Which annexes are needed?",
            "Maps, permits, demand charts, mini-financials?"
        ],
        "output_guidance": "Attach or link exhibits. Keep narrative short."
    },
]


class EINService:
    """Service for Executive Investment Note management"""

    def __init__(self, db: Session):
        self.db = db

    def create_ein(
        self,
        project_id: int,
        author_id: int,
        petfel_assessment_id: Optional[int] = None
    ) -> ExecutiveNote:
        """Create a new EIN with all 9 sections initialized"""

        # Check if project exists
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Get latest version
        latest = self.db.query(ExecutiveNote).filter(
            ExecutiveNote.project_id == project_id
        ).order_by(ExecutiveNote.version.desc()).first()

        version = (latest.version + 1) if latest else 1

        # Get PETFEL score if assessment provided
        petfel_score = None
        red_flags_count = 0
        if petfel_assessment_id:
            assessment = self.db.query(PETFELAssessment).filter(
                PETFELAssessment.id == petfel_assessment_id
            ).first()
            if assessment:
                petfel_score = assessment.overall_score
                red_flags_count = len([f for f in assessment.flags if not f.is_resolved])

        # Create EIN
        ein = ExecutiveNote(
            project_id=project_id,
            title=f"{project.name} — EIN v{version}",
            version=version,
            status=EINStatus.DRAFT,
            author_id=author_id,
            petfel_assessment_id=petfel_assessment_id,
            petfel_score=petfel_score,
            red_flags_count=red_flags_count,
        )
        self.db.add(ein)
        self.db.flush()

        # Create all 9 sections
        for section_def in EIN_SECTIONS:
            section = EINSection(
                ein_id=ein.id,
                section_code=section_def["code"],
                section_name=section_def["name"],
            )
            self.db.add(section)

        self.db.commit()
        self.db.refresh(ein)
        return ein

    def get_ein(self, ein_id: int) -> Optional[ExecutiveNote]:
        """Get EIN by ID with sections"""
        return self.db.query(ExecutiveNote).filter(
            ExecutiveNote.id == ein_id
        ).first()

    def get_latest_ein(self, project_id: int) -> Optional[ExecutiveNote]:
        """Get the latest EIN for a project"""
        return self.db.query(ExecutiveNote).filter(
            ExecutiveNote.project_id == project_id
        ).order_by(ExecutiveNote.version.desc()).first()

    def get_approved_ein(self, project_id: int) -> Optional[ExecutiveNote]:
        """Get the latest approved EIN for a project"""
        return self.db.query(ExecutiveNote).filter(
            ExecutiveNote.project_id == project_id,
            ExecutiveNote.status == EINStatus.APPROVED
        ).order_by(ExecutiveNote.version.desc()).first()

    def update_section(
        self,
        ein_id: int,
        section_code: int,
        content: str,
        generated_by: str = "analyst"
    ) -> EINSection:
        """Update a specific section's content"""

        section = self.db.query(EINSection).filter(
            EINSection.ein_id == ein_id,
            EINSection.section_code == section_code
        ).first()

        if not section:
            raise ValueError(f"Section {section_code} not found in EIN {ein_id}")

        section.content = content
        section.generated_by = generated_by
        section.updated_at = datetime.now()

        self.db.commit()
        self.db.refresh(section)
        return section

    def update_executive_summary(
        self,
        ein_id: int,
        executive_summary: str,
        recommendation: Recommendation,
        key_gaps: Optional[str] = None,
        next_steps: Optional[str] = None
    ) -> ExecutiveNote:
        """Update the EIN executive summary and recommendation"""

        ein = self.get_ein(ein_id)
        if not ein:
            raise ValueError(f"EIN {ein_id} not found")

        ein.executive_summary = executive_summary
        ein.recommendation = recommendation
        ein.key_gaps = key_gaps
        ein.next_steps = next_steps

        self.db.commit()
        self.db.refresh(ein)
        return ein

    def mark_section_reviewed(
        self,
        ein_id: int,
        section_code: int,
        reviewer_id: int
    ) -> EINSection:
        """Mark a section as reviewed"""

        section = self.db.query(EINSection).filter(
            EINSection.ein_id == ein_id,
            EINSection.section_code == section_code
        ).first()

        if not section:
            raise ValueError(f"Section {section_code} not found in EIN {ein_id}")

        section.is_reviewed = True
        section.reviewed_by_id = reviewer_id

        self.db.commit()
        self.db.refresh(section)
        return section

    def submit_for_review(self, ein_id: int) -> ExecutiveNote:
        """Submit EIN for review"""

        ein = self.get_ein(ein_id)
        if not ein:
            raise ValueError(f"EIN {ein_id} not found")

        # Check all required sections have content
        empty_sections = [
            s for s in ein.sections
            if s.section_code < 8 and not s.content  # Annexes optional
        ]
        if empty_sections:
            section_names = [s.section_name for s in empty_sections]
            raise ValueError(f"Missing content in sections: {', '.join(section_names)}")

        ein.status = EINStatus.IN_REVIEW

        self.db.commit()
        self.db.refresh(ein)
        return ein

    def approve_ein(self, ein_id: int) -> ExecutiveNote:
        """Approve EIN for export/distribution"""

        ein = self.get_ein(ein_id)
        if not ein:
            raise ValueError(f"EIN {ein_id} not found")

        if ein.status != EINStatus.IN_REVIEW:
            raise ValueError("EIN must be in review before approval")

        ein.status = EINStatus.APPROVED
        ein.approved_at = datetime.now()
        ein.export_ready = True

        self.db.commit()
        self.db.refresh(ein)
        return ein

    def mark_as_sent(self, ein_id: int) -> ExecutiveNote:
        """Mark EIN as sent to investors/IC"""

        ein = self.get_ein(ein_id)
        if not ein:
            raise ValueError(f"EIN {ein_id} not found")

        if ein.status != EINStatus.APPROVED:
            raise ValueError("EIN must be approved before sending")

        ein.status = EINStatus.SENT
        ein.sent_at = datetime.now()

        self.db.commit()
        self.db.refresh(ein)
        return ein

    def get_section_template(self, section_code: int) -> Optional[Dict]:
        """Get the template/guidance for a specific section"""
        for section in EIN_SECTIONS:
            if section["code"] == section_code:
                return section
        return None

    def get_all_section_templates(self) -> List[Dict]:
        """Get all section templates"""
        return EIN_SECTIONS

    def validate_for_ic(self, ein_id: int) -> List[str]:
        """Validate EIN is ready for Investment Committee"""
        issues = []

        ein = self.get_ein(ein_id)
        if not ein:
            return ["EIN not found"]

        # Must be approved
        if ein.status != EINStatus.APPROVED:
            issues.append("EIN must be approved")

        # Must have recommendation
        if not ein.recommendation:
            issues.append("Missing recommendation (GO/HOLD/NO-GO)")

        # Must have executive summary
        if not ein.executive_summary:
            issues.append("Missing executive summary")

        # Must have PETFEL assessment
        if not ein.petfel_assessment_id:
            issues.append("No linked PETFEL assessment")

        # Check critical sections have content
        required_sections = [0, 1, 4, 6, 7]  # Cover, Strategy, Financial, Risk, Next Steps
        for section_code in required_sections:
            section = next(
                (s for s in ein.sections if s.section_code == section_code),
                None
            )
            if not section or not section.content:
                section_name = next(
                    (t["name"] for t in EIN_SECTIONS if t["code"] == section_code),
                    f"Section {section_code}"
                )
                issues.append(f"Missing content: {section_name}")

        return issues
