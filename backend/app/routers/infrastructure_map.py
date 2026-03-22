"""Infrastructure Map router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.infrastructure_map import InfrastructureMapLayer, InfrastructureAsset
from app.schemas.infrastructure_map import (
    InfrastructureMapLayerCreate, InfrastructureMapLayerResponse,
    InfrastructureAssetCreate, InfrastructureAssetUpdate, InfrastructureAssetResponse,
    InfrastructureAssetListResponse
)
from .auth import require_auth

router = APIRouter(prefix="/infrastructure-map", tags=["Infrastructure Map"])


# ─── Map Layers ─────────────────────────────────────────────────────────────

@router.post("/layers", response_model=InfrastructureMapLayerResponse,
                          status_code=status.HTTP_201_CREATED)
def create_layer(
      layer_data: InfrastructureMapLayerCreate,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Create a new map layer."""
      layer = InfrastructureMapLayer(**layer_data.model_dump())
      db.add(layer)
      db.commit()
      db.refresh(layer)
      return layer


@router.get("/layers", response_model=List[InfrastructureMapLayerResponse])
def list_layers(
      layer_type: Optional[str] = None,
      is_active: Optional[bool] = None,
      db: Session = Depends(get_db)
):
      """List all map layers."""
      query = db.query(InfrastructureMapLayer)
      if layer_type:
                query = query.filter(InfrastructureMapLayer.layer_type == layer_type)
            if is_active is not None:
                      query = query.filter(InfrastructureMapLayer.is_active == is_active)
                  return query.order_by(InfrastructureMapLayer.sort_order).all()


@router.get("/layers/{layer_id}", response_model=InfrastructureMapLayerResponse)
def get_layer(layer_id: int, db: Session = Depends(get_db)):
      """Get a map layer by ID."""
    layer = db.query(InfrastructureMapLayer).filter(
              InfrastructureMapLayer.id == layer_id
    ).first()
    if not layer:
              raise HTTPException(status_code=404, detail="Layer not found")
          return layer


@router.delete("/layers/{layer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_layer(
      layer_id: int,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Delete a map layer and all its assets."""
    layer = db.query(InfrastructureMapLayer).filter(
              InfrastructureMapLayer.id == layer_id
    ).first()
    if not layer:
              raise HTTPException(status_code=404, detail="Layer not found")
          db.delete(layer)
    db.commit()


# ─── Infrastructure Assets ──────────────────────────────────────────────────

@router.post("/assets", response_model=InfrastructureAssetResponse,
                          status_code=status.HTTP_201_CREATED)
def create_asset(
      asset_data: InfrastructureAssetCreate,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Add an infrastructure asset to the map."""
    asset = InfrastructureAsset(**asset_data.model_dump(), added_by=current_user.id)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/assets", response_model=InfrastructureAssetListResponse)
def list_assets(
      page: int = Query(1, ge=1),
      page_size: int = Query(50, ge=1, le=200),
      country: Optional[str] = None,
      asset_type: Optional[str] = None,
      status_filter: Optional[str] = Query(None, alias="status"),
      layer_id: Optional[int] = None,
      is_featured: Optional[bool] = None,
      db: Session = Depends(get_db)
):
      """List infrastructure assets with optional filters."""
    query = db.query(InfrastructureAsset)
    if country:
              query = query.filter(InfrastructureAsset.country == country)
          if asset_type:
                    query = query.filter(InfrastructureAsset.asset_type == asset_type)
                if status_filter:
                          query = query.filter(InfrastructureAsset.status == status_filter)
                      if layer_id is not None:
                                query = query.filter(InfrastructureAsset.layer_id == layer_id)
                            if is_featured is not None:
                                      query = query.filter(InfrastructureAsset.is_featured == is_featured)
                                  total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return InfrastructureAssetListResponse(
              items=items,
              total=total,
              page=page,
              page_size=page_size,
              pages=(total + page_size - 1) // page_size
    )


@router.get("/assets/{asset_id}", response_model=InfrastructureAssetResponse)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
      """Get a single infrastructure asset."""
      asset = db.query(InfrastructureAsset).filter(
          InfrastructureAsset.id == asset_id
      ).first()
      if not asset:
                raise HTTPException(status_code=404, detail="Asset not found")
            return asset


@router.put("/assets/{asset_id}", response_model=InfrastructureAssetResponse)
def update_asset(
      asset_id: int,
      asset_data: InfrastructureAssetUpdate,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Update an infrastructure asset."""
    asset = db.query(InfrastructureAsset).filter(
              InfrastructureAsset.id == asset_id
    ).first()
    if not asset:
              raise HTTPException(status_code=404, detail="Asset not found")
          for field, value in asset_data.model_dump(exclude_unset=True).items():
                    setattr(asset, field, value)
                db.commit()
    db.refresh(asset)
    return asset


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
      asset_id: int,
      current_user: User = Depends(require_auth),
      db: Session = Depends(get_db)
):
      """Delete an infrastructure asset."""
    asset = db.query(InfrastructureAsset).filter(
              InfrastructureAsset.id == asset_id
    ).first()
    if not asset:
              raise HTTPException(status_code=404, detail="Asset not found")
          db.delete(asset)
    db.commit()


@router.get("/geojson", tags=["Infrastructure Map"])
def get_geojson(
      country: Optional[str] = None,
      layer_id: Optional[int] = None,
      db: Session = Depends(get_db)
):
      """Return all assets as a GeoJSON FeatureCollection for map rendering."""
    query = db.query(InfrastructureAsset).filter(
              InfrastructureAsset.latitude.isnot(None),
              InfrastructureAsset.longitude.isnot(None)
    )
    if country:
              query = query.filter(InfrastructureAsset.country == country)
          if layer_id is not None:
                    query = query.filter(InfrastructureAsset.layer_id == layer_id)
                assets = query.all()
    features = []
    for asset in assets:
              features.append({
                            "type": "Feature",
                            "geometry": {
                                              "type": "Point",
                                              "coordinates": [float(asset.longitude), float(asset.latitude)]
                            },
                            "properties": {
                                              "id": asset.id,
                                              "name": asset.name,
                                              "asset_type": asset.asset_type,
                                              "country": asset.country,
                                              "status": asset.status,
                                              "layer_id": asset.layer_id,
                                              "investment_usd": float(asset.investment_usd) if asset.investment_usd else None
                            }
              })
          return {"type": "FeatureCollection", "features": features}
