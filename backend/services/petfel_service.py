"""
PETFEL Due Diligence Service
Implements the 30 sub-criteria scoring engine per PRD Section 6
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from backend.models import (
    PETFELAssessment, PETFELScore, PETFELFlag,
    PillarType, PETFELRating, GatingResult, FlagType, AssessmentStatus,
    Project
)


# Pillar weights per PRD Section 6.3
PILLAR_WEIGHTS = {
    PillarType.POLITICAL: 0.15,
    PillarType.ECONOMIC: 0.15,
    PillarType.TECHNICAL: 0.20,
    PillarType.FINANCIAL: 0.20,
    PillarType.ENVIRONMENTAL: 0.15,
    PillarType.LEGAL: 0.15,
}

# 30 Sub-criteria per PRD Section 6.4
PETFEL_CRITERIA = {
    PillarType.POLITICAL: [
        {"code": "P1", "name": "Mandate / authorization clear", "weight": 0.25},
        {"code": "P2", "name": "Sponsor credibility & capacity", "weight": 0.20},
        {"code": "P3", "name": "Stakeholder alignment & governance", "weight": 0.20},
        {"code": "P4", "name": "Policy stability / reversal risk", "weight": 0.20},
        {"code": "P5", "name": "Social license / community acceptance", "weight": 0.15},
    ],
    PillarType.ECONOMIC: [
        {"code": "E1", "name": "Demand validation / need proof", "weight": 0.25},
        {"code": "E2", "name": "Affordability & tariff realism", "weight": 0.20},
        {"code": "E3", "name": "Competitive landscape / alternatives", "weight": 0.15},
        {"code": "E4", "name": "Macro & FX exposure", "weight": 0.20},
        {"code": "E5", "name": "Local value chain & jobs", "weight": 0.20},
    ],
    PillarType.TECHNICAL: [
        {"code": "T1", "name": "Design maturity (pre-FS / FS)", "weight": 0.25},
        {"code": "T2", "name": "Site readiness (land, access, utilities)", "weight": 0.20},
        {"code": "T3", "name": "Technology risk & performance", "weight": 0.20},
        {"code": "T4", "name": "Implementation plan & schedule realism", "weight": 0.20},
        {"code": "T5", "name": "O&M concept and lifecycle costs", "weight": 0.15},
    ],
    PillarType.FINANCIAL: [
        {"code": "F1", "name": "CAPEX / OPEX realism", "weight": 0.20},
        {"code": "F2", "name": "Revenue model credibility", "weight": 0.20},
        {"code": "F3", "name": "Offtaker credit & payment security", "weight": 0.25},
        {"code": "F4", "name": "Financing plan & bankability", "weight": 0.20},
        {"code": "F5", "name": "Financial model maturity & sensitivities", "weight": 0.15},
    ],
    PillarType.ENVIRONMENTAL: [
        {"code": "En1", "name": "E&S screening and EIA status", "weight": 0.25},
        {"code": "En2", "name": "Land acquisition & resettlement plan", "weight": 0.25},
        {"code": "En3", "name": "Biodiversity and critical habitats", "weight": 0.15},
        {"code": "En4", "name": "Climate risk & resilience", "weight": 0.15},
        {"code": "En5", "name": "HSE management capacity", "weight": 0.20},
    ],
    PillarType.LEGAL: [
        {"code": "L1", "name": "PPP / concession framework fit", "weight": 0.20},
        {"code": "L2", "name": "Permits pathway and status", "weight": 0.20},
        {"code": "L3", "name": "Land title and rights enforceability", "weight": 0.25},
        {"code": "L4", "name": "Contract enforceability & security package", "weight": 0.20},
        {"code": "L5", "name": "Dispute resolution / arbitration / govt support", "weight": 0.15},
    ],
}


class PETFELService:
    """Service for PETFEL due diligence scoring"""

    def __init__(self, db: Session):
        self.db = db

    def create_assessment(self, project_id: int, user_id: int) -> PETFELAssessment:
        """Create a new PETFEL assessment with all 30 sub-criteria initialized"""

        # Check if project exists
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Get latest version
        latest = self.db.query(PETFELAssessment).filter(
            PETFELAssessment.project_id == project_id
        ).order_by(PETFELAssessment.version.desc()).first()

        version = (latest.version + 1) if latest else 1

        # Create assessment
        assessment = PETFELAssessment(
            project_id=project_id,
            version=version,
            status=AssessmentStatus.DRAFT,
            assessed_by=user_id,
        )
        self.db.add(assessment)
        self.db.flush()  # Get the ID

        # Create all 30 sub-criteria scores
        for pillar, criteria in PETFEL_CRITERIA.items():
            for criterion in criteria:
                score = PETFELScore(
                    assessment_id=assessment.id,
                    pillar=pillar,
                    sub_criterion=criterion["name"],
                    sub_weight=criterion["weight"],
                )
                self.db.add(score)

        self.db.commit()
        self.db.refresh(assessment)
        return assessment

    def get_assessment(self, assessment_id: int) -> Optional[PETFELAssessment]:
        """Get assessment by ID with scores and flags"""
        return self.db.query(PETFELAssessment).filter(
            PETFELAssessment.id == assessment_id
        ).first()

    def get_latest_assessment(self, project_id: int) -> Optional[PETFELAssessment]:
        """Get the latest PETFEL assessment for a project"""
        return self.db.query(PETFELAssessment).filter(
            PETFELAssessment.project_id == project_id
        ).order_by(PETFELAssessment.version.desc()).first()

    def update_score(
        self,
        assessment_id: int,
        pillar: PillarType,
        sub_criterion: str,
        score: int,
        evidence_notes: Optional[str] = None,
        mitigation: Optional[str] = None,
        owner: Optional[str] = None
    ) -> PETFELScore:
        """Update a single sub-criterion score (1-5 scale)"""

        if score < 1 or score > 5:
            raise ValueError("Score must be between 1 and 5")

        score_obj = self.db.query(PETFELScore).filter(
            PETFELScore.assessment_id == assessment_id,
            PETFELScore.pillar == pillar,
            PETFELScore.sub_criterion == sub_criterion
        ).first()

        if not score_obj:
            raise ValueError(f"Score not found for {pillar.value}/{sub_criterion}")

        score_obj.score = score
        score_obj.weighted_score = score * score_obj.sub_weight
        score_obj.evidence_notes = evidence_notes
        score_obj.mitigation = mitigation
        score_obj.owner = owner
        score_obj.scored_at = datetime.now()

        self.db.commit()
        self.db.refresh(score_obj)
        return score_obj

    def calculate_pillar_score(self, assessment_id: int, pillar: PillarType) -> float:
        """Calculate weighted score for a single pillar (0-100)"""
        scores = self.db.query(PETFELScore).filter(
            PETFELScore.assessment_id == assessment_id,
            PETFELScore.pillar == pillar,
            PETFELScore.score.isnot(None)
        ).all()

        if not scores:
            return 0.0

        total_weight = sum(s.sub_weight for s in scores)
        if total_weight == 0:
            return 0.0

        # Convert 1-5 scale to 0-100
        weighted_sum = sum((s.score - 1) * 25 * s.sub_weight for s in scores)
        return (weighted_sum / total_weight)

    def calculate_overall_score(self, assessment_id: int) -> Tuple[float, Dict[str, float]]:
        """Calculate overall PETFEL score and pillar breakdown"""
        pillar_scores = {}
        overall = 0.0

        for pillar, weight in PILLAR_WEIGHTS.items():
            pillar_score = self.calculate_pillar_score(assessment_id, pillar)
            pillar_scores[pillar.value] = pillar_score
            overall += pillar_score * weight

        return overall, pillar_scores

    def calculate_rating(self, score: float) -> PETFELRating:
        """Determine rating band from score (PRD Section 6.5)"""
        if score >= 80:
            return PETFELRating.A
        elif score >= 65:
            return PETFELRating.B
        elif score >= 50:
            return PETFELRating.C
        else:
            return PETFELRating.D

    def check_gating_rules(self, assessment_id: int) -> Tuple[GatingResult, List[str]]:
        """Check automatic HOLD gating rules (PRD Section 6.6)"""
        reasons = []

        assessment = self.get_assessment(assessment_id)
        if not assessment:
            return GatingResult.HOLD, ["Assessment not found"]

        # Rule 1: Land rights unresolved
        land_score = self.db.query(PETFELScore).filter(
            PETFELScore.assessment_id == assessment_id,
            PETFELScore.sub_criterion == "Land title and rights enforceability"
        ).first()
        if land_score and land_score.score and land_score.score <= 2:
            reasons.append("Land rights unresolved or subject to active litigation")

        # Rule 2: No legal mandate
        mandate_score = self.db.query(PETFELScore).filter(
            PETFELScore.assessment_id == assessment_id,
            PETFELScore.sub_criterion == "Mandate / authorization clear"
        ).first()
        if mandate_score and mandate_score.score and mandate_score.score <= 2:
            reasons.append("No legal mandate or PPP authority unclear")

        # Rule 3: No offtake
        offtake_score = self.db.query(PETFELScore).filter(
            PETFELScore.assessment_id == assessment_id,
            PETFELScore.sub_criterion == "Offtaker credit & payment security"
        ).first()
        if offtake_score and offtake_score.score and offtake_score.score <= 2:
            reasons.append("Offtake not credible and no alternative revenue pathway")

        # Rule 4: EIA resettlement issues
        eia_score = self.db.query(PETFELScore).filter(
            PETFELScore.assessment_id == assessment_id,
            PETFELScore.sub_criterion == "Land acquisition & resettlement plan"
        ).first()
        if eia_score and eia_score.score and eia_score.score <= 2:
            reasons.append("EIA requires resettlement with no approved plan")

        # Rule 5: Any pillar score <= 2 without mitigation owner
        low_scores = self.db.query(PETFELScore).filter(
            PETFELScore.assessment_id == assessment_id,
            PETFELScore.score <= 2,
            PETFELScore.score.isnot(None),
            PETFELScore.owner.is_(None)
        ).all()
        if low_scores:
            for s in low_scores:
                reasons.append(f"{s.pillar.value}: {s.sub_criterion} scores {s.score} with no mitigation owner")

        # Check unresolved red flags
        unresolved_flags = self.db.query(PETFELFlag).filter(
            PETFELFlag.assessment_id == assessment_id,
            PETFELFlag.is_resolved == False
        ).count()
        if unresolved_flags > 0:
            reasons.append(f"{unresolved_flags} unresolved red flag(s)")

        if reasons:
            return GatingResult.HOLD, reasons
        return GatingResult.GO, []

    def finalize_assessment(self, assessment_id: int) -> PETFELAssessment:
        """Calculate final scores, rating, and gating result"""
        assessment = self.get_assessment(assessment_id)
        if not assessment:
            raise ValueError(f"Assessment {assessment_id} not found")

        # Calculate scores
        overall_score, pillar_scores = self.calculate_overall_score(assessment_id)

        # Update pillar scores
        assessment.political_score = pillar_scores.get("political", 0)
        assessment.economic_score = pillar_scores.get("economic", 0)
        assessment.technical_score = pillar_scores.get("technical", 0)
        assessment.financial_score = pillar_scores.get("financial", 0)
        assessment.environmental_score = pillar_scores.get("environmental", 0)
        assessment.legal_score = pillar_scores.get("legal", 0)

        # Calculate overall
        assessment.overall_score = overall_score
        assessment.rating = self.calculate_rating(overall_score)

        # Check gating
        gating_result, gating_reasons = self.check_gating_rules(assessment_id)
        assessment.gating_result = gating_result

        # Auto-create flags for gating issues
        for reason in gating_reasons:
            flag = PETFELFlag(
                assessment_id=assessment_id,
                flag_type=FlagType.PILLAR_LOW,
                description=reason,
            )
            self.db.add(flag)

        self.db.commit()
        self.db.refresh(assessment)
        return assessment

    def add_flag(
        self,
        assessment_id: int,
        flag_type: FlagType,
        description: str,
        pillar: Optional[str] = None
    ) -> PETFELFlag:
        """Add a red flag to an assessment"""
        flag = PETFELFlag(
            assessment_id=assessment_id,
            flag_type=flag_type,
            pillar=pillar,
            description=description,
        )
        self.db.add(flag)
        self.db.commit()
        self.db.refresh(flag)
        return flag

    def resolve_flag(
        self,
        flag_id: int,
        user_id: int,
        resolution_notes: Optional[str] = None
    ) -> PETFELFlag:
        """Mark a flag as resolved"""
        flag = self.db.query(PETFELFlag).filter(PETFELFlag.id == flag_id).first()
        if not flag:
            raise ValueError(f"Flag {flag_id} not found")

        flag.is_resolved = True
        flag.resolved_by = user_id
        flag.resolved_at = datetime.now()
        flag.resolution_notes = resolution_notes

        self.db.commit()
        self.db.refresh(flag)
        return flag

    def submit_assessment(self, assessment_id: int) -> PETFELAssessment:
        """Submit assessment for review"""
        assessment = self.finalize_assessment(assessment_id)
        assessment.status = AssessmentStatus.SUBMITTED
        self.db.commit()
        self.db.refresh(assessment)
        return assessment

    def approve_assessment(self, assessment_id: int) -> PETFELAssessment:
        """Approve a submitted assessment"""
        assessment = self.get_assessment(assessment_id)
        if not assessment:
            raise ValueError(f"Assessment {assessment_id} not found")

        if assessment.status != AssessmentStatus.SUBMITTED:
            raise ValueError("Assessment must be submitted before approval")

        assessment.status = AssessmentStatus.APPROVED
        self.db.commit()
        self.db.refresh(assessment)
        return assessment

    def get_criteria_config(self) -> Dict:
        """Return the full PETFEL criteria configuration"""
        return {
            "pillars": {
                pillar.value: {
                    "weight": weight,
                    "criteria": PETFEL_CRITERIA[pillar]
                }
                for pillar, weight in PILLAR_WEIGHTS.items()
            },
            "rating_bands": {
                "A": {"min": 80, "max": 100, "decision": "GO - Investment Ready"},
                "B": {"min": 65, "max": 79, "decision": "Near-Ready (GO with conditions)"},
                "C": {"min": 50, "max": 64, "decision": "HOLD - Material Gaps"},
                "D": {"min": 0, "max": 49, "decision": "NO-GO - Early Stage / High Risk"},
            },
            "score_scale": {
                1: "Critical Risk - Missing fundamentals",
                2: "High Risk - Major gaps, requires mitigation",
                3: "Moderate Risk - Gaps exist but solvable",
                4: "Low Risk - Good maturity, manageable",
                5: "Best Practice - Investment-ready",
            }
        }
