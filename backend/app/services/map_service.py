"""
Strategic Intelligence Map Service
Handles map data processing and AI-powered intelligence brief generation using Claude API.
"""

import os
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from decimal import Decimal

# Anthropic SDK for Claude API
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


@dataclass
class BriefGenerationResult:
    """Result of intelligence brief generation."""
    executive_summary: str
    strategic_importance: Dict[str, Any]
    investment_opportunity: Dict[str, Any]
    regional_impact: Dict[str, Any]
    risk_assessment: Dict[str, Any]
    key_milestones: List[str]
    related_projects: List[str]
    confidence_score: float
    processing_time_ms: int


class MapIntelligenceService:
    """Service for map intelligence brief generation using Claude API."""

    BRIEF_PROMPT = """You are an expert infrastructure analyst specializing in African infrastructure development.
Generate a comprehensive strategic intelligence brief for the following infrastructure project.

Project Details:
- Name: {name}
- Sector: {sector}
- Sub-sector: {sub_sector}
- Location: {location_name}, {country}
- Region: {region}
- Investment Size: {investment_usd}
- Status: {status}
- Development Phase: {development_phase}
- Sponsor: {sponsor}
- Description: {description}

Provide your intelligence brief in the following JSON format:
{{
    "executive_summary": "2-3 sentence strategic overview highlighting key points for decision-makers",
    "strategic_importance": {{
        "rating": "critical|high|medium|low",
        "analysis": "Detailed analysis of the project's strategic importance to the region and continent (200-300 words)",
        "key_factors": ["List of 3-5 key strategic factors"]
    }},
    "investment_opportunity": {{
        "attractiveness": "highly attractive|attractive|moderate|challenging",
        "key_factors": ["List of 5-7 key investment considerations"],
        "recommended_investor_types": ["DFI", "Private Equity", "Strategic", "Infrastructure Fund", etc.],
        "estimated_returns": "Commentary on expected return profile",
        "analysis": "Detailed investment opportunity analysis (200-300 words)"
    }},
    "regional_impact": {{
        "economic_impact": "Description of economic impact on the region",
        "connectivity_impact": "Description of how this improves regional connectivity",
        "development_impact": "Description of broader development outcomes",
        "job_creation_estimate": "Estimated jobs created (construction and operational)",
        "beneficiary_population": "Estimated population that will benefit"
    }},
    "risk_assessment": {{
        "overall_risk": "high|medium|low",
        "risks": [
            {{
                "category": "political|financial|execution|regulatory|environmental|social",
                "description": "Description of the risk",
                "severity": "high|medium|low",
                "likelihood": "high|medium|low",
                "mitigation": "Recommended mitigation strategy"
            }}
        ]
    }},
    "key_milestones": [
        "List of 5-8 expected project milestones with approximate timing"
    ],
    "related_projects": [
        "List of 3-5 related infrastructure projects in the region"
    ]
}}

Focus on providing actionable intelligence for investors, policymakers, and development stakeholders.
Be specific about the African context and regional dynamics."""

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

    async def generate_intelligence_brief(
        self,
        name: str,
        sector: str,
        sub_sector: Optional[str],
        country: str,
        region: Optional[str],
        location_name: Optional[str],
        investment_usd: Optional[float],
        status: str,
        development_phase: Optional[str],
        sponsor: Optional[str],
        description: Optional[str]
    ) -> BriefGenerationResult:
        """
        Generate a comprehensive intelligence brief for a map project.

        Args:
            name: Project name
            sector: Project sector
            sub_sector: Project sub-sector
            country: Primary country
            region: Geographic region
            location_name: Specific location
            investment_usd: Investment amount in USD
            status: Project status
            development_phase: Current development phase
            sponsor: Project sponsor
            description: Project description

        Returns:
            BriefGenerationResult with comprehensive intelligence brief
        """
        import time
        start_time = time.time()

        prompt = self.BRIEF_PROMPT.format(
            name=name,
            sector=sector,
            sub_sector=sub_sector or "Not specified",
            country=country,
            region=region or "Not specified",
            location_name=location_name or country,
            investment_usd=f"${investment_usd:,.0f}" if investment_usd else "Not disclosed",
            status=status,
            development_phase=development_phase or "Not specified",
            sponsor=sponsor or "Not disclosed",
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
                confidence = 0.85

            except (json.JSONDecodeError, anthropic.APIError) as e:
                brief = self._get_simulated_brief(
                    name, sector, country, region, investment_usd, status
                )
                confidence = 0.5
        else:
            brief = self._get_simulated_brief(
                name, sector, country, region, investment_usd, status
            )
            confidence = 0.5

        processing_time = int((time.time() - start_time) * 1000)

        return BriefGenerationResult(
            executive_summary=brief.get("executive_summary", ""),
            strategic_importance=brief.get("strategic_importance", {}),
            investment_opportunity=brief.get("investment_opportunity", {}),
            regional_impact=brief.get("regional_impact", {}),
            risk_assessment=brief.get("risk_assessment", {}),
            key_milestones=brief.get("key_milestones", []),
            related_projects=brief.get("related_projects", []),
            confidence_score=confidence,
            processing_time_ms=processing_time
        )

    def _get_simulated_brief(
        self,
        name: str,
        sector: str,
        country: str,
        region: Optional[str],
        investment_usd: Optional[float],
        status: str
    ) -> Dict[str, Any]:
        """Generate simulated brief for demo/testing."""
        investment_str = f"${investment_usd:,.0f}" if investment_usd else "significant"

        return {
            "executive_summary": f"{name} is a strategic {sector.lower()} infrastructure project in {country} with {investment_str} in planned investment. The project represents a significant opportunity for regional development and investor participation.",
            "strategic_importance": {
                "rating": "high",
                "analysis": f"This {sector.lower()} project in {country} represents a critical infrastructure investment for {region or 'the region'}. The project addresses key infrastructure gaps and aligns with continental development priorities under Agenda 2063. Its completion will significantly enhance regional connectivity and economic integration.",
                "key_factors": [
                    "Addresses critical infrastructure gap",
                    "Aligns with continental development priorities",
                    "Supports regional economic integration",
                    "Creates enabling infrastructure for other sectors"
                ]
            },
            "investment_opportunity": {
                "attractiveness": "attractive",
                "key_factors": [
                    "Strategic location with strong demand fundamentals",
                    "Government support and policy alignment",
                    "Potential for DFI co-financing",
                    "Long-term stable revenue potential",
                    "Regional multiplier effects"
                ],
                "recommended_investor_types": [
                    "Development Finance Institutions",
                    "Infrastructure Funds",
                    "Strategic Investors",
                    "Pension Funds (long-term)"
                ],
                "estimated_returns": "Expected to deliver stable, inflation-linked returns typical of infrastructure investments in the region",
                "analysis": f"The {name} project presents an attractive investment opportunity for long-term infrastructure investors. The combination of government support, strategic importance, and potential for DFI participation creates a favorable risk-return profile."
            },
            "regional_impact": {
                "economic_impact": f"Expected to contribute significantly to GDP growth in {country} and surrounding countries through direct investment and economic multiplier effects.",
                "connectivity_impact": "Will improve regional transportation and logistics efficiency, reducing costs and travel times for goods and people.",
                "development_impact": "Expected to catalyze broader economic development through improved access to markets, services, and opportunities.",
                "job_creation_estimate": "Thousands of direct construction jobs and ongoing operational employment",
                "beneficiary_population": "Millions of people across the project corridor"
            },
            "risk_assessment": {
                "overall_risk": "medium",
                "risks": [
                    {
                        "category": "political",
                        "description": "Political stability and policy continuity",
                        "severity": "medium",
                        "likelihood": "medium",
                        "mitigation": "Engage multiple government stakeholders and secure cross-party support"
                    },
                    {
                        "category": "execution",
                        "description": "Large-scale project execution complexity",
                        "severity": "medium",
                        "likelihood": "medium",
                        "mitigation": "Partner with experienced EPC contractors with regional track record"
                    },
                    {
                        "category": "financial",
                        "description": "Currency and financing risks",
                        "severity": "medium",
                        "likelihood": "medium",
                        "mitigation": "Structure with hard currency revenues and DFI participation"
                    },
                    {
                        "category": "regulatory",
                        "description": "Regulatory and permitting delays",
                        "severity": "low",
                        "likelihood": "medium",
                        "mitigation": "Early engagement with regulatory authorities"
                    }
                ]
            },
            "key_milestones": [
                "Feasibility study completion",
                "Environmental and social impact assessment",
                "Regulatory approvals secured",
                "Financial close achieved",
                "Construction commencement",
                "Mid-point construction review",
                "Commissioning and testing",
                "Commercial operations start"
            ],
            "related_projects": [
                f"Other {sector.lower()} projects in {region or country}",
                "Regional corridor development initiatives",
                "Connected infrastructure projects"
            ]
        }

    def convert_to_geojson(
        self,
        projects: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Convert list of map projects to GeoJSON FeatureCollection.

        Args:
            projects: List of project dictionaries

        Returns:
            GeoJSON FeatureCollection
        """
        features = []

        for project in projects:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        float(project.get("longitude", 0)),
                        float(project.get("latitude", 0))
                    ]
                },
                "properties": {
                    "id": project.get("id"),
                    "uuid": project.get("uuid"),
                    "name": project.get("name"),
                    "sector": project.get("sector"),
                    "sub_sector": project.get("sub_sector"),
                    "country": project.get("primary_country"),
                    "region": project.get("region"),
                    "investment_usd": float(project.get("investment_usd", 0)) if project.get("investment_usd") else None,
                    "investment_range": project.get("investment_range"),
                    "status": project.get("status"),
                    "is_featured": project.get("is_featured", False),
                    "marker_color": project.get("marker_color"),
                    "marker_icon": project.get("marker_icon"),
                }
            }

            # Add GeoJSON extent if available
            if project.get("geo_json"):
                feature["properties"]["extent"] = project["geo_json"]

            features.append(feature)

        return {
            "type": "FeatureCollection",
            "features": features
        }

    def get_marker_style(self, sector: str, status: str, is_featured: bool) -> Dict[str, Any]:
        """
        Get marker style based on project attributes.

        Args:
            sector: Project sector
            status: Project status
            is_featured: Whether project is featured

        Returns:
            Marker style dictionary
        """
        # Sector colors
        sector_colors = {
            "Transport": "#3B82F6",  # Blue
            "Energy": "#F59E0B",  # Amber
            "Mining Logistics": "#6B7280",  # Gray
            "Ports": "#06B6D4",  # Cyan
            "Digital Infrastructure": "#8B5CF6",  # Purple
            "Water": "#10B981",  # Green
            "Urban Development": "#EC4899",  # Pink
        }

        # Status opacities
        status_opacity = {
            "planned": 0.6,
            "under_construction": 0.8,
            "operational": 1.0,
            "suspended": 0.4,
        }

        # Sector icons
        sector_icons = {
            "Transport": "rail",
            "Energy": "electricity",
            "Mining Logistics": "industry",
            "Ports": "harbor",
            "Digital Infrastructure": "communications-tower",
            "Water": "water",
            "Urban Development": "building",
        }

        return {
            "color": sector_colors.get(sector, "#6B7280"),
            "opacity": status_opacity.get(status, 0.7),
            "icon": sector_icons.get(sector, "marker"),
            "size": "large" if is_featured else "medium",
            "border": "#FFFFFF" if is_featured else None,
        }

    def calculate_investment_range(self, amount_usd: Optional[float]) -> str:
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


# Featured projects seed data (Part 5.5)
FEATURED_PROJECTS_SEED = [
    {
        "name": "Simandou Railway",
        "description": "Massive iron ore railway project connecting the Simandou iron ore deposit to a new deepwater port. One of the largest mining infrastructure projects ever undertaken in Africa.",
        "primary_country": "Guinea",
        "region": "West Africa",
        "latitude": Decimal("9.5"),
        "longitude": Decimal("-13.7"),
        "location_name": "Simandou - Conakry Corridor",
        "sector": "Transport",
        "sub_sector": "Railway",
        "project_type": "Mining Railway",
        "investment_usd": Decimal("15000000000"),
        "investment_range": "$10B+",
        "status": "under_construction",
        "development_phase": "Construction",
        "sponsor": "Winning Consortium Simandou / Rio Tinto",
        "is_featured": True,
        "display_priority": 100,
    },
    {
        "name": "Grand Inga Hydropower",
        "description": "Phased development of the world's largest hydropower project on the Congo River. Full development could generate 40,000+ MW of clean energy.",
        "primary_country": "DRC",
        "region": "Central Africa",
        "latitude": Decimal("-5.5"),
        "longitude": Decimal("13.6"),
        "location_name": "Inga Falls, Congo River",
        "sector": "Energy",
        "sub_sector": "Hydropower",
        "project_type": "Mega Hydropower",
        "investment_usd": Decimal("80000000000"),
        "investment_range": "$10B+",
        "status": "planned",
        "development_phase": "Feasibility",
        "sponsor": "Government of DRC",
        "is_featured": True,
        "display_priority": 95,
    },
    {
        "name": "LAPSSET Corridor",
        "description": "Lamu Port-South Sudan-Ethiopia Transport Corridor - a multi-modal infrastructure project including port, railway, highway, and pipeline.",
        "primary_country": "Kenya",
        "countries": ["Kenya", "Ethiopia", "South Sudan"],
        "region": "East Africa",
        "latitude": Decimal("-2.3"),
        "longitude": Decimal("40.9"),
        "location_name": "Lamu - Juba - Addis Ababa",
        "sector": "Transport",
        "sub_sector": "Multi-modal",
        "project_type": "Development Corridor",
        "investment_usd": Decimal("25000000000"),
        "investment_range": "$10B+",
        "status": "under_construction",
        "development_phase": "Phased Construction",
        "sponsor": "Government of Kenya / LCDA",
        "is_featured": True,
        "display_priority": 90,
    },
    {
        "name": "Lobito Atlantic Railway",
        "description": "Rehabilitation and extension of the Benguela Railway connecting Angola's Atlantic coast to the DRC and Zambian Copperbelt.",
        "primary_country": "Angola",
        "countries": ["Angola", "DRC", "Zambia"],
        "region": "Southern Africa",
        "latitude": Decimal("-12.3"),
        "longitude": Decimal("13.5"),
        "location_name": "Lobito - Kolwezi - Ndola",
        "sector": "Transport",
        "sub_sector": "Railway",
        "project_type": "Freight Railway",
        "investment_usd": Decimal("5000000000"),
        "investment_range": "$5B+",
        "status": "under_construction",
        "development_phase": "Construction",
        "sponsor": "Lobito Atlantic Railway Consortium",
        "is_featured": True,
        "display_priority": 85,
    },
    {
        "name": "Abidjan Metro",
        "description": "Urban metro system for Abidjan, the economic capital of Cote d'Ivoire. First phase includes 37km of track and 20 stations.",
        "primary_country": "Cote d'Ivoire",
        "region": "West Africa",
        "latitude": Decimal("5.32"),
        "longitude": Decimal("-4.0"),
        "location_name": "Abidjan",
        "sector": "Transport",
        "sub_sector": "Urban Rail",
        "project_type": "Metro",
        "investment_usd": Decimal("1400000000"),
        "investment_range": "$1B+",
        "status": "under_construction",
        "development_phase": "Construction",
        "sponsor": "Government of Cote d'Ivoire",
        "is_featured": True,
        "display_priority": 80,
    },
    {
        "name": "Nacala Corridor",
        "description": "Multi-country railway and port corridor connecting landlocked Zambia and Malawi to the Indian Ocean via Mozambique.",
        "primary_country": "Mozambique",
        "countries": ["Mozambique", "Malawi", "Zambia"],
        "region": "Southern Africa",
        "latitude": Decimal("-14.5"),
        "longitude": Decimal("40.7"),
        "location_name": "Nacala - Lilongwe - Chipata",
        "sector": "Transport",
        "sub_sector": "Railway",
        "project_type": "Development Corridor",
        "investment_usd": Decimal("4400000000"),
        "investment_range": "$1B+",
        "status": "operational",
        "development_phase": "Operational",
        "sponsor": "Vale / Mitsui",
        "is_featured": True,
        "display_priority": 75,
    },
]


# Singleton instance
map_service = MapIntelligenceService()
