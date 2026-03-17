"""Radar Pydantic schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal


# ─── Radar Signal Schemas ────────────────────────────────────────────────────

class RadarSignalCreate(BaseModel):
      """Schema for creating a radar signal."""
      signal_type: str = Field(..., min_length=1, max_length=50)
      title: str = Field(..., min_length=1, max_length=255)
      summary: Optional[str] = None
      source_url: Optional[str] = Field(None, max_length=1000)
      source_name: Optional[str] = Field(None, max_length=255)
      sentiment: Optional[str] = Field(None, max_length=20)
      importance: int = Field(default=5, ge=1, le=10)
      published_at: Optional[datetime] = None


class RadarSignalResponse(BaseModel):
      """Schema for radar signal response."""
      id: int
      uuid: str
      entry_id: int
      signal_type: str
      title: str
      summary: Optional[str] = None
      source_url: Optional[str] = None
      source_name: Optional[str] = None
      sentiment: Optional[str] = None
      importance: int
      published_at: Optional[datetime] = None
      created_at: datetime

    class Config:
              from_attributes = True


# ─── Radar Entry Schemas ─────────────────────────────────────────────────────

class RadarEntryCreate(BaseModel):
      """Schema for creating a radar entry."""
      project_id: Optional[int] = None
      name: str = Field(..., min_length=1, max_length=255)
      country: str = Field(..., min_length=1, max_length=100)
      sector: str = Field(..., min_length=1, max_length=100)
      sub_sector: Optional[str] = Field(None, max_length=100)
      region: Optional[str] = Field(None, max_length=100)
      status: str = Field(default="tracking", max_length=50)
      stage: Optional[str] = Field(None, max_length=50)
      estimated_value_usd: Optional[Decimal] = None
      funding_gap_usd: Optional[Decimal] = None
      funding_sources: Optional[str] = Field(None, max_length=500)
      risk_score: Optional[int] = Field(None, ge=0, le=100)
      opportunity_score: Optional[int] = Field(None, ge=0, le=100)
      esg_score: Optional[int] = Field(None, ge=0, le=100)
      tags: Optional[str] = Field(None, max_length=500)
      notes: Optional[str] = None
      data_sources: Optional[Dict[str, Any]] = None
      last_update_source: Optional[str] = Field(None, max_length=255)
      is_featured: bool = False
      is_verified: bool = False


class RadarEntryUpdate(BaseModel):
      """Schema for updating a radar entry."""
      name: Optional[str] = Field(None, min_length=1, max_length=255)
      country: Optional[str] = Field(None, max_length=100)
      sector: Optional[str] = Field(None, max_length=100)
      sub_sector: Optional[str] = Field(None, max_length=100)
      region: Optional[str] = Field(None, max_length=100)
      status: Optional[str] = Field(None, max_length=50)
      stage: Optional[str] = Field(None, max_length=50)
      estimated_value_usd: Optional[Decimal] = None
      funding_gap_usd: Optional[Decimal] = None
      funding_sources: Optional[str] = Field(None, max_length=500)
      risk_score: Optional[int] = Field(None, ge=0, le=100)
      opportunity_score: Optional[int] = Field(None, ge=0, le=100)
      esg_score: Optional[int] = Field(None, ge=0, le=100)
      tags: Optional[str] = Field(None, max_length=500)
      notes: Optional[str] = None
      data_sources: Optional[Dict[str, Any]] = None
      last_update_source: Optional[str] = Field(None, max_length=255)
      is_featured: Optional[bool] = None
      is_verified: Optional[bool] = None


class RadarEntryResponse(BaseModel):
      """Schema for radar entry response."""
      id: int
      uuid: str
      project_id: Optional[int] = None
      name: str
      country: str
      sector: str
      sub_sector: Optional[str] = None
      region: Optional[str] = None
      status: str
      stage: Optional[str] = None
      estimated_value_usd: Optional[Decimal] = None
      funding_gap_usd: Optional[Decimal] = None
      funding_sources: Optional[str] = None
      risk_score: Optional[int] = None
      opportunity_score: Optional[int] = None
      esg_score: Optional[int] = None
      tags: Optional[str] = None
      notes: Optional[str] = None
      data_sources: Optional[Dict[str, Any]] = None
      last_update_source: Optional[str] = None
      is_featured: bool
      is_verified: bool
      added_by: Optional[int] = None
      created_at: datetime
      updated_at: datetime
      signals: Optional[List[RadarSignalResponse]] = None

    class Config:
              from_attributes = True


class RadarEntryListResponse(BaseModel):
      """Schema for paginated radar entry list."""
      items: List[RadarEntryResponse]
      total: int
      page: int
      page_size: int
      pages: int
