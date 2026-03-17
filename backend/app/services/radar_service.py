"""Radar service layer - business logic for the Africa Infrastructure Radar."""
import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.radar import RadarEntry, RadarSignal

logger = logging.getLogger(__name__)


class RadarService:
      """Business logic for Africa Infrastructure Radar operations."""

    def __init__(self, db: Session):
              self.db = db

    # ─── Entry Operations ────────────────────────────────────────────────────

    def get_entry(self, entry_id: int) -> Optional[RadarEntry]:
              """Fetch a single radar entry by primary key."""
              return self.db.query(RadarEntry).filter(RadarEntry.id == entry_id).first()

    def get_entry_by_uuid(self, uuid: str) -> Optional[RadarEntry]:
              """Fetch a radar entry by UUID."""
              return self.db.query(RadarEntry).filter(RadarEntry.uuid == uuid).first()

    def list_entries(
              self,
              country: Optional[str] = None,
              sector: Optional[str] = None,
              status: Optional[str] = None,
              is_featured: Optional[bool] = None,
              page: int = 1,
              page_size: int = 20,
    ) -> tuple[List[RadarEntry], int]:
              """Return paginated radar entries with optional filters."""
              query = self.db.query(RadarEntry)
              if country:
                            query = query.filter(RadarEntry.country == country)
                        if sector:
                                      query = query.filter(RadarEntry.sector == sector)
                                  if status:
                                                query = query.filter(RadarEntry.status == status)
                                            if is_featured is not None:
                                                          query = query.filter(RadarEntry.is_featured == is_featured)
                                                      total = query.count()
        items = (
                      query.order_by(RadarEntry.updated_at.desc())
                      .offset((page - 1) * page_size)
                      .limit(page_size)
                      .all()
        )
        return items, total

    def search_entries(self, query_str: str) -> List[RadarEntry]:
              """Simple text search across name, country, sector, tags."""
        like = f"%{query_str}%"
        return (
                      self.db.query(RadarEntry)
                      .filter(
                                        RadarEntry.name.ilike(like)
                                        | RadarEntry.country.ilike(like)
                                        | RadarEntry.sector.ilike(like)
                                        | RadarEntry.tags.ilike(like)
                      )
                      .order_by(RadarEntry.updated_at.desc())
                      .limit(50)
                      .all()
        )

    def compute_opportunity_score(self, entry: RadarEntry) -> int:
              """Heuristic: derive an opportunity score from available fields."""
        score = 50  # Base score

        # Boost for verified entries
        if entry.is_verified:
                      score += 10

        # Boost for having financial data
        if entry.estimated_value_usd:
                      score += 5
                  if entry.funding_gap_usd:
                                score += 5

        # Adjust for risk
        if entry.risk_score is not None:
                      score -= (entry.risk_score - 50) // 5  # Penalise high-risk entries

        # Boost for active / funded status
        status_boost = {"active": 15, "tracking": 0, "stalled": -10, "completed": -5}
        score += status_boost.get(entry.status, 0)

        return max(0, min(100, score))

    def bulk_update_opportunity_scores(self) -> int:
              """Recalculate opportunity scores for all entries; return count updated."""
        entries = self.db.query(RadarEntry).all()
        updated = 0
        for entry in entries:
                      new_score = self.compute_opportunity_score(entry)
                      if entry.opportunity_score != new_score:
                                        entry.opportunity_score = new_score
                                        updated += 1
                                self.db.commit()
        logger.info("Updated opportunity scores for %d radar entries", updated)
        return updated

    # ─── Signal Operations ───────────────────────────────────────────────────

    def list_signals(
              self,
              entry_id: int,
              signal_type: Optional[str] = None,
              limit: int = 20,
    ) -> List[RadarSignal]:
              """Return signals for a given entry, newest first."""
        query = self.db.query(RadarSignal).filter(RadarSignal.entry_id == entry_id)
        if signal_type:
                      query = query.filter(RadarSignal.signal_type == signal_type)
        return query.order_by(RadarSignal.created_at.desc()).limit(limit).all()

    def latest_signals(self, limit: int = 10) -> List[RadarSignal]:
              """Return the most recent signals across all entries."""
        return (
                      self.db.query(RadarSignal)
                      .order_by(RadarSignal.created_at.desc())
                      .limit(limit)
                      .all()
        )

    # ─── Analytics ──────────────────────────────────────────────────────────

    def sector_summary(self) -> List[dict]:
              """Return count and average opportunity score per sector."""
        from sqlalchemy import func
        rows = (
                      self.db.query(
                                        RadarEntry.sector,
                                        func.count(RadarEntry.id).label("count"),
                                        func.avg(RadarEntry.opportunity_score).label("avg_opportunity"),
                      )
                      .group_by(RadarEntry.sector)
                      .order_by(func.count(RadarEntry.id).desc())
                      .all()
        )
        return [
                      {
                                        "sector": r.sector,
                                        "count": r.count,
                                        "avg_opportunity_score": round(float(r.avg_opportunity), 1) if r.avg_opportunity else None,
                      }
                      for r in rows
        ]

    def country_summary(self) -> List[dict]:
              """Return entry counts per country."""
        from sqlalchemy import func
        rows = (
                      self.db.query(
                                        RadarEntry.country,
                                        func.count(RadarEntry.id).label("count"),
                      )
                      .group_by(RadarEntry.country)
                      .order_by(func.count(RadarEntry.id).desc())
                      .all()
        )
        return [{"country": r.country, "count": r.count} for r in rows]
