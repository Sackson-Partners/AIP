"""
AI Intelligence API Routes
Implements Claude-powered intelligence agents per PRD Section 9
"""

import os
import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    Project, PETFELAssessment, PETFELScore, ExecutiveNote, EINSection,
    AIAnalysis, PartnerMatch, Investor, User
)
from backend.services.petfel_service import PETFELService, PETFEL_CRITERIA, PILLAR_WEIGHTS
from backend.services.ein_service import EINService, EIN_SECTIONS

# Anthropic Claude API
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

router = APIRouter(prefix="/ai", tags=["AI Intelligence"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class AIAnalysisResponse(BaseModel):
    """AI analysis response"""
    project_id: int
    analysis_type: str
    content: str
    model_version: str
    generated_at: datetime
    tokens_used: Optional[int]
    processing_time_ms: Optional[int]


class PETFELAugmentResponse(BaseModel):
    """PETFEL augmentation response"""
    assessment_id: int
    augmented_scores: Dict[str, Any]
    recommendations: str
    confidence: float
    model_version: str


class EINGenerationResponse(BaseModel):
    """EIN generation response"""
    project_id: int
    ein_id: int
    sections_generated: int
    model_version: str


class CountryRiskResponse(BaseModel):
    """Country risk analysis response"""
    country: str
    risk_rating: str
    analysis: Dict[str, Any]
    generated_at: datetime


class InvestorMatchResponse(BaseModel):
    """Investor match response"""
    project_id: int
    matches: list
    total_matches: int


# ============================================================================
# Claude API Client
# ============================================================================

def get_claude_client():
    """Get Anthropic Claude client"""
    if not ANTHROPIC_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Anthropic SDK not available"
        )

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ANTHROPIC_API_KEY not configured"
        )

    return anthropic.Anthropic(api_key=api_key)


# ============================================================================
# System Prompts
# ============================================================================

EIN_SYSTEM_PROMPT = """You are a senior infrastructure investment analyst at a top-tier development finance institution focused on Africa. Write professional investment committee notes with the precision of a World Bank project appraisal document and the clarity of a McKinsey executive brief.

Structure your output using the AIP EIN 9-section template.
Tone: authoritative, data-driven, balanced on risks and mitigations.
Format: Markdown with section headers. Length: 800-1400 words for Sections 1-6."""

PETFEL_AUGMENT_PROMPT = """You are an expert infrastructure due diligence analyst. Analyze the provided project information and PETFEL assessment data to:
1. Suggest scores (1-5) for each sub-criterion based on available evidence
2. Identify gaps in the evidence
3. Recommend specific mitigations for low-scoring areas
4. Flag any critical risks that should trigger a HOLD decision

Provide your analysis in JSON format with the following structure:
{
    "suggested_scores": {"pillar_criterion": {"score": 1-5, "rationale": "..."}},
    "evidence_gaps": ["list of missing evidence"],
    "mitigations": [{"criterion": "...", "mitigation": "...", "owner": "suggested owner"}],
    "critical_flags": ["list of critical issues"],
    "overall_assessment": "brief narrative",
    "confidence": 0.0-1.0
}"""

COUNTRY_RISK_PROMPT = """You are a country risk analyst specializing in African infrastructure investment. Analyze the investment climate for the specified country, covering:
1. Political stability and governance
2. Regulatory environment for infrastructure PPPs
3. Currency and FX risks
4. Legal framework for foreign investment
5. Recent developments affecting infrastructure investment

Provide your analysis in JSON format with:
{
    "risk_rating": "low|medium|high|critical",
    "political": {"score": 1-5, "analysis": "..."},
    "economic": {"score": 1-5, "analysis": "..."},
    "regulatory": {"score": 1-5, "analysis": "..."},
    "legal": {"score": 1-5, "analysis": "..."},
    "recent_events": ["list of relevant events"],
    "investment_outlook": "narrative",
    "key_risks": ["list of top risks"],
    "opportunities": ["list of opportunities"]
}"""


# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/analyze/{project_id}", response_model=AIAnalysisResponse, summary="Run full AI analysis")
async def analyze_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Run comprehensive AI analysis on a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    client = get_claude_client()
    start_time = datetime.now()

    # Build project context
    project_info = f"""
Project: {project.name}
Sector: {project.sector.value if project.sector else 'N/A'}
Country: {project.country}
Region: {project.region or 'N/A'}
Stage: {project.stage.value if project.stage else 'N/A'}
Estimated CAPEX: ${project.estimated_capex:,.0f} if project.estimated_capex else 'N/A'
Funding Gap: ${project.funding_gap:,.0f} if project.funding_gap else 'N/A'
Revenue Model: {project.revenue_model or 'N/A'}
Offtaker: {project.offtaker or 'N/A'}
Technology: {project.technology or 'N/A'}
"""

    prompt = f"""Analyze this African infrastructure project and provide a comprehensive investment assessment:

{project_info}

Provide:
1. Executive Summary (2-3 sentences)
2. Key Investment Highlights (3-5 bullets)
3. Critical Risks (3-5 bullets with severity)
4. Recommended Next Steps (3-5 bullets)
5. Preliminary Investment Thesis"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system="You are a senior infrastructure investment analyst focused on African markets.",
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text
    processing_time = (datetime.now() - start_time).total_seconds() * 1000

    # Save analysis
    analysis = AIAnalysis(
        project_id=project_id,
        analysis_type="full",
        content=content,
        model_version=response.model,
        raw_response=json.dumps({"usage": {"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens}}),
        tokens_used=response.usage.input_tokens + response.usage.output_tokens,
        processing_time_ms=int(processing_time)
    )
    db.add(analysis)
    db.commit()

    return AIAnalysisResponse(
        project_id=project_id,
        analysis_type="full",
        content=content,
        model_version=response.model,
        generated_at=analysis.generated_at,
        tokens_used=analysis.tokens_used,
        processing_time_ms=analysis.processing_time_ms
    )


@router.post("/petfel-augment/{assessment_id}", response_model=PETFELAugmentResponse, summary="AI augment PETFEL assessment")
async def augment_petfel(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Use AI to suggest scores and identify gaps in PETFEL assessment"""
    assessment = db.query(PETFELAssessment).filter(
        PETFELAssessment.id == assessment_id
    ).first()

    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found"
        )

    project = db.query(Project).filter(Project.id == assessment.project_id).first()
    client = get_claude_client()

    # Build assessment context
    scores_context = []
    for score in assessment.scores:
        scores_context.append({
            "pillar": score.pillar.value,
            "criterion": score.sub_criterion,
            "current_score": score.score,
            "evidence": score.evidence_notes,
            "mitigation": score.mitigation
        })

    prompt = f"""Analyze this PETFEL due diligence assessment and suggest improvements:

Project: {project.name}
Sector: {project.sector.value if project.sector else 'N/A'}
Country: {project.country}

Current Assessment Scores:
{json.dumps(scores_context, indent=2)}

PETFEL Criteria Reference:
{json.dumps({p.value: [c['name'] for c in criteria] for p, criteria in PETFEL_CRITERIA.items()}, indent=2)}

{PETFEL_AUGMENT_PROMPT}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=3000,
        system=PETFEL_AUGMENT_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text

    # Try to parse JSON response
    try:
        # Find JSON in response
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            augmented_data = json.loads(content[json_start:json_end])
        else:
            augmented_data = {"raw_response": content}
    except json.JSONDecodeError:
        augmented_data = {"raw_response": content}

    # Update assessment
    assessment.ai_augmented = True
    assessment.ai_model_version = response.model
    assessment.ai_confidence_score = augmented_data.get("confidence", 0.7)
    assessment.last_analyzed_at = datetime.now()
    db.commit()

    return PETFELAugmentResponse(
        assessment_id=assessment_id,
        augmented_scores=augmented_data,
        recommendations=augmented_data.get("overall_assessment", content[:500]),
        confidence=augmented_data.get("confidence", 0.7),
        model_version=response.model
    )


@router.post("/generate-ein/{project_id}", response_model=EINGenerationResponse, summary="AI generate EIN draft")
async def generate_ein(
    project_id: int,
    petfel_assessment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a complete EIN draft using AI"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Get or create EIN
    ein_service = EINService(db)
    ein = ein_service.create_ein(project_id, current_user.id, petfel_assessment_id)

    # Get PETFEL if available
    petfel_context = ""
    if petfel_assessment_id:
        assessment = db.query(PETFELAssessment).filter(
            PETFELAssessment.id == petfel_assessment_id
        ).first()
        if assessment:
            petfel_context = f"""
PETFEL Assessment:
- Overall Score: {assessment.overall_score or 'Not calculated'}
- Rating: {assessment.rating.value if assessment.rating else 'N/A'}
- Gating Result: {assessment.gating_result.value if assessment.gating_result else 'N/A'}
- Political Score: {assessment.political_score or 'N/A'}
- Economic Score: {assessment.economic_score or 'N/A'}
- Technical Score: {assessment.technical_score or 'N/A'}
- Financial Score: {assessment.financial_score or 'N/A'}
- Environmental Score: {assessment.environmental_score or 'N/A'}
- Legal Score: {assessment.legal_score or 'N/A'}
"""

    client = get_claude_client()

    # Generate each section
    project_context = f"""
