"""
AIP Claude Intelligence Service — Kazi Engine
===============================================
Specialized AI agents for the AIP platform:

  Agent 1 — PETFEL Augmentation
  Agent 2 — EIN Generator (9 sections)
  Agent 3 — Country Risk Intelligence
  Agent 4 — Infrastructure Radar
  Agent 5 — Project Analysis

All calls route through the existing claude_service.call_claude / call_claude_structured.
"""

import json
import logging
from typing import Any, Optional

from backend.services.claude_service import call_claude, call_claude_structured

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# System Prompts
# ---------------------------------------------------------------------------


EIN_SYSTEM_PROMPT = """You are a senior infrastructure investment analyst at a top-tier development
finance institution (DFI) focused on Africa. You write professional investment committee notes
with the precision of a World Bank project appraisal document and the clarity of a McKinsey
executive brief.

Your mandate:
- Produce investor-grade analysis — authoritative, data-driven, balanced on risks and mitigations
- Use the AIP EIN 9-section template structure
- Tone: institutional, formal, evidence-based. Never speculative without flagging assumptions
- Format: Markdown with ## section headers
- Flag all gaps and missing evidence explicitly
- Recommend specific actions with owners and deadlines

AIP EIN Sections:
0 = Cover & Executive Summary
1 = Strategy Perspective
2 = Political Perspective
3 = Economic Perspective
4 = Financial Perspective
5 = Legal & Regulatory Perspective
6 = Risk Register & Mitigation Plan
7 = Required Next Steps (30/60/90 Days)
8 = Annexes (brief index only)
"""

PETFEL_SYSTEM_PROMPT = """You are a specialist infrastructure due diligence analyst applying the
PETFEL framework (Political, Economic, Technical, Financial, Environmental, Legal).

Your role:
- Augment qualitative risk narratives for each sub-criterion based on analyst scores and evidence
- Identify gaps the analyst may have missed
- Generate the overall PETFEL recommendation in DFI language
- Be precise about gating risks — land rights, legal mandate, offtake credibility, EIA/RAP

Output JSON format:
{
  "recommendation": "<1-paragraph overall PETFEL recommendation>",
  "analysis": {
    "political": "<narrative>",
    "economic": "<narrative>",
    "technical": "<narrative>",
    "financial": "<narrative>",
    "environmental": "<narrative>",
    "legal": "<narrative>"
  },
  "gating_risks": ["<list of gating issues if any>"],
  "priority_actions": ["<top 5 actions with owners>"]
}
"""

COUNTRY_RISK_SYSTEM_PROMPT = """You are a country risk specialist for African infrastructure investment.
Write concise, actionable country risk briefs for institutional investors and DFIs.

Cover:
1. Political stability and governance (3-5 sentences)
2. Regulatory/PPP framework (3-5 sentences)
3. FX, currency, and macro risk (3-5 sentences)
4. Legal framework and contract enforcement (3-5 sentences)
5. DFI and development finance presence (2-3 sentences)
6. Recent material events affecting infrastructure (2-3 bullets)
7. AIP investment outlook: GO / CAUTION / WATCH (1 sentence + rationale)

Be specific, data-referenced where possible. Flag if information is from general knowledge
vs real-time data. Maximum 600 words.
"""

RADAR_SYSTEM_PROMPT = """You are the AIP Infrastructure Radar — code-named Kazi.
You monitor infrastructure investment signals across Africa for an institutional platform.

Generate a structured intelligence report covering:
1. Active project pipeline signals (new tenders, PPP announcements, financing closes)
2. Corridor and hub developments by region
3. Sector-specific momentum signals (energy transitions, port expansions, digital infra)
4. DFI/multilateral financing signals
5. Watch list: projects transitioning from planning to bankable

Format: Markdown with ## headers. Be specific about countries and projects.
Clearly label speculative signals vs confirmed announcements.
Maximum 800 words.
"""

INFRASTRUCTURE_ANALYST_SYSTEM = """You are a senior infrastructure analyst at AIP —
African Infrastructure Partners. Provide institutional-grade analysis for the Africa market."""


# ---------------------------------------------------------------------------
# Agent 1 — PETFEL Augmentation
# ---------------------------------------------------------------------------


async def augment_petfel(scorecard: list[dict[str, Any]]) -> dict:
    """
    Claude augments a PETFEL scorecard with qualitative narratives,
    identifies gaps, and generates an overall recommendation.
    """
    scorecard_text = "\n".join([
        f"[{s.get('pillar','').upper()}] {s.get('sub_criterion','')} — "
        f"Score: {s.get('score','N/A')}/5 | Evidence: {s.get('evidence_notes','None provided')}"
        for s in scorecard
    ])

    prompt = f"""Analyse the following PETFEL scorecard for an African infrastructure project.

SCORECARD:
{scorecard_text}

Provide your augmentation in the specified JSON format.
Focus on:
- What the scores tell us about bankability readiness
- Where evidence is missing or insufficient
- Top gating risks that could block investment
- Priority actions to move the project to PETFEL Rating B or above"""

    try:
        raw = await call_claude_structured(
            prompt       = prompt,
            system_prompt= PETFEL_SYSTEM_PROMPT,
            max_tokens   = 2500,
        )
        # Try parsing as JSON
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Return as plain text wrapped in structure
            return {"recommendation": raw, "analysis": {}, "gating_risks": [], "priority_actions": []}
    except Exception as exc:
        logger.exception("PETFEL augmentation failed: %s", exc)
        return {
            "recommendation": f"AI augmentation unavailable: {exc}",
            "analysis": {},
            "gating_risks": [],
            "priority_actions": [],
        }


