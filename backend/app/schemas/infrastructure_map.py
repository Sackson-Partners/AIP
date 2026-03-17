"""Infrastructure Map API schemas for request/response validation."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal


# Map Project schemas
class MapProjectBase(BaseModel):
    """Base schema for map projects."""
    name: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    summary: Optional[str] = None
    primary_country: str = Field(..., min_length=1, max_length=100)
    countries: Optional[List[str]] = None
    region: Optional[str] = None
    latitude: Decimal
    longitude: Decimal
    location_name: Optional[str] = None
    geo_json: Optional[Dict[str, Any]] = None
    sector: str = Field(..., min_length=1, max_length=100)
    sub_sector: Optional[str] = None
    project_type: Optional[str] = None
    investment_usd: Optional[Decimal] = None
    investment_range: Optional[str] = None
    capacity_value: Optional[Decimal] = None
    capacity_unit: Optional[str] = None
    status: str = "planned"
    development_phase: Optional[str] = None
    completion_year: Optional[int] = None
    start_year: Optional[int] = None
    sponsor: Optional[str] = None
    developers: Optional[List[str]] = None
    financiers: Optional[List[str]] = None
    government_agencies: Optional[List[str]] = None


class MapProjectCreate(MapProjectBase):
    """Schema for creating a map project."""
    corridor_id: Optional[int] = None
    radar_project_id: Optional[int] = None
    aip_project_id: Optional[int] = None
    is_featured: bool = False
    display_priority: int = 0
    marker_color: Optional[str] = None
    marker_icon: Optional[str] = None
    data_source: Optional[str] = None


class MapProjectUpdate(BaseModel):
    """Schema for updating a map project."""
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    summary: Optional[str] = None
    primary_country: Optional[str] = None
    countries: Optional[List[str]] = None
    region: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    location_name: Optional[str] = None
    geo_json: Optional[Dict[str, Any]] = None
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    project_type: Optional[str] = None
    investment_usd: Optional[Decimal] = None
    investment_range: Optional[str] = None
    capacity_value: Optional[Decimal] = None
    capacity_unit: Optional[str] = None
    status: Optional[str] = None
    development_phase: Optional[str] = None
    completion_year: Optional[int] = None
    start_year: Optional[int] = None
    sponsor: Optional[str] = None
    developers: Optional[List[str]] = None
    financiers: Optional[List[str]] = None
    government_agencies: Optional[List[str]] = None
    corridor_id: Optional[int] = None
    is_featured: Optional[bool] = None
    display_priority: Optional[int] = None
    marker_color: Optional[str] = None
    marker_icon: Optional[str] = None


class MapProjectResponse(MapProjectBase):
    """Schema for map project response."""
    id: int
    uuid: str
    corridor_id: Optional[int] = None
    strategic_importance: Optional[str] = None
    regional_impact: Optional[str] = None
    investment_opportunity: Optional[str] = None
    radar_project_id: Optional[int] = None
    aip_project_id: Optional[int] = None
    is_featured: bool
    display_priority: int
    marker_color: Optional[str] = None
    marker_icon: Optional[str] = None
    data_source: Optional[str] = None
    last_verified: Optional[datetime] = None
    last_brief_generated: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MapProjectListResponse(BaseModel):
    """Schema for paginated map project list."""
    items: List[MapProjectResponse]
    total: int
    page: int
    page_size: int
    pages: int


# GeoJSON response for map display
class MapProjectGeoFeature(BaseModel):
    """GeoJSON Feature for a map project."""
    type: str = "Feature"
    geometry: Dict[str, Any]
    properties: Dict[str, Any]


class MapProjectGeoJSON(BaseModel):
    """GeoJSON FeatureCollection for map projects."""
    type: str = "FeatureCollection"
    features: List[MapProjectGeoFeature]


# Intelligence Brief schemas
class IntelligenceBriefResponse(BaseModel):
    """Schema for intelligence brief response."""
    id: int
    uuid: str
    map_project_id: int
    executive_summary: Optional[str] = None
    strategic_importance: Optional[Dict[str, Any]] = None
    investment_opportunity: Optional[Dict[str, Any]] = None
    regional_impact: Optional[Dict[str, Any]] = None
    risk_assessment: Optional[Dict[str, Any]] = None
    key_milestones: Optional[List[str]] = None
    related_projects: Optional[List[str]] = None
    ai_model_version: Optional[str] = None
    confidence_score: Optional[Decimal] = None
    processing_time_ms: Optional[int] = None
    view_count: int
    generated_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerateBriefRequest(BaseModel):
    """Request schema for generating an intelligence brief."""
    force_regenerate: bool = False


class GenerateBriefResponse(BaseModel):
    """Response schema for brief generation."""
    brief: IntelligenceBriefResponse
    was_cached: bool
    processing_time_ms: int


# Map Layer schemas
class MapLayerBase(BaseModel):
    """Base schema for map layers."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    layer_type: str = Field(..., min_length=1, max_length=50)
    geo_json: Optional[Dict[str, Any]] = None
    style: Optional[Dict[str, Any]] = None
    color: Optional[str] = None
    opacity: Optional[Decimal] = 0.5
    is_active: bool = True
    display_order: int = 0
    min_zoom: int = 0
    max_zoom: int = 22


class MapLayerCreate(MapLayerBase):
    """Schema for creating a map layer."""
    pass


class MapLayerResponse(MapLayerBase):
    """Schema for map layer response."""
    id: int
    uuid: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Filter schemas
class MapFilter(BaseModel):
    """Filter parameters for map projects."""
    sectors: Optional[List[str]] = None
    investment_ranges: Optional[List[str]] = None  # $100M+, $500M+, etc.
    statuses: Optional[List[str]] = None  # planned, under_construction, operational
    regions: Optional[List[str]] = None
    countries: Optional[List[str]] = None
    corridors: Optional[List[int]] = None
    is_featured: Optional[bool] = None
    min_investment_usd: Optional[Decimal] = None
    max_investment_usd: Optional[Decimal] = None


# Bounds for map viewport
class MapBounds(BaseModel):
    """Geographic bounds for filtering."""
    north: Decimal
    south: Decimal
    east: Decimal
    west: Decimal


class MapViewportRequest(BaseModel):
    """Request for projects within viewport."""
    bounds: MapBounds
    zoom: Optional[int] = None
    filters: Optional[MapFilter] = None


# Statistics
class MapStatistics(BaseModel):
    """Statistics for the infrastructure map."""
    total_projects: int
    total_investment_usd: Optional[Decimal] = None
    projects_by_sector: Dict[str, int]
    projects_by_region: Dict[str, int]
    projects_by_status: Dict[str, int]
    projects_by_investment_range: Dict[str, int]
    featured_count: int
