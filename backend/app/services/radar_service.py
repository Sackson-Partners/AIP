"""Radar service layer - business logic for the Africa Infrastructure Radar."""
import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.radar import RadarProject, RadarSignal, RadarScanLog, StrategicCorridor

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Region / investment classification helpers
# ---------------------------------------------------------------------------

_REGION_MAP: Dict[str, List[str]] = {
          "West Africa": [
                        "Nigeria", "Ghana", "Senegal", "Cote d'Ivoire", "Mali", "Burkina Faso",
                        "Niger", "Guinea", "Sierra Leone", "Liberia", "Togo", "Benin",
                        "Mauritania", "Gambia", "Guinea-Bissau", "Cape Verde",
          ],
          "East Africa": [
                        "Kenya", "Ethiopia", "Tanzania", "Uganda", "Rwanda", "Burundi",
                        "South Sudan", "Somalia", "Djibouti", "Eritrea", "Comoros", "Seychelles",
          ],
          "Southern Africa": [
                        "South Africa", "Mozambique", "Zimbabwe", "Zambia", "Malawi",
                        "Botswana", "Namibia", "Lesotho", "Eswatini", "Madagascar", "Mauritius",
          ],
          "North Africa": [
                        "Egypt", "Morocco", "Algeria", "Tunisia", "Libya", "Sudan",
          ],
          "Central Africa": [
                        "DRC", "Congo", "Cameroon", "Central African Republic", "Chad",
                        "Gabon", "Equatorial Guinea", "Sao Tome and Principe",
          ],
}

_INVESTMENT_RANGES = [
          (1_000_000_000, "$1B+"),
          (500_000_000, "$500M+"),
          (100_000_000, "$100M+"),
          (50_000_000, "$50M+"),
          (10_000_000, "$10M+"),
]


# ---------------------------------------------------------------------------
# Analysis result dataclass (returned by radar_service.analyze_signal)
# ---------------------------------------------------------------------------

@dataclass
class AnalysisResult:
          project_name: str
          summary: str
          primary_country: str
          countries: List[str]
          region: Optional[str]
          sector: str
          sub_sector: Optional[str]
          investment_readiness: str
          estimated_investment_usd: Optional[float]
          strategic_importance: str
          regional_impact: str
          investment_opportunity: str
          risk_factors: List[str]
          key_stakeholders: List[str]
          draft_article: Optional[str]
          podcast_suggestion: Optional[str]
          confidence_score: Optional[float]
          processing_time_ms: Optional[int] = None


# ---------------------------------------------------------------------------
# RadarService
# ---------------------------------------------------------------------------

