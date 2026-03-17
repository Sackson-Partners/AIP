"""Radar API schemas for request/response validation."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal


# Signal schemas
class RadarSignalBase(BaseModel):
    """Base schema for radar signals."""
    source_type: str
    source_name: str
    source_url: Optional[str] = None
    source_date: Optional[datetime] = None
    title: str
    raw_content: Optional[str] = None
    signal_type: Optional[str] = None
    countries: Optional[List[str]] = None
    sectors: Optional[List[str]] = None
    estimated_value_usd: Optional[Decimal] = None


class RadarSignalCreate(RadarSignalBase):
    """Schema for creating a radar signal."""
    pass


class RadarSignalResponse(RadarSignalBase):
    """Schema for radar signal response."""
    id: int
    uuid: str
    content_hash: Optional[str] = None
    is_processed: bool
    processed_at: Optional[datetime] = None
    radar_project_id: Optional[int] = None
    detected_at: datetime

    class Config:
        from_attributes = True


# Corridor schemas
class StrategicCorridorBase(BaseModel):
    """Base schema for strategic corridors."""
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


class StrategicCorridorCreate(StrategicCorridorBase):
    """Schema for creating a strategic corridor."""
    pass


class StrategicCorridorResponse(StrategicCorridorBase):
    """Schema for strategic corridor response."""
    id: int
    uuid: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Project schemas
class RadarProjectBase(BaseModel):
    """Base schema for radar projects."""
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
    status: str = "detected"
    investment_readiness: Optional[str] = None
    timeline: Optional[Dict[str, Any]] = None


class RadarProjectCreate(RadarProjectBase):
    """Schema for creating a radar project."""
    corridor_id: Optional[int] = None


class RadarProjectUpdate(BaseModel):
    """Schema for updating a radar project."""
    name: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    primary_country: Optional[str] = None
    countries: Optional[List[str]] = None
    region: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    project_type: Optional[str] = None
    estimated_investment_usd: Optional[Decimal] = None
    investment_range: Optional[str] = None
    funding_sources: Optional[List[str]] = None
    status: Optional[str] = None
    investment_readiness: Optional[str] = None
    timeline: Optional[Dict[str, Any]] = None
    corridor_id: Optional[int] = None
    editorial_notes: Optional[str] = None
    is_editorial_approved: Optional[bool] = None


class RadarProjectResponse(RadarProjectBase):
    """Schema for radar project response."""
    id: int
    uuid: str
    corridor_id: Optional[int] = None
    strategic_importance: Optional[str] = None
    regional_impact: Optional[str] = None
    investment_opportunity: Optional[str] = None
    risk_factors: Optional[List[Dict[str, Any]]] = None
    key_stakeholders: Optional[List[Dict[str, Any]]] = None
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
    corridor: Optional[StrategicCorridorResponse] = None

    class Config:
        from_attributes = True


class RadarProjectListResponse(BaseModel):
    """Schema for paginated radar project list."""
    items: List[RadarProjectResponse]
    total: int
    page: int
    page_size: int
    pages: int


class RadarCorridorListResponse(BaseModel):
    """Schema for paginated corridor list."""
    items: List[StrategicCorridorResponse]
    total: int
    page: int
    page_size: int
    pages: int


# Analysis request schemas
class AnalyzeSignalRequest(BaseModel):
    """Request schema for analyzing a signal."""
    signal_id: Optional[int] = None
    signal_url: Optional[str] = None
    signal_content: Optional[str] = None
    signal_title: Optional[str] = None
    source_type: Optional[str] = "media"
    source_name: Optional[str] = None


class AnalysisResponse(BaseModel):
    """Response schema for project analysis."""
    project_id: int
    project_uuid: str
    name: str
    analysis: Dict[str, Any]
    confidence_score: float
    processing_time_ms: int
    timestamp: datetime


# Filter schemas
class OpportunityFilter(BaseModel):
    """Filter parameters for investment opportunities."""
    investment_readiness: Optional[List[str]] = None
    min_investment_usd: Optional[Decimal] = None
    max_investment_usd: Optional[Decimal] = None
    sectors: Optional[List[str]] = None
    countries: Optional[List[str]] = None
    regions: Optional[List[str]] = None


class CorridorFilter(BaseModel):
    """Filter parameters for corridors."""
    countries: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    corridor_types: Optional[List[str]] = None
    development_status: Optional[List[str]] = None


# Scan log schemas
class RadarScanLogResponse(BaseModel):
    """Response schema for radar scan logs."""
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
