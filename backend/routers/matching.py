"""
AIP Investor Matching Router
=============================
Computes a ranked match score for each investor against a project.

Match factors (weights):
  Sector match       30%
  Geography match    25%
  Ticket size        20%
  Risk appetite      15%
  Strategic affinity 10%

Endpoints:
    POST /api/matching/run/{project_id}   Run matching algorithm
    GET  /api/matching/{project_id}       Get ranked match list
    PUT  /api/matching/{match_id}/status  Update engagement status
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    InfrastructureProject,
    Investor,
    InvestorMatch,
    PetfelAssessment,
    User,
)
from backend.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/matching", tags=["Investor Matching"])


# ---------------------------------------------------------------------------
# Scoring Helpers
# ---------------------------------------------------------------------------


def _parse_json_list(field: Optional[str]) -> list[str]:
    if not field:
        return []
    try:
        return json.loads(field)
    except Exception:
        return [field] if isinstance(field, str) else []


def _sector_score(project_sector: Optional[str], investor_sectors: list[str]) -> float:
    if not project_sector or not investor_sectors:
        return 0.0
    sector_lower = project_sector.lower()
    for s in investor_sectors:
        if s.lower() in sector_lower or sector_lower in s.lower():
            return 30.0
    return 0.0


def _geo_score(project_country: Optional[str], investor_regions: list[str]) -> float:
    if not project_country or not investor_regions:
        return 0.0
    country_lower = project_country.lower()
    for r in investor_regions:
        r_lower = r.lower()
        if country_lower == r_lower:
            return 25.0
        if "africa" in r_lower or "pan-africa" in r_lower:
            return 12.0
        # Check sub-regions
        sub_regions = {
            "west africa":  ["nigeria", "ghana", "senegal", "côte d'ivoire", "ivory coast", "mali", "guinea"],
            "east africa":  ["kenya", "ethiopia", "tanzania", "uganda", "rwanda", "mozambique"],
            "southern africa": ["south africa", "zambia", "zimbabwe", "botswana", "namibia"],
            "north africa": ["egypt", "morocco", "tunisia", "algeria", "libya"],
            "central africa": ["drc", "congo", "cameroon", "angola"],
        }
        for region, countries in sub_regions.items():
            if r_lower == region and country_lower in countries:
                return 20.0
    return 0.0


def _ticket_score(
    capex: Optional[float],
    min_ticket: Optional[str],
    max_ticket: Optional[str],
) -> float:
    if capex is None:
        return 10.0  # Neutral if unknown
    try:
        mn = float(min_ticket.replace("$", "").replace(",", "")) if min_ticket else 0
        mx = float(max_ticket.replace("$", "").replace(",", "")) if max_ticket else 999_000_000_000
        if mn <= capex <= mx:
            return 20.0
        if abs(capex - mn) / max(mn, 1) < 0.5 or abs(capex - mx) / max(mx, 1) < 0.5:
            return 10.0
    except Exception:
        pass
    return 0.0


def _risk_score(petfel_rating: Optional[str], investor_type: Optional[str]) -> float:
    """
    Rough alignment between PETFEL risk rating and investor risk appetite.
    DFIs and development banks can absorb higher-risk projects.
    """
    if not petfel_rating:
        return 7.5  # Neutral
    risk_map = {
        "A": {"dfi": 15, "private_fund": 15, "sovereign": 15, "pension": 15},
        "B": {"dfi": 15, "private_fund": 12, "sovereign": 12, "pension": 10},
        "C": {"dfi": 12, "private_fund":  8, "sovereign":  6, "pension":  4},
        "D": {"dfi":  8, "private_fund":  3, "sovereign":  2, "pension":  0},
    }
    inv_type = (investor_type or "private_fund").lower()
    return risk_map.get(petfel_rating, {}).get(inv_type, 7.5)


def _affinity_score(project_sector: Optional[str], investor_sectors: list[str]) -> float:
    """Bonus score for strong sector specialisation."""
    if not project_sector or not investor_sectors:
        return 0.0
    # Simple heuristic — more sectors → broader mandate → lower affinity per sector
    if len(investor_sectors) <= 2:
        return _sector_score(project_sector, investor_sectors) > 0 and 10.0 or 0.0
    return 5.0 if _sector_score(project_sector, investor_sectors) > 0 else 0.0


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class MatchStatusUpdate(BaseModel):
    status: str  # suggested | contacted | engaged | closed
    notes:  Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/run/{project_id}")
async def run_matching(
    project_id:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Run the investor matching algorithm for a project.
    Creates/refreshes InvestorMatch records for all active investors.
    """
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get latest PETFEL rating
    petfel = (
        db.query(PetfelAssessment)
        .filter(PetfelAssessment.project_id == project_id)
        .order_by(PetfelAssessment.version.desc())
        .first()
    )
    petfel_rating = petfel.rating if petfel else None

    # Parse project CAPEX from detail if available
    from backend.models import ProjectDetail
    detail = db.query(ProjectDetail).filter(ProjectDetail.project_id == project_id).first()
    capex  = float(detail.capex_usd) if detail and detail.capex_usd else None

    investors = db.query(Investor).filter(Investor.is_active == True).all()  # noqa: E712

    matches_created = 0
    ranked = []

    for inv in investors:
        focus_sectors = _parse_json_list(inv.focus_sectors)
        focus_regions = _parse_json_list(inv.focus_regions)

        s_sector   = _sector_score(project.sector, focus_sectors)
        s_geo      = _geo_score(project.country, focus_regions)
        s_ticket   = _ticket_score(capex, inv.min_ticket_usd, inv.max_ticket_usd)
        s_risk     = _risk_score(petfel_rating, inv.investor_type)
        s_affinity = _affinity_score(project.sector, focus_sectors)

        total = round(s_sector + s_geo + s_ticket + s_risk + s_affinity, 2)

        # Upsert match record
        existing = db.query(InvestorMatch).filter(
            InvestorMatch.project_id  == project_id,
            InvestorMatch.investor_id == inv.id,
        ).first()
        if existing:
            existing.match_score     = total
            existing.sector_score    = s_sector
            existing.geography_score = s_geo
            existing.ticket_score    = s_ticket
            existing.risk_score      = s_risk
            existing.affinity_score  = s_affinity
        else:
            db.add(InvestorMatch(
                project_id      = project_id,
                investor_id     = inv.id,
                match_score     = total,
                sector_score    = s_sector,
                geography_score = s_geo,
                ticket_score    = s_ticket,
                risk_score      = s_risk,
                affinity_score  = s_affinity,
            ))
            matches_created += 1

        ranked.append({
            "investor_id":   inv.id,
            "investor_name": inv.organisation_name,
            "investor_type": inv.investor_type,
            "match_score":   total,
            "breakdown": {
                "sector":    s_sector,
                "geography": s_geo,
                "ticket":    s_ticket,
                "risk":      s_risk,
                "affinity":  s_affinity,
            },
        })

    db.commit()
    ranked.sort(key=lambda x: x["match_score"], reverse=True)
    logger.info(
        "Matching run | project=%s investors=%d new_matches=%d",
        project_id, len(investors), matches_created,
    )
    return {
        "project_id":     project_id,
        "investors_scored":len(ranked),
        "top_matches":    ranked[:10],
    }


@router.get("/{project_id}")
async def get_matches(
    project_id:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return ranked investor matches for a project."""
    matches = (
        db.query(InvestorMatch)
        .filter(InvestorMatch.project_id == project_id)
        .order_by(InvestorMatch.match_score.desc())
        .limit(50)
        .all()
    )
    result = []
    for m in matches:
        inv = db.query(Investor).filter(Investor.id == m.investor_id).first()
        result.append({
            "match_id":      m.id,
            "investor_id":   m.investor_id,
            "investor_name": inv.organisation_name if inv else None,
            "investor_type": inv.investor_type if inv else None,
            "match_score":   float(m.match_score) if m.match_score else 0,
            "status":        m.status,
            "run_at":        str(m.run_at),
        })
    return {"project_id": project_id, "matches": result}


@router.put("/{match_id}/status")
async def update_match_status(
    match_id:     str,
    payload:      MatchStatusUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Update engagement status for a match."""
    match = db.query(InvestorMatch).filter(InvestorMatch.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    valid = {"suggested", "contacted", "engaged", "closed"}
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")

    match.status = payload.status
    if payload.notes:
        match.notes = payload.notes
    db.commit()
    return {"status": "updated", "match_id": match_id, "new_status": payload.status}
