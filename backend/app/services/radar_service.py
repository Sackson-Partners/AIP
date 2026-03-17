"""
Radar Intelligence Service
Handles signal analysis and AI-powered project intelligence generation using Claude API.
"""

import os
import json
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime
from dataclasses import dataclass

# Anthropic SDK for Claude API
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


@dataclass
class RadarAnalysisResult:
    """Result of radar signal analysis."""
    project_name: str
    summary: str
    sector: str
    sub_sector: Optional[str]
    primary_country: str
    countries: List[str]
    region: str
    estimated_investment_usd: Optional[float]
    investment_range: str
    investment_readiness: str
    strategic_importance: str
    regional_impact: str
    investment_opportunity: str
    risk_factors: List[Dict[str, Any]]
    key_stakeholders: List[Dict[str, Any]]
    draft_article: str
    podcast_suggestion: str
    confidence_score: float
    processing_time_ms: int


class RadarIntelligenceService:
    """Service for radar signal detection and AI-powered analysis."""

    ANALYSIS_PROMPT = """You are an expert infrastructure analyst specializing in African infrastructure development.
Analyze the following signal about an infrastructure project and provide a comprehensive intelligence assessment.

Signal Title: {title}
Source: {source_name} ({source_type})
Content: {content}

Provide your analysis in the following JSON format:
{{
    "project_name": "Official or descriptive name of the project",
    "summary": "2-3 sentence executive summary",
    "sector": "One of: Transport | Energy | Mining Logistics | Ports | Digital Infrastructure | Water | Urban Development",
    "sub_sector": "More specific classification (e.g., Railway, Solar, Port expansion)",
    "primary_country": "Main country where project is located",
    "countries": ["List of all countries involved"],
    "region": "One of: West Africa | East Africa | Central Africa | Southern Africa | North Africa",
    "estimated_investment_usd": null or number (in USD),
    "investment_range": "One of: $100M+ | $500M+ | $1B+ | $5B+ | $10B+",
    "investment_readiness": "One of: early_stage | feasibility | tender_open | financing_sought | under_construction | operational",
    "strategic_importance": "Detailed paragraph on why this project matters strategically",
    "regional_impact": "Detailed paragraph on regional economic and development impact",
    "investment_opportunity": "Detailed paragraph for potential investors - opportunities and considerations",
    "risk_factors": [
        {{"category": "political|financial|execution|regulatory|environmental", "description": "...", "severity": "high|medium|low"}}
    ],
    "key_stakeholders": [
        {{"name": "...", "role": "sponsor|contractor|financier|government|operator", "details": "..."}}
    ],
    "draft_article": "A 300-500 word draft article suitable for AIP publication, written in professional journalism style",
    "podcast_suggestion": "A suggested podcast topic and 3-5 discussion points based on this project"
}}

Focus on accuracy and actionable intelligence. If information is uncertain, indicate this clearly."""

    INTELLIGENCE_BRIEF_PROMPT = """You are an expert infrastructure analyst. Generate a strategic intelligence brief for the following project.

Project: {name}
Sector: {sector}
Location: {country}
Investment Size: {investment_usd}
Description: {description}

Generate a comprehensive intelligence brief in JSON format:
{{
    "executive_summary": "2-3 sentence strategic overview",
    "strategic_importance": {{
        "rating": "critical|high|medium|low",
        "analysis": "Detailed strategic importance analysis"
    }},
    "investment_opportunity": {{
        "attractiveness": "highly attractive|attractive|moderate|challenging",
        "key_factors": ["List of key investment factors"],
        "recommended_investor_types": ["DFI", "Private Equity", "Strategic", etc.],
        "analysis": "Detailed investment opportunity analysis"
    }},
    "regional_impact": {{
        "economic_impact": "Description of economic impact",
        "connectivity_impact": "Description of regional connectivity improvements",
        "development_impact": "Description of development outcomes"
    }},
    "risk_assessment": {{
        "overall_risk": "high|medium|low",
        "risks": [
            {{"category": "...", "description": "...", "mitigation": "..."}}
        ]
    }},
    "key_milestones": ["List of expected milestones"],
    "related_projects": ["List of related infrastructure projects in the region"]
}}"""

    def __init__(
        self,
        anthropic_api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-20250514"
    ):
        self.anthropic_api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = model
        self.client = None

        if ANTHROPIC_AVAILABLE and self.anthropic_api_key:
            self.client = anthropic.Anthropic(api_key=self.anthropic_api_key)

    def _generate_content_hash(self, content: str) -> str:
        """Generate a hash for content deduplication."""
        return hashlib.sha256(content.encode()).hexdigest()

    async def analyze_signal(
        self,
        title: str,
        content: str,
        source_name: str,
        source_type: str = "media"
    ) -> RadarAnalysisResult:
        """
        Analyze a radar signal using Claude API.

        Args:
            title: Signal title/headline
            content: Full signal content
            source_name: Name of the source
            source_type: Type of source (government, dfi, corporate, media)

        Returns:
            RadarAnalysisResult with comprehensive analysis
        """
        import time
        start_time = time.time()

        prompt = self.ANALYSIS_PROMPT.format(
            title=title,
            source_name=source_name,
            source_type=source_type,
            content=content
        )

        if self.client:
            # Call Claude API
            try:
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    messages=[
                        {"role": "user", "content": prompt}
                    ]
                )
                response_text = message.content[0].text

                # Parse JSON from response
                # Handle potential markdown code blocks
                if "```json" in response_text:
                    json_start = response_text.find("```json") + 7
                    json_end = response_text.find("```", json_start)
                    response_text = response_text[json_start:json_end].strip()
                elif "```" in response_text:
                    json_start = response_text.find("```") + 3
                    json_end = response_text.find("```", json_start)
                    response_text = response_text[json_start:json_end].strip()

                analysis = json.loads(response_text)
                confidence = 0.85

            except (json.JSONDecodeError, anthropic.APIError) as e:
                # Fallback to simulated response
                analysis = self._get_simulated_analysis(title, content, source_name)
                confidence = 0.5
        else:
            # Use simulated response when API not available
            analysis = self._get_simulated_analysis(title, content, source_name)
            confidence = 0.5

        processing_time = int((time.time() - start_time) * 1000)

        return RadarAnalysisResult(
            project_name=analysis.get("project_name", title),
            summary=analysis.get("summary", ""),
            sector=analysis.get("sector", "Transport"),
            sub_sector=analysis.get("sub_sector"),
            primary_country=analysis.get("primary_country", "Unknown"),
            countries=analysis.get("countries", []),
            region=analysis.get("region", ""),
            estimated_investment_usd=analysis.get("estimated_investment_usd"),
            investment_range=analysis.get("investment_range", "$100M+"),
            investment_readiness=analysis.get("investment_readiness", "early_stage"),
            strategic_importance=analysis.get("strategic_importance", ""),
            regional_impact=analysis.get("regional_impact", ""),
            investment_opportunity=analysis.get("investment_opportunity", ""),
            risk_factors=analysis.get("risk_factors", []),
            key_stakeholders=analysis.get("key_stakeholders", []),
            draft_article=analysis.get("draft_article", ""),
            podcast_suggestion=analysis.get("podcast_suggestion", ""),
            confidence_score=confidence,
            processing_time_ms=processing_time
        )

    async def generate_intelligence_brief(
        self,
        name: str,
        sector: str,
        country: str,
        investment_usd: Optional[float],
        description: str
    ) -> Dict[str, Any]:
        """
        Generate a detailed intelligence brief for a project.

        Args:
            name: Project name
            sector: Project sector
            country: Primary country
            investment_usd: Investment amount in USD
            description: Project description

        Returns:
            Dict with intelligence brief data
        """
        import time
        start_time = time.time()

        prompt = self.INTELLIGENCE_BRIEF_PROMPT.format(
            name=name,
            sector=sector,
            country=country,
            investment_usd=f"${investment_usd:,.0f}" if investment_usd else "Not specified",
            description=description or "No detailed description available"
        )

        if self.client:
            try:
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    messages=[
                        {"role": "user", "content": prompt}
                    ]
                )
                response_text = message.content[0].text

                # Parse JSON from response
                if "```json" in response_text:
                    json_start = response_text.find("```json") + 7
                    json_end = response_text.find("```", json_start)
                    response_text = response_text[json_start:json_end].strip()
                elif "```" in response_text:
                    json_start = response_text.find("```") + 3
                    json_end = response_text.find("```", json_start)
                    response_text = response_text[json_start:json_end].strip()

                brief = json.loads(response_text)

            except (json.JSONDecodeError, anthropic.APIError):
                brief = self._get_simulated_brief(name, sector, country, investment_usd)
        else:
            brief = self._get_simulated_brief(name, sector, country, investment_usd)

        processing_time = int((time.time() - start_time) * 1000)

        return {
            "brief": brief,
            "processing_time_ms": processing_time,
            "generated_at": datetime.utcnow().isoformat()
        }

    def _get_simulated_analysis(
        self,
        title: str,
        content: str,
        source_name: str
    ) -> Dict[str, Any]:
        """Generate simulated analysis for demo/testing."""
        return {
            "project_name": title,
            "summary": f"Infrastructure project detected from {source_name}. Analysis pending full API integration.",
            "sector": "Transport",
            "sub_sector": "Railway",
            "primary_country": "Kenya",
            "countries": ["Kenya"],
            "region": "East Africa",
            "estimated_investment_usd": None,
            "investment_range": "$100M+",
            "investment_readiness": "early_stage",
            "strategic_importance": "This project has been detected through the AIP radar system and requires further analysis.",
            "regional_impact": "Regional impact assessment pending detailed analysis.",
            "investment_opportunity": "Investment opportunity analysis pending.",
            "risk_factors": [
                {"category": "execution", "description": "Standard project execution risks", "severity": "medium"}
            ],
            "key_stakeholders": [],
            "draft_article": f"# {title}\n\nA new infrastructure development has been identified. Further details are being gathered.",
            "podcast_suggestion": f"Discussion topic: {title} - implications for regional development"
        }

    def _get_simulated_brief(
        self,
        name: str,
        sector: str,
        country: str,
        investment_usd: Optional[float]
    ) -> Dict[str, Any]:
        """Generate simulated intelligence brief for demo/testing."""
        return {
            "executive_summary": f"{name} is a significant {sector.lower()} infrastructure project in {country}.",
            "strategic_importance": {
                "rating": "high",
                "analysis": f"This {sector.lower()} project in {country} represents a strategic infrastructure investment for the region."
            },
            "investment_opportunity": {
                "attractiveness": "attractive",
                "key_factors": [
                    "Strategic location",
                    "Government support",
                    "Regional connectivity improvements"
                ],
                "recommended_investor_types": ["DFI", "Infrastructure Funds", "Strategic Investors"],
                "analysis": "The project presents attractive investment characteristics for long-term infrastructure investors."
            },
            "regional_impact": {
                "economic_impact": "Expected to contribute significantly to regional GDP growth.",
                "connectivity_impact": "Will improve regional transportation and logistics efficiency.",
                "development_impact": "Expected to create jobs and stimulate local economic development."
            },
            "risk_assessment": {
                "overall_risk": "medium",
                "risks": [
                    {
                        "category": "political",
                        "description": "Political stability considerations",
                        "mitigation": "Engage with multiple government stakeholders"
                    },
                    {
                        "category": "execution",
                        "description": "Large-scale project execution complexity",
                        "mitigation": "Partner with experienced EPC contractors"
                    }
                ]
            },
            "key_milestones": [
                "Feasibility study completion",
                "Environmental impact assessment",
                "Financial close",
                "Construction commencement",
                "Operational launch"
            ],
            "related_projects": []
        }

    def classify_investment_range(self, amount_usd: Optional[float]) -> str:
        """Classify investment amount into standardized ranges."""
        if amount_usd is None:
            return "Unknown"
        if amount_usd >= 10_000_000_000:
            return "$10B+"
        elif amount_usd >= 5_000_000_000:
            return "$5B+"
        elif amount_usd >= 1_000_000_000:
            return "$1B+"
        elif amount_usd >= 500_000_000:
            return "$500M+"
        elif amount_usd >= 100_000_000:
            return "$100M+"
        else:
            return "<$100M"

    def classify_region(self, countries: List[str]) -> str:
        """Classify region based on countries."""
        region_mapping = {
            "West Africa": ["Nigeria", "Ghana", "Senegal", "Cote d'Ivoire", "Mali", "Burkina Faso",
                          "Niger", "Guinea", "Benin", "Togo", "Sierra Leone", "Liberia", "Gambia",
                          "Guinea-Bissau", "Cape Verde", "Mauritania"],
            "East Africa": ["Kenya", "Tanzania", "Uganda", "Rwanda", "Burundi", "Ethiopia",
                          "Somalia", "Djibouti", "Eritrea", "South Sudan"],
            "Central Africa": ["DRC", "Congo", "Cameroon", "Chad", "Central African Republic",
                              "Gabon", "Equatorial Guinea", "Sao Tome and Principe"],
            "Southern Africa": ["South Africa", "Zimbabwe", "Zambia", "Botswana", "Namibia",
                               "Mozambique", "Malawi", "Angola", "Lesotho", "Eswatini", "Madagascar"],
            "North Africa": ["Egypt", "Morocco", "Algeria", "Tunisia", "Libya", "Sudan"]
        }

        for region, region_countries in region_mapping.items():
            for country in countries:
                if country in region_countries:
                    return region

        return "Africa"


# Singleton instance
radar_service = RadarIntelligenceService()