Project: {project.name}
Sector: {project.sector.value if project.sector else 'N/A'}
Country: {project.country}
Region: {project.region or 'N/A'}
Stage: {project.stage.value if project.stage else 'N/A'}
Estimated CAPEX: ${project.estimated_capex:,.0f} if project.estimated_capex else 'N/A'
Funding Gap: ${project.funding_gap:,.0f} if project.funding_gap else 'N/A'
Revenue Model: {project.revenue_model or 'N/A'}
Offtaker: {project.offtaker or 'N/A'}
Technology: {project.technology or 'N/A'}
EPC Status: {project.epc_status or 'N/A'}
Land Status: {project.land_acquisition_status or 'N/A'}
Permits: {project.permits_status or 'N/A'}
ESG Category: {project.esg_category or 'N/A'}
{petfel_context}
"""

    sections_generated = 0

    for section_def in EIN_SECTIONS[:8]:  # Skip annexes
        section_prompt = f"""Generate content for the following EIN section:

Section: {section_def['name']}
Objective: {section_def['objective']}
Key Questions to Answer: {', '.join(section_def['key_questions'])}
Output Guidance: {section_def['output_guidance']}

Project Information:
{project_context}

Generate professional, investment-grade content in Markdown format."""

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=EIN_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": section_prompt}]
        )

        content = response.content[0].text

        # Update section
        ein_service.update_section(
            ein_id=ein.id,
            section_code=section_def['code'],
            content=content,
            generated_by="ai"
        )
        sections_generated += 1

    return EINGenerationResponse(
        project_id=project_id,
        ein_id=ein.id,
        sections_generated=sections_generated,
        model_version="claude-sonnet-4-20250514"
    )


@router.post("/country-risk/{country}", response_model=CountryRiskResponse, summary="Generate country risk brief")
async def analyze_country_risk(
    country: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate country risk analysis for infrastructure investment"""
    client = get_claude_client()

    prompt = f"""Analyze the investment climate for infrastructure projects in {country}.

{COUNTRY_RISK_PROMPT}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=COUNTRY_RISK_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text

    # Try to parse JSON
    try:
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            analysis_data = json.loads(content[json_start:json_end])
        else:
            analysis_data = {"raw_analysis": content}
    except json.JSONDecodeError:
        analysis_data = {"raw_analysis": content}

    return CountryRiskResponse(
        country=country,
        risk_rating=analysis_data.get("risk_rating", "medium"),
        analysis=analysis_data,
        generated_at=datetime.now()
    )


@router.post("/matching/run/{project_id}", response_model=InvestorMatchResponse, summary="Run investor matching")
async def run_investor_matching(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Run AI-powered investor matching algorithm"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Get all investors
    investors = db.query(Investor).all()

    matches = []
    for investor in investors:
        # Calculate match scores per PRD Section 9.3
        sector_score = 0
        if project.sector and investor.sector_focus:
            if project.sector.value.lower() in investor.sector_focus.lower():
                sector_score = 30
            elif any(s in investor.sector_focus.lower() for s in ['infrastructure', 'all']):
                sector_score = 15

        geography_score = 0
        if project.country and investor.country_focus:
            if project.country.lower() in investor.country_focus.lower():
                geography_score = 25
            elif 'africa' in investor.country_focus.lower():
                geography_score = 12

        ticket_score = 0
        if project.funding_gap and investor.ticket_size_min and investor.ticket_size_max:
            if investor.ticket_size_min <= project.funding_gap <= investor.ticket_size_max:
                ticket_score = 20
            elif project.funding_gap <= investor.ticket_size_max * 1.5:
                ticket_score = 10

        # Total score
        total_score = sector_score + geography_score + ticket_score

        if total_score >= 20:  # Minimum threshold
            match = PartnerMatch(
                project_id=project_id,
                investor_id=investor.id,
                match_score=total_score,
                sector_score=sector_score,
                geography_score=geography_score,
                ticket_score=ticket_score,
                status="suggested"
            )
            db.add(match)
            matches.append({
                "investor_id": investor.id,
                "investor_name": investor.fund_name,
                "match_score": total_score,
                "sector_score": sector_score,
                "geography_score": geography_score,
                "ticket_score": ticket_score
            })

    db.commit()

    # Sort by score
    matches.sort(key=lambda x: x["match_score"], reverse=True)

    return InvestorMatchResponse(
        project_id=project_id,
        matches=matches[:20],  # Top 20
        total_matches=len(matches)
    )


@router.get("/matching/{project_id}", response_model=InvestorMatchResponse, summary="Get investor matches")
async def get_investor_matches(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get previously calculated investor matches for a project"""
    matches = db.query(PartnerMatch).filter(
        PartnerMatch.project_id == project_id
    ).order_by(PartnerMatch.match_score.desc()).all()

    result = []
    for m in matches:
        investor = db.query(Investor).filter(Investor.id == m.investor_id).first()
        result.append({
            "investor_id": m.investor_id,
            "investor_name": investor.fund_name if investor else "Unknown",
            "match_score": m.match_score,
            "sector_score": m.sector_score,
            "geography_score": m.geography_score,
            "ticket_score": m.ticket_score,
            "status": m.status
        })

    return InvestorMatchResponse(
        project_id=project_id,
        matches=result,
        total_matches=len(result)
    )