# ---------------------------------------------------------------------------
# Agent 2 — EIN Generator
# ---------------------------------------------------------------------------


async def generate_ein_sections(
    project_context: dict[str, Any],
    petfel_context:  dict[str, Any],
) -> dict[str, str]:
    """
    Generate all 9 EIN sections using Claude.
    Returns dict keyed section_0 … section_8.
    """
    project_summary = "\n".join([f"  {k}: {v}" for k, v in project_context.items() if v])
    petfel_summary  = "\n".join([f"  {k}: {v}" for k, v in petfel_context.items() if v])

    prompt = f"""Generate a complete Executive Investment Note (EIN) for the following project.

PROJECT INFORMATION:
{project_summary}

PETFEL DUE DILIGENCE RESULTS:
{petfel_summary}

Write each section using the AIP EIN template. Structure your output with clear ## headers
matching each section name (e.g. ## Section 0: Cover & Executive Summary).
Use institutional DFI language. Be precise about risks and mitigations.
Total target length: 1,200–1,600 words for Sections 0–7.
Section 8 (Annexes) should be a brief index only."""

    try:
        raw = await call_claude_structured(
            prompt       = prompt,
            system_prompt= EIN_SYSTEM_PROMPT,
            max_tokens   = 4000,
        )
    except Exception as exc:
        logger.exception("EIN generation failed: %s", exc)
        raw = f"## EIN Generation Error\n\nAI generation failed: {exc}"

    # Parse sections by header
    sections: dict[str, str] = {}
    section_map = {
        "section 0": "section_0", "cover": "section_0",
        "section 1": "section_1", "strategy": "section_1",
        "section 2": "section_2", "political": "section_2",
        "section 3": "section_3", "economic": "section_3",
        "section 4": "section_4", "financial": "section_4",
        "section 5": "section_5", "legal": "section_5",
        "section 6": "section_6", "risk register": "section_6",
        "section 7": "section_7", "next steps": "section_7",
        "section 8": "section_8", "annexes": "section_8",
    }

    current_key   = "section_0"
    current_lines: list[str] = []

    for line in raw.split("\n"):
        line_lower = line.lower().strip("# ").strip()
        matched = False
        for trigger, key in section_map.items():
            if trigger in line_lower:
                if current_lines:
                    sections[current_key] = "\n".join(current_lines).strip()
                current_key   = key
                current_lines = [line]
                matched       = True
                break
        if not matched:
            current_lines.append(line)

    if current_lines:
        sections[current_key] = "\n".join(current_lines).strip()

    # Ensure all 9 sections exist
    for i in range(9):
        if f"section_{i}" not in sections:
            sections[f"section_{i}"] = ""

    return sections


# ---------------------------------------------------------------------------
# Agent 3 — Country Risk Intelligence
# ---------------------------------------------------------------------------


async def generate_country_risk(country: str, context: Optional[str] = None) -> str:
    """Generate a country risk brief for an African country."""
    prompt = f"""Generate a country risk brief for: {country}

Focus on infrastructure investment risk for institutional investors.
{f"Additional context: {context}" if context else ""}

Cover all 7 areas specified in your brief format."""

    try:
        return await call_claude_structured(
            prompt       = prompt,
            system_prompt= COUNTRY_RISK_SYSTEM_PROMPT,
            max_tokens   = 1200,
        )
    except Exception as exc:
        logger.exception("Country risk generation failed: %s", exc)
        return f"Country risk brief generation failed for {country}: {exc}"


# ---------------------------------------------------------------------------
# Agent 4 — Infrastructure Radar
# ---------------------------------------------------------------------------


async def generate_radar_scan(
    countries: list[str],
    sectors:   list[str],
) -> str:
    """Generate a radar scan for specified countries and sectors."""
    prompt = f"""Generate an Infrastructure Radar intelligence report.

Focus countries: {', '.join(countries)}
Focus sectors: {', '.join(sectors)}
Date context: This is a scan of the current African infrastructure investment landscape.

Identify specific signals, projects, and opportunities in these markets.
Distinguish between confirmed pipeline and speculative signals."""

    try:
        return await call_claude_structured(
            prompt       = prompt,
            system_prompt= RADAR_SYSTEM_PROMPT,
            max_tokens   = 1600,
        )
    except Exception as exc:
        logger.exception("Radar scan failed: %s", exc)
        return f"Radar scan failed: {exc}"


# ---------------------------------------------------------------------------
# Agent 5 — Full Project Analysis
# ---------------------------------------------------------------------------


async def analyze_project(project_data: dict[str, Any]) -> str:
    """Generate a full AI analysis for a project."""
    project_text = "\n".join([f"  {k}: {v}" for k, v in project_data.items() if v])

    prompt = f"""Provide a comprehensive intelligence analysis for this African infrastructure project.

PROJECT DATA:
{project_text}

Analyse:
1. Strategic fit and investment thesis
2. Key bankability risks and mitigations
3. Market context and competitive dynamics
4. Recommended transaction structure
5. Next steps for AIP to advance this project

Be specific and actionable. Flag all information gaps."""

    try:
        return await call_claude_structured(
            prompt       = prompt,
            system_prompt= INFRASTRUCTURE_ANALYST_SYSTEM,
            max_tokens   = 2000,
        )
    except Exception as exc:
        logger.exception("Project analysis failed: %s", exc)
        return f"Project analysis failed: {exc}"
