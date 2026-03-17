"""Africa Infrastructure Radar router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.radar import RadarEntry, RadarSignal
from app.schemas.radar import (
    RadarEntryCreate, RadarEntryUpdate, RadarEntryResponse,
    RadarEntryListResponse, RadarSignalCreate, RadarSignalResponse
)
from .auth import require_auth

router = APIRouter(prefix="/radar", tags=["Radar"])


# ─── Radar Entries ──────────────────────────────────────────────────────────

@router.post("/", response_model=RadarEntryResponse, status_code=status.HTTP_201_CREATED)
def create_radar_entry(
      entry_data: RadarEntryCreate,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Add a new entry to the Africa Infrastructure Radar."""
      entry = RadarEntry(
          **entry_data.model_dump(),
          added_by=current_user.id
      )
      db.add(entry)
      db.commit()
      db.refresh(entry)
      return entry


@router.get("/", response_model=RadarEntryListResponse)
def list_radar_entries(
      page: int = Query(1, ge=1),
      page_size: int = Query(20, ge=1, le=100),
      country: Optional[str] = None,
      sector: Optional[str] = None,
      status_filter: Optional[str] = Query(None, alias="status"),
      is_featured: Optional[bool] = None,
      db: Session = Depends(get_db)
):
      """List radar entries with optional filters."""
      query = db.query(RadarEntry)
      if country:
                query = query.filter(RadarEntry.country == country)
            if sector:
                      query = query.filter(RadarEntry.sector == sector)
                  if status_filter:
                            query = query.filter(RadarEntry.status == status_filter)
                        if is_featured is not None:
                                  query = query.filter(RadarEntry.is_featured == is_featured)
                              total = query.count()
    items = query.order_by(RadarEntry.updated_at.desc()).offset(
              (page - 1) * page_size
    ).limit(page_size).all()
    return RadarEntryListResponse(
              items=items,
              total=total,
              page=page,
              page_size=page_size,
              pages=(total + page_size - 1) // page_size
    )


@router.get("/{entry_id}", response_model=RadarEntryResponse)
def get_radar_entry(entry_id: int, db: Session = Depends(get_db)):
      """Get a single radar entry by ID."""
    entry = db.query(RadarEntry).filter(RadarEntry.id == entry_id).first()
    if not entry:
              raise HTTPException(status_code=404, detail="Radar entry not found")
          return entry


@router.put("/{entry_id}", response_model=RadarEntryResponse)
def update_radar_entry(
      entry_id: int,
      entry_data: RadarEntryUpdate,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Update a radar entry."""
    entry = db.query(RadarEntry).filter(RadarEntry.id == entry_id).first()
    if not entry:
              raise HTTPException(status_code=404, detail="Radar entry not found")
          for field, value in entry_data.model_dump(exclude_unset=True).items():
                    setattr(entry, field, value)
                db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_radar_entry(
      entry_id: int,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Delete a radar entry."""
    entry = db.query(RadarEntry).filter(RadarEntry.id == entry_id).first()
    if not entry:
              raise HTTPException(status_code=404, detail="Radar entry not found")
          db.delete(entry)
    db.commit()


# ─── Radar Signals ──────────────────────────────────────────────────────────

@router.post("/{entry_id}/signals", response_model=RadarSignalResponse,
                          status_code=status.HTTP_201_CREATED)
def add_signal(
      entry_id: int,
      signal_data: RadarSignalCreate,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Add an intelligence signal to a radar entry."""
    entry = db.query(RadarEntry).filter(RadarEntry.id == entry_id).first()
    if not entry:
              raise HTTPException(status_code=404, detail="Radar entry not found")
          signal = RadarSignal(entry_id=entry_id, **signal_data.model_dump())
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal


@router.get("/{entry_id}/signals", response_model=List[RadarSignalResponse])
def list_signals(entry_id: int, db: Session = Depends(get_db)):
      """List all signals for a radar entry."""
    entry = db.query(RadarEntry).filter(RadarEntry.id == entry_id).first()
    if not entry:
              raise HTTPException(status_code=404, detail="Radar entry not found")
          return db.query(RadarSignal).filter(
                    RadarSignal.entry_id == entry_id
          ).order_by(RadarSignal.created_at.desc()).all()


@router.delete("/{entry_id}/signals/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_signal(
      entry_id: int,
      signal_id: int,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Delete a radar signal."""
    signal = db.query(RadarSignal).filter(
              RadarSignal.id == signal_id,
              RadarSignal.entry_id == entry_id
    ).first()
    if not signal:
              raise HTTPException(status_code=404, detail="Signal not found")
          db.delete(signal)
    db.commit()