class RadarService:
          """Business logic for the Africa Infrastructure Radar."""

    # ── Project CRUD ────────────────────────────────────────────────────────

    def get_project(self, db: Session, project_id: int) -> Optional[RadarProject]:
                  """Fetch a single radar project by primary key."""
                  return db.query(RadarProject).filter(RadarProject.id == project_id).first()

    def get_project_by_uuid(self, db: Session, uuid: str) -> Optional[RadarProject]:
                  """Fetch a radar project by UUID."""
                  return db.query(RadarProject).filter(RadarProject.uuid == uuid).first()

    def list_projects(
                  self,
                  db: Session,
                  *,
                  sector: Optional[str] = None,
                  region: Optional[str] = None,
                  country: Optional[str] = None,
                  status: Optional[str] = None,
                  investment_readiness: Optional[str] = None,
                  investment_range: Optional[str] = None,
                  corridor_id: Optional[int] = None,
                  page: int = 1,
                  page_size: int = 20,
    ) -> tuple[List[RadarProject], int]:
                  """Return paginated radar projects with optional filters."""
                  q = db.query(RadarProject)
                  if sector:
                                    q = q.filter(RadarProject.sector == sector)
                                if region:
                      q = q.filter(RadarProject.region == region)
                                              if country:
                                                  q = q.filter(RadarProject.primary_country == country)
                                                            if status:
                                                                q = q.filter(RadarProject.status == status)
                                                                          if investment_readiness:
                                                                              q = q.filter(RadarProject.investment_readiness == investment_readiness)
                                                                                        if investment_range:
                                                                                            q = q.filter(RadarProject.investment_range == investment_range)
                                                                                                      if corridor_id is not None:
                                                                                                                        q = q.filter(RadarProject.corridor_id == corridor_id)
                                                                                                                    total = q.count()
        items = q.order_by(RadarProject.created_at.desc()).offset(
                          (page - 1) * page_size
        ).limit(page_size).all()
        return items, total

    # ── Signal CRUD ─────────────────────────────────────────────────────────

    def create_signal(
                  self,
                  db: Session,
                  *,
                  source_type: str,
                  source_name: str,
                  title: str,
                  raw_content: Optional[str] = None,
                  **kwargs: Any,
) -> RadarSignal:
        """Create a radar signal, computing content hash for deduplication."""
        content_hash: Optional[str] = None
        if raw_content:
                          content_hash = hashlib.sha256(raw_content.encode()).hexdigest()
            existing = db.query(RadarSignal).filter(
                                  RadarSignal.content_hash == content_hash
            ).first()
            if existing:
                                  raise ValueError("Duplicate signal: identical content already exists")

        signal = RadarSignal(
                          source_type=source_type,
                          source_name=source_name,
                          title=title,
                          raw_content=raw_content,
                          content_hash=content_hash,
                          **kwargs,
        )
        db.add(signal)
        db.commit()
        db.refresh(signal)
        return signal

    def list_unprocessed_signals(
                  self, db: Session, *, limit: int = 50
    ) -> List[RadarSignal]:
                  """Return unprocessed signals ordered by detection date."""
        return (
                          db.query(RadarSignal)
                          .filter(RadarSignal.is_processed == False)  # noqa: E712
                          .order_by(RadarSignal.detected_at.asc())
                          .limit(limit)
                          .all()
        )

    # ── Region / investment helpers ─────────────────────────────────────────

    @staticmethod
    def classify_region(countries: Optional[List[str]]) -> Optional[str]:
                  """Infer African region from a list of country names."""
        if not countries:
                          return None
                      for country in countries:
                                        for region, members in _REGION_MAP.items():
                                                              if country in members:
                                                                                        return region
                                                                            return "Pan-African"

    @staticmethod
    def classify_investment_range(amount_usd: Optional[float]) -> Optional[str]:
                  """Return a human-readable investment-range bucket."""
        if not amount_usd:
                          return None
                      for threshold, label in _INVESTMENT_RANGES:
                                        if amount_usd >= threshold:
                                                              return label
                                                      return "<$10M"

    # ── AI analysis stub ────────────────────────────────────────────────────

    async def analyze_signal(
                  self,
                  *,
                  title: str,
                  content: str,
                  source_name: str = "Unknown",
                  source_type: str = "unknown",
    ) -> AnalysisResult:
                  """
                          AI-powered analysis of a raw signal.

                                  This stub returns a structured placeholder.  In production, replace
                                          the body with calls to your LLM service (OpenAI, Anthropic, etc.)
                                                  and parse the structured output into an AnalysisResult.
                                                          """
        t0 = time.monotonic()

        # Placeholder structured output ─────────────────────────────────────
        result = AnalysisResult(
                          project_name=title,
                          summary=f"Infrastructure project detected from {source_name}: {title}",
                          primary_country="Nigeria",       # replace with LLM extraction
                          countries=["Nigeria"],           # replace with LLM extraction
                          region="West Africa",            # replace with classify_region
                          sector="Transport",              # replace with LLM extraction
                          sub_sector=None,
                          investment_readiness="early_stage",
                          estimated_investment_usd=None,
                          strategic_importance=(
                                                "Strategic infrastructure project with potential to improve "
                                                "regional connectivity and economic integration."
                          ),
                          regional_impact=(
                                                "Positive regional impact expected through improved trade "
                                                "corridors and job creation."
                          ),
                          investment_opportunity=(
                                                "Investment opportunity under evaluation; further due diligence "
                                                "required to quantify returns."
                          ),
                          risk_factors=["Political risk", "Currency risk", "Execution risk"],
                          key_stakeholders=[source_name],
                          draft_article=None,
                          podcast_suggestion=f"Episode idea: {title} - Opportunities and Challenges",
                          confidence_score=0.5,
                          processing_time_ms=int((time.monotonic() - t0) * 1000),
        )
        return result

    # ── Analytics ───────────────────────────────────────────────────────────

    def sector_summary(self, db: Session) -> List[Dict[str, Any]]:
                  """Return project counts per sector."""
        rows = (
                          db.query(RadarProject.sector, func.count(RadarProject.id).label("count"))
                          .group_by(RadarProject.sector)
                          .order_by(func.count(RadarProject.id).desc())
                          .all()
        )
        return [{"sector": r.sector, "count": r.count} for r in rows]

    def region_summary(self, db: Session) -> List[Dict[str, Any]]:
                  """Return project counts per region."""
        rows = (
                          db.query(RadarProject.region, func.count(RadarProject.id).label("count"))
                          .group_by(RadarProject.region)
                          .order_by(func.count(RadarProject.id).desc())
                          .all()
        )
        return [{"region": r.region, "count": r.count} for r in rows]

    def readiness_summary(self, db: Session) -> List[Dict[str, Any]]:
                  """Return project counts per investment readiness level."""
        rows = (
                          db.query(
                                                RadarProject.investment_readiness,
                                                func.count(RadarProject.id).label("count"),
                          )
                          .group_by(RadarProject.investment_readiness)
                          .order_by(func.count(RadarProject.id).desc())
                          .all()
        )
        return [{"investment_readiness": r.investment_readiness, "count": r.count} for r in rows]

    # ── Scan-log helpers ────────────────────────────────────────────────────

    def start_scan_log(self, db: Session, scan_type: str, source_type: Optional[str] = None) -> RadarScanLog:
                  """Create a new scan-log entry and mark it as started."""
        log = RadarScanLog(
                          scan_type=scan_type,
                          source_type=source_type,
                          status="started",
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    def finish_scan_log(
                  self,
                  db: Session,
                  log: RadarScanLog,
                  *,
                  status: str = "completed",
                  signals_detected: int = 0,
                  projects_created: int = 0,
                  projects_updated: int = 0,
                  error_message: Optional[str] = None,
    ) -> RadarScanLog:
                  """Mark a scan-log entry as completed (or failed)."""
        log.status = status
        log.completed_at = datetime.utcnow()
        log.signals_detected = signals_detected
        log.projects_created = projects_created
        log.projects_updated = projects_updated
        if log.started_at:
                          delta = datetime.utcnow() - log.started_at
            log.duration_seconds = int(delta.total_seconds())
        log.error_message = error_message
        db.commit()
        db.refresh(log)
        return log


# Module-level singleton
radar_service = RadarService()
