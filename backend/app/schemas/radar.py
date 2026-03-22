"""Radar Pydantic schemas for the Africa Infrastructure Radar."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal


# ─── Radar Signal Schemas ─────────────────────────────────────────────────────

class RadarSignalCreate(BaseModel):
          """Schema for creating a radar signal."""
          source_type: str = Field(..., min_length=1, max_length=50)
          source_name: str = Field(..., min_length=1, max_length=255)
          source_url: Optional[str] = None
          source_date: Optional[datetime] = None
          title: str = Field(..., min_length=1, max_length=500)
          raw_content: Optional[str] = None
          signal_type: Optional[str] = Field(None, max_length=100)
          countries: Optional[List[str]] = None
          sectors: Optional[List[str]] = None
          estimated_value_usd: Optional[Decimal] = None


class RadarSignalResponse(BaseModel):
          """Schema for radar signal response."""
          id: int
          uuid: str
          source_type: str
          source_name: str
          source_url: Optional[str] = None
          source_date: Optional[datetime] = None
          title: str
          signal_type: Optional[str] = None
          countries: Optional[List[str]] = None
          sectors: Optional[List[str]] = None
          estimated_value_usd: Optional[Decimal] = None
          is_processed: bool
          processed_at: Optional[datetime] = None
          radar_project_id: Optional[int] = None
          detected_at: datetime

    class Config:
                  from_attributes = True


# ─── Strategic Corridor Schemas ───────────────────────────────────────────────

class StrategicCorridorCreate(BaseModel):
          """Schema for creating a strategic corridor."""
          name: str = Field(..., min_length=1, max_length=255)
          description: Optional[str] = None
          countries: List[str]
          regions: Optional[List[str]] = None
          coordinates: Optional[Dict[str, Any]] = None
          corridor_type: Optional[str] = Field(None, max_length=100)
          primary_sector: Optional[str] = Field(None, max_length=100)
          total_investment_usd: Optional[Decimal] = None
          length_km: Optional[Decimal] = None
          strategic_significance: Optional[str] = None
          economic_impact: Optional[str] = None
          key_infrastructure: Optional[List[str]] = None
          development_status: Optional[str] = Field(None, max_length=100)
          completion_target: Optional[str] = Field(None, max_length=50)


class StrategicCorridorResponse(BaseModel):
          """Schema for strategic corridor response."""
          id: int
          uuid: str
          name: str
          description: Optional[str] = None
          countries: List[str]
          regions: Optional[List[str]] = None
          coordinates: Optional[Dict[str, Any]] = None
          corridor_type: Optional[str] = None
          primary_sector: Optional[str] = None
          total_investment_usd: Optional[Decimal] = None
          length_km: Optional[Decimal] = None
          strategic_significance: Optional[str] = None
          economic_impact: Optional[str] = None
          key_infrastructure: Optional[List[str]] = None
          development_status: Optional[str] = None
          completion_target: Optional[str] = None
          created_at: datetime
          updated_at: datetime

    class Config:
                  from_attributes = True


class RadarCorridorListResponse(BaseModel):
          """Paginated list of strategic corridors."""
          items: List[StrategicCorridorResponse]
          total: int
          page: int
          page_size: int
          pages: int


# ─── Radar Project Schemas ────────────────────────────────────────────────────

class RadarProjectCreate(BaseModel):
          """Schema for creating a radar project."""
          name: str = Field(..., min_length=1, max_length=500)
          description: Optional[str] = None
          summary: Optional[str] = None
          primary_country: str = Field(..., min_length=1, max_length=100)
          countries: Optional[List[str]] = None
          region: Optional[str] = Field(None, max_length=100)
          latitude: Optional[Decimal] = None
          longitude: Optional[Decimal] = None
          sector: str = Field(..., min_length=1, max_length=100)
          sub_sector: Optional[str] = Field(None, max_length=100)
          project_type: Optional[str] = Field(None, max_length=100)
          estimated_investment_usd: Optional[Decimal] = None
          investment_range: Optional[str] = Field(None, max_length=50)
          funding_sources: Optional[List[str]] = None
          status: str = Field(default="detected", max_length=50)
          investment_readiness: Optional[str] = Field(None, max_length=50)
          timeline: Optional[Dict[str, Any]] = None
          corridor_id: Optional[int] = None


class RadarProjectUpdate(BaseModel):
          """Schema for updating a radar project."""
          name: Optional[str] = Field(None, min_length=1, max_length=500)
          description: Optional[str] = None
          summary: Optional[str] = None
          primary_country: Optional[str] = Field(None, max_length=100)
          countries: Optional[List[str]] = None
          region: Optional[str] = Field(None, max_length=100)
          latitude: Optional[Decimal] = None
          longitude: Optional[Decimal] = None
          sector: Optional[str] = Field(None, max_length=100)
          sub_sector: Optional[str] = Field(None, max_length=100)
          project_type: Optional[str] = Field(None, max_length=100)
          estimated_investment_usd: Optional[Decimal] = None
          investment_range: Optional[str] = Field(None, max_length=50)
          funding_sources: Optional[List[str]] = None
          status: Optional[str] = Field(None, max_length=50)
          investment_readiness: Optional[str] = Field(None, max_length=50)
          timeline: Optional[Dict[str, Any]] = None
          strategic_importance: Optional[str] = None
          regional_impact: Optional[str] = None
          investment_opportunity: Optional[str] = None
          risk_factors: Optional[List[str]] = None
          key_stakeholders: Optional[List[str]] = None
          corridor_id: Optional[int] = None
          editorial_notes: Optional[str] = None
          is_editorial_approved: Optional[bool] = None


class RadarProjectResponse(BaseModel):
          """Schema for radar project response."""
          id: int
          uuid: str
          name: str
          description: Optional[str] = None
          summary: Optional[str] = None
          primary_country: str
          countries: Optional[List[str]] = None
          region: Optional[str] = None
          latitude: Optional[Decimal] = None
          longitude: Optional[Decimal] = None
          sector: str
          sub_sector: Optional[str] = None
          project_type: Optional[str] = None
          estimated_investment_usd: Optional[Decimal] = None
          investment_range: Optional[str] = None
          funding_sources: Optional[List[str]] = None
          status: str
          investment_readiness: Optional[str] = None
          timeline: Optional[Dict[str, Any]] = None
          strategic_importance: Optional[str] = None
          regional_impact: Optional[str] = None
          investment_opportunity: Optional[str] = None
          risk_factors: Optional[List[str]] = None
          key_stakeholders: Optional[List[str]] = None
          corridor_id: Optional[int] = None
          draft_article: Optional[str] = None
          podcast_suggestion: Optional[str] = None
          editorial_notes: Optional[str] = None
          is_editorial_approved: bool
          published_at: Optional[datetime] = None
          ai_analysis_version: Optional[str] = None
          ai_confidence_score: Optional[Decimal] = None
          last_analyzed_at: Optional[datetime] = None
          created_at: datetime
          updated_at: datetime
          signals: Optional[List[RadarSignalResponse]] = None

    class Config:
                  from_attributes = True


class RadarProjectListResponse(BaseModel):
          """Paginated list of radar projects."""
          items: List[RadarProjectResponse]
          total: int
          page: int
          page_size: int
          pages: int


# ─── Analysis Schemas ─────────────────────────────────────────────────────────

class AnalyzeSignalRequest(BaseModel):
          """Request body for AI analysis of a signal."""
          signal_id: Optional[int] = None
          signal_title: Optional[str] = None
          signal_content: Optional[str] = None
          source_name: Optional[str] = None
          source_type: Optional[str] = None


class AnalysisResponse(BaseModel):
          """Response from AI signal analysis."""
          project_id: int
          project_uuid: str
          name: str
          analysis: Dict[str, Any]
          confidence_score: Optional[Decimal] = None
          processing_time_ms: Optional[int] = None
          timestamp: datetime


# ─── Scan Log Schema ──────────────────────────────────────────────────────────

class RadarScanLogResponse(BaseModel):
          """Schema for radar scan log response."""
          id: int
          scan_type: str
          source_type: Optional[str] = None
          signals_detected: int
          projects_created: int
          projects_updated: int
          status: str
          error_message: Optional[str] = None
          started_at: datetime
          completed_at: Optional[datetime] = None
          duration_seconds: Optional[int] = None

    class Config:
                  from_attributes = True
          
