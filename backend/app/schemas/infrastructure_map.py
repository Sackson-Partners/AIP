"""Infrastructure Map Pydantic schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal


# ─── Map Layer Schemas ───────────────────────────────────────────────────────

class InfrastructureMapLayerCreate(BaseModel):
      """Schema for creating a map layer."""
      name: str = Field(..., min_length=1, max_length=255)
      description: Optional[str] = None
      layer_type: str = Field(..., min_length=1, max_length=50)
      color_hex: str = Field(default="#1E88E5", max_length=7)
      icon: Optional[str] = Field(None, max_length=100)
      is_active: bool = True
      sort_order: int = 0


class InfrastructureMapLayerResponse(BaseModel):
      """Schema for map layer response."""
      id: int
      uuid: str
      name: str
      description: Optional[str] = None
      layer_type: str
      color_hex: str
      icon: Optional[str] = None
      is_active: bool
      sort_order: int
      created_at: datetime

    class Config:
              from_attributes = True


# ─── Infrastructure Asset Schemas ────────────────────────────────────────────

class InfrastructureAssetCreate(BaseModel):
      """Schema for creating an infrastructure asset."""
      layer_id: Optional[int] = None
      project_id: Optional[int] = None
      name: str = Field(..., min_length=1, max_length=255)
      asset_type: str = Field(..., min_length=1, max_length=100)
      country: str = Field(..., min_length=1, max_length=100)
      region: Optional[str] = Field(None, max_length=100)
      city: Optional[str] = Field(None, max_length=100)
      address: Optional[str] = Field(None, max_length=500)
      latitude: Optional[Decimal] = None
      longitude: Optional[Decimal] = None
      geometry_json: Optional[Dict[str, Any]] = None
      status: str = Field(default="planned", max_length=50)
      completion_year: Optional[int] = None
      operator: Optional[str] = Field(None, max_length=255)
      owner: Optional[str] = Field(None, max_length=255)
      capacity_value: Optional[Decimal] = None
      capacity_unit: Optional[str] = Field(None, max_length=50)
      investment_usd: Optional[Decimal] = None
      funding_source: Optional[str] = Field(None, max_length=500)
      description: Optional[str] = None
      tags: Optional[str] = Field(None, max_length=500)
      data_source: Optional[str] = Field(None, max_length=255)
      external_id: Optional[str] = Field(None, max_length=255)
      is_verified: bool = False
      is_featured: bool = False


class InfrastructureAssetUpdate(BaseModel):
      """Schema for updating an infrastructure asset."""
      layer_id: Optional[int] = None
      name: Optional[str] = Field(None, min_length=1, max_length=255)
      asset_type: Optional[str] = Field(None, max_length=100)
      country: Optional[str] = Field(None, max_length=100)
      region: Optional[str] = Field(None, max_length=100)
      city: Optional[str] = Field(None, max_length=100)
      address: Optional[str] = Field(None, max_length=500)
      latitude: Optional[Decimal] = None
      longitude: Optional[Decimal] = None
      geometry_json: Optional[Dict[str, Any]] = None
      status: Optional[str] = Field(None, max_length=50)
      completion_year: Optional[int] = None
      operator: Optional[str] = Field(None, max_length=255)
      owner: Optional[str] = Field(None, max_length=255)
      capacity_value: Optional[Decimal] = None
      capacity_unit: Optional[str] = Field(None, max_length=50)
      investment_usd: Optional[Decimal] = None
      funding_source: Optional[str] = Field(None, max_length=500)
      description: Optional[str] = None
      tags: Optional[str] = Field(None, max_length=500)
      is_verified: Optional[bool] = None
      is_featured: Optional[bool] = None


class InfrastructureAssetResponse(BaseModel):
      """Schema for infrastructure asset response."""
      id: int
      uuid: str
      layer_id: Optional[int] = None
      project_id: Optional[int] = None
      name: str
      asset_type: str
      country: str
      region: Optional[str] = None
      city: Optional[str] = None
      address: Optional[str] = None
      latitude: Optional[Decimal] = None
      longitude: Optional[Decimal] = None
      geometry_json: Optional[Dict[str, Any]] = None
      status: str
      completion_year: Optional[int] = None
      operator: Optional[str] = None
      owner: Optional[str] = None
      capacity_value: Optional[Decimal] = None
      capacity_unit: Optional[str] = None
      investment_usd: Optional[Decimal] = None
      funding_source: Optional[str] = None
      description: Optional[str] = None
      tags: Optional[str] = None
      data_source: Optional[str] = None
      external_id: Optional[str] = None
      is_verified: bool
      is_featured: bool
      added_by: Optional[int] = None
      created_at: datetime
      updated_at: datetime

    class Config:
              from_attributes = True


class InfrastructureAssetListResponse(BaseModel):
      """Schema for paginated infrastructure asset list."""
      items: List[InfrastructureAssetResponse]
      total: int
      page: int
      page_size: int
      pages: int
