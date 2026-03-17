"""
AIP AI Intelligence Router
---------------------------
Exposes Claude-powered intelligence endpoints for the AIP platform.
Each endpoint loads the appropriate prompt template, injects context data,
calls the Claude API, and returns a structured intelligence response.

All routes are protected by JWT authentication.
Rate-limited via the slowapi middleware configured in main.py.

Endpoints:
    POST /api/ai/analyze-project       Full infrastructure project analysis
    POST /api/ai/investment-brief      Investor-grade project brief
    POST /api/ai/country-analysis      Country infrastructure & investment profile
    POST /api/ai/podcast-prep          Podcast episode briefing and questions
    POST /api/ai/infrastructure-risk   Risk assessment for project or corridor
    POST /api/ai/geopolitical          Geopolitical analysis of investment dynamics
    GET  /api/ai/prompts               List available prompt templates
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.services.claude_service import (
    call_claude_structured,
    INFRASTRUCTURE_ANALYST_SYSTEM,
    INVESTMENT_INTELLIGENCE_SYSTEM,
    GEOPOLITICS_SYSTEM,
    PODCAST_INTELLIGENCE_SYSTEM,
)
from backend.services.prompt_service import build_prompt, list_available_prompts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI Intelligence"])


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------


class ProjectAnalysisRequest(BaseModel):
    project_data: dict[str, Any] = Field(
        ...,
        description="Project metadata: name, country, sector, cost, investors, etc.",
        example={
            "project_name": "Simandou Railway",
            "country": "Guinea",
            "sector": "Mining Logistics / Rail",
            "estimated_cost": "$15B",
            "investors": ["Rio Tinto", "Winning Consortium", "Chinese state banks"],
            "status": "under_construction",
        },
    )


class InvestmentBriefRequest(BaseModel):
    project_data: dict[str, Any] = Field(
        ..., description="Project metadata for brief generation."
    )
    investor_type: str = Field(
        default="infrastructure fund",
        description="Target investor profile (e.g. 'development bank', 'sovereign fund').",
    )


class CountryAnalysisRequest(BaseModel):
    country: str = Field(..., example="Kenya")
    sector: str = Field(
        default="General Infrastructure",
        example="Transport",
    )
    context: Optional[str] = Field(
        default="",
        description="Additional context or specific angle to focus on.",
    )


class PodcastPrepRequest(BaseModel):
    guest_name: str = Field(..., example="Dr. Amara Nwosu")
    guest_organisation: str = Field(..., example="African Development Bank")
    episode_theme: str = Field(..., example="Financing the Lobito Atlantic Railway")
    background_notes: Optional[str] = Field(
        default="",
        description="Any additional context, previous episode notes, or guest background.",
    )


class RiskAssessmentRequest(BaseModel):
    project_name: str = Field(..., example="LAPSSET Corridor")
    country_region: str = Field(..., example="Kenya / Ethiopia / South Sudan")
    sector: str = Field(..., example="Multi-modal Transport")
    project_stage: str = Field(
        default="Under Construction",
        example="Planned",
    )
    context: Optional[str] = Field(default="", description="Additional project context.")


class GeopoliticalRequest(BaseModel):
    topic: str = Field(
        ...,
        example="Chinese investment in DRC infrastructure vs. Western alternatives",
    )
    countries: Optional[list[str]] = Field(
        default=None,
        description="Countries or regions to focus on.",
    )


class AIResponse(BaseModel):
    success: bool
    analysis: str
    prompt_used: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _run_analysis(
    prompt_name: str,
    variables: dict[str, Any],
    system_prompt: str,
    max_tokens: int = 2000,
) -> AIResponse:
    """Load prompt, inject data, call Claude, return structured response."""
    import json

    # Serialize any dict values to JSON strings for prompt injection
    serialized = {
        k: json.dumps(v, indent=2) if isinstance(v, (dict, list)) else str(v)
        for k, v in variables.items()
    }

    try:
        populated_prompt = build_prompt(prompt_name, serialized)
    except FileNotFoundError as exc:
        logger.error("Prompt not found: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prompt template error: {exc}",
        )

    try:
        result = await call_claude_structured(
            prompt=populated_prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
        )
    except Exception as exc:
        logger.error("Claude API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Intelligence generation failed. Please try again.",
        )

    return AIResponse(success=True, analysis=result, prompt_used=prompt_name)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/analyze-project",
    response_model=AIResponse,
    summary="Full infrastructure project analysis",
)
async def analyze_project(request: ProjectAnalysisRequest):
    """
    Generate a comprehensive AI intelligence brief for an infrastructure project.
    Covers strategic importance, financing, geopolitics, trade impact, risks, and
    investment opportunity.
    """
    return await _run_analysis(
        prompt_name="infrastructure_project_analysis",
        variables={"project_data": request.project_data},
        system_prompt=INFRASTRUCTURE_ANALYST_SYSTEM,
        max_tokens=2500,
    )


@router.post(
    "/investment-brief",
    response_model=AIResponse,
    summary="Investor-grade project brief",
)
async def investment_brief(request: InvestmentBriefRequest):
    """
    Generate a concise investor-grade brief covering deal structure,
    financial profile, risk/return matrix, and next steps.
    """
    return await _run_analysis(
        prompt_name="investor_summary",
        variables={
            "project_data": request.project_data,
            "investor_type": request.investor_type,
        },
        system_prompt=INVESTMENT_INTELLIGENCE_SYSTEM,
        max_tokens=2000,
    )


@router.post(
    "/country-analysis",
    response_model=AIResponse,
    summary="Country infrastructure and investment profile",
)
async def country_analysis(request: CountryAnalysisRequest):
    """
    Produce a comprehensive country brief covering infrastructure overview,
    investment climate, key financiers, strategic corridors, and sector deep-dive.
    """
    return await _run_analysis(
        prompt_name="country_investment_brief",
        variables={
            "country": request.country,
            "sector": request.sector,
            "context": request.context or "General infrastructure investment landscape",
        },
        system_prompt=IFNSRASTRUCTURE_ANALYST_SYSTEM,
        max_tokens=2500,
    )


@router.post(
    "/podcast-prep",
    response_model=AIResponse,
    summary="Ground Truth Podcast episode preparation",
)
async def podcast_prep(request: PodcastPrepRequest):
    """
    Generate structured podcast preparation materials: guest profile,
    episode context, discussion questions, and host reference terms.
    """
    return await _run_analysis(
        prompt_name="podcast_question_generator",
        variables={
            "guest_name": request.guest_name,
            "guest_organisation": request.guest_organisation,
            "episode_theme": request.episode_theme,
            "background_notes": request.background_notes or "No additional notes provided.",
        },
        system_prompt=PODCAST_INTELLIGENCE_SYSTEM,
        max_tokens=2000,
    )


@router.post(
    "/infrastructure-risk",
    response_model=AIResponse,
    summary="Infrastructure project risk assessment",
)
async def infrastructure_risk(request: RiskAssessmentRequest):
    """
    Conduct a structured risk assessment across political, financial, construction,
    social, and environmental dimensions with a mitigation framework.
    """
    return await _run_analysis(
        prompt_name="infrastructure_risk_assessment",
        variables={
            "project_name": request.project_name,
            "country_region": request.country_region,
            "sector": request.sector,
            "project_stage": request.project_stage,
            "context": request.context or "No additional context provided.",
        },
        system_prompt=INFRASTRUCTURE_ANALYST_SYSTEM,
        max_tokens=2500,
    )


@router.post(
    "/geopolitical",
    response_model=AIResponse,
    summary="Geopolitical analysis of infrastructure investment dynamics",
)
async def geopolitical_analysis(request: GeopoliticalRequest):
    """
    Analyse geopolitical dynamics in African infrastructure: China vs. Western
    investment, sovereignty, conditionality, and strategic implications.
    """
    countries_str = ", ".join(request.countries) if request.countries else "Africa broadly"
    prompt = (
        f"Provide a detailed geopolitical analysis of the following topic:\n\n"
        f"TOPIC: {request.topic}\n\n"
        f"GEOGRAPHIC FOCUS: {countries_str}\n\n"
        f"Cover: (1) China vs. Western investment dynamics, "
        f"(2) sovereignty and conditionality issues, "
        f"(3) regional integration implications, "
        f"(4) strategic recommendations for African governments and investors."
    )

    try:
        result = await call_claude_structured(
            prompt=prompt,
            system_prompt=GEOPOLITICS_SYSTEM,
            max_tokens=2000,
        )
    except Exception as exc:
        logger.error("Claude API error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Geopolitical analysis failed. Please try again.",
        )

    return AIResponse(success=True, analysis=result)


@router.get(
    "/prompts",
    summary="List available prompt templates",
)
async def list_prompts():
    """
    Return all available prompt template names in the AIP prompt library.
    """
    prompts = list_available_prompts()
    return {"success": True, "prompts": prompts, "count": len(prompts)}
