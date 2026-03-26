"""
AIP Infrastructure Radar Router
=================================
AI-powered infrastructure intelligence engine — code-named Kazi.
Continuously monitors signals of infrastructure activity across Africa.

Endpoints:
    GET  /api/radar                     Latest radar scan results
    POST /api/radar/scan                Trigger a new radar scan (AI-powered)
    POST /api/radar/country/{country}   Generate country risk brief
    GET  /api/radar/sectors             Sector activity summary
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AiAnalysis, InfrastructureProject, User
from backend.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/radar", tags=["Infrastructure Radar"])


AFRICAN_COUNTRIES = [
    "Nigeria", "Kenya", "South Africa", "Egypt", "Ethiopia", "Ghana",
    "Tanzania", "Angola", "Mozambique", "Senegal", "Rwanda", "Uganda",
    "Zambia", "Morocco", "Tunisia", "Ivory Coast", "Cameroon", "DRC",
    "Guinea", "Mali", "Niger", "Sudan", "Zimbabwe", "Botswana", "Namibia",
]

SECTORS = ["energy", "transport", "water_sanitation", "agriculture", "tmt", "social"]


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class CountryRiskRequest(BaseModel):
    context: Optional[str] = None


class RadarScanRequest(BaseModel):
    focus_countries: Optional[list[str]] = None
    focus_sectors:   Optional[list[str]] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/results")
async def get_radar_results(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return the latest stored radar intelligence outputs."""
    analyses = (
        db.query(AiAnalysis)
        .filter(AiAnalysis.analysis_type.in_(["radar_signal", "country_risk", "sector"]))
        .order_by(AiAnalysis.generated_at.desc())
        .limit(20)
        .all()
    )

    country_risk  = [a for a in analyses if a.analysis_type == "country_risk"]
    radar_signals = [a for a in analyses if a.analysis_type == "radar_signal"]
    sector_briefs = [a for a in analyses if a.analysis_type == "sector"]

    return {
        "last_updated":    str(analyses[0].generated_at) if analyses else None,
        "country_risk":    [
            {
                "entity_id":  a.entity_id,
                "content":    a.content[:500] + "…" if a.content and len(a.content) > 500 else a.content,
                "generated_at": str(a.generated_at),
            }
            for a in country_risk[:5]
        ],
        "radar_signals":   [
            {
                "id":           a.id,
                "content":      a.content[:300] + "…" if a.content and len(a.content) > 300 else a.content,
                "generated_at": str(a.generated_at),
            }
            for a in radar_signals[:5]
        ],
        "sector_briefs":   [
            {
                "entity_id":    a.entity_id,
                "content":      a.content[:300] + "…" if a.content and len(a.content) > 300 else a.content,
                "generated_at": str(a.generated_at),
            }
            for a in sector_briefs[:5]
        ],
    }


@router.post("/country/{country}")
async def country_risk_brief(
    country:      str,
    payload:      CountryRiskRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Generate an on-demand country risk brief using Claude.
    Covers political stability, regulatory environment, FX risk,
    legal framework for PPP, and DFI presence.
    """
    from backend.services.aip_claude_service import generate_country_risk

    logger.info("Country risk brief requested | country=%s", country)
    content = await generate_country_risk(country, payload.context)

    # Store result
    analysis = AiAnalysis(
        analysis_type = "country_risk",
        entity_type   = "country",
        entity_id     = country,
        content       = content,
        model_version = "claude-sonnet-4-5",
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return {
        "country":    country,
        "brief":      content,
        "analysis_id":analysis.id,
        "generated_at":str(analysis.generated_at),
    }


@router.post("/scan")
async def trigger_radar_scan(
    payload:      RadarScanRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Trigger a radar scan — Claude scans for infrastructure signals
    across specified countries and sectors.
    """
    from backend.services.aip_claude_service import generate_radar_scan

    countries = payload.focus_countries or AFRICAN_COUNTRIES[:10]
    sectors   = payload.focus_sectors   or SECTORS

    logger.info("Radar scan triggered | countries=%d sectors=%d", len(countries), len(sectors))
    content = await generate_radar_scan(countries, sectors)

    analysis = AiAnalysis(
        analysis_type = "radar_signal",
        entity_type   = "platform",
        content       = content,
        model_version = "claude-sonnet-4-5",
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return {
        "scan_id":      analysis.id,
        "content":      content,
        "countries":    countries,
        "sectors":      sectors,
        "generated_at": str(analysis.generated_at),
    }


@router.get("/sectors")
async def sector_summary(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return a project count and activity summary by sector."""
    result = []
    for sector in SECTORS:
        count = db.query(InfrastructureProject).filter(
            InfrastructureProject.sector.ilike(f"%{sector.replace('_', ' ')}%")
        ).count()
        result.append({
            "sector": sector,
            "project_count": count,
        })
    return {"sectors": result}


# ── Root route fix ─────────────────────────────────────
@router.get("", tags=["Radar"])
async def radar_root(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List radar scan results."""
    from backend.models import InfrastructureProject
    projects = db.query(InfrastructureProject).limit(50).all()
    return {"radar_results": projects, "count": len(projects)}


@router.get("", tags=["Infrastructure Radar"])
async def radar_root(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Radar root — latest results."""
    from backend.models import InfrastructureProject
    try:
        projects = db.query(InfrastructureProject).limit(20).all()
        return {
            "radar_results": [{"id": str(p.id), "name": p.project_name, "country": p.country} for p in projects],
            "count": len(projects),
            "engine": "Kazi v1"
        }
    except Exception as e:
        return {"radar_results": [], "count": 0, "note": str(e)}
