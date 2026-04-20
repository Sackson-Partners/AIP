"""Map service layer - business logic for the Africa Infrastructure Map."""
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.infrastructure_map import InfrastructureMapLayer, InfrastructureAsset

logger = logging.getLogger(__name__)

# Bounding box for Africa (approximate)
AFRICA_BBOX = {
      "min_lat": -35.0,
      "max_lat": 37.5,
      "min_lon": -17.5,
      "max_lon": 51.5,
}


class MapService:
    """Business logic for the Africa Infrastructure Map."""

    def __init__(self, db: Session):
        self.db = db

    # ─── Layer Operations ────────────────────────────────────────────────────

    def get_layer(self, layer_id: int) -> Optional[InfrastructureMapLayer]:
        """Fetch a layer by ID."""
        return self.db.query(InfrastructureMapLayer).filter(
            InfrastructureMapLayer.id == layer_id
        ).first()

    def list_layers(
        self,
        layer_type: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[InfrastructureMapLayer]:
        """Return all layers, optionally filtered."""
        query = self.db.query(InfrastructureMapLayer)
        if layer_type:
            query = query.filter(InfrastructureMapLayer.layer_type == layer_type)
        if is_active is not None:
            query = query.filter(InfrastructureMapLayer.is_active == is_active)
        return query.order_by(InfrastructureMapLayer.sort_order).all()

    # ─── Asset Operations ────────────────────────────────────────────────────

    def get_asset(self, asset_id: int) -> Optional[InfrastructureAsset]:
        """Fetch a single asset by ID."""
        return self.db.query(InfrastructureAsset).filter(
            InfrastructureAsset.id == asset_id
        ).first()

    def get_asset_by_uuid(self, uuid: str) -> Optional[InfrastructureAsset]:
        """Fetch a single asset by UUID."""
        return self.db.query(InfrastructureAsset).filter(
            InfrastructureAsset.uuid == uuid
        ).first()

    def list_assets(
        self,
        country: Optional[str] = None,
        asset_type: Optional[str] = None,
        status: Optional[str] = None,
        layer_id: Optional[int] = None,
        is_featured: Optional[bool] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[InfrastructureAsset], int]:
        """Return paginated assets with optional filters."""
        query = self.db.query(InfrastructureAsset)
        if country:
            query = query.filter(InfrastructureAsset.country == country)
        if asset_type:
            query = query.filter(InfrastructureAsset.asset_type == asset_type)
        if status:
            query = query.filter(InfrastructureAsset.status == status)
        if layer_id is not None:
            query = query.filter(InfrastructureAsset.layer_id == layer_id)
        if is_featured is not None:
            query = query.filter(InfrastructureAsset.is_featured == is_featured)
        total = query.count()
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    def get_assets_in_bbox(
        self,
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
        layer_id: Optional[int] = None,
    ) -> List[InfrastructureAsset]:
        """Return assets within a geographic bounding box."""
        query = self.db.query(InfrastructureAsset).filter(
            InfrastructureAsset.latitude.isnot(None),
            InfrastructureAsset.longitude.isnot(None),
            InfrastructureAsset.latitude >= min_lat,
            InfrastructureAsset.latitude <= max_lat,
            InfrastructureAsset.longitude >= min_lon,
            InfrastructureAsset.longitude <= max_lon,
        )
        if layer_id is not None:
            query = query.filter(InfrastructureAsset.layer_id == layer_id)
        return query.all()

    # ─── GeoJSON ─────────────────────────────────────────────────────────────

    def build_geojson(
        self,
        assets: Optional[List[InfrastructureAsset]] = None,
        country: Optional[str] = None,
        layer_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Build a GeoJSON FeatureCollection from a list (or queried set) of assets."""
                  if assets is None:
            assets, _ = self.list_assets(
                country=country,
                layer_id=layer_id,
                page=1,
                page_size=5000,
            )
        features = []
        for asset in assets:
            if asset.latitude is None or asset.longitude is None:
                continue
                      features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(asset.longitude), float(asset.latitude)],
},
                "properties": {
                    "id": asset.id,
                              "uuid": asset.uuid,
                              "name": asset.name,
                    "asset_type": asset.asset_type,
                    "country": asset.country,
                    "region": asset.region,
                    "status": asset.status,
                    "layer_id": asset.layer_id,
                    "operator": asset.operator,
                    "completion_year": asset.completion_year,
                    "investment_usd": float(asset.investment_usd) if asset.investment_usd else None,
                    "is_verified": asset.is_verified,
                    "is_featured": asset.is_featured,
                              "tags": asset.tags,
},
})
        return {"type": "FeatureCollection", "features": features}

    # ─── Analytics ──────────────────────────────────────────────────────────

    def asset_type_summary(self) -> List[dict]:
        """Return asset count grouped by type."""
        from sqlalchemy import func
        rows = (
            self.db.query(
                InfrastructureAsset.asset_type,
                func.count(InfrastructureAsset.id).label("count"),
            )
            .group_by(InfrastructureAsset.asset_type)
                      .order_by(func.count(InfrastructureAsset.id).desc())
            .all()
                  )
        return [{"asset_type": r.asset_type, "count": r.count} for r in rows]

              def country_asset_summary(self) -> List[dict]:
                  """Return asset count per country."""
        from sqlalchemy import func
        rows = (
            self.db.query(
                InfrastructureAsset.country,
                func.count(InfrastructureAsset.id).label("count"),
            )
            .group_by(InfrastructureAsset.country)
            .order_by(func.count(InfrastructureAsset.id).desc())
                      .all()
                  )
        return [{"country": r.country, "count": r.count} for r in rows]

    def total_investment_by_country(self) -> List[dict]:
        """Return total tracked investment value per country."""
        from sqlalchemy import func
                  rows = (
                      self.db.query(
                InfrastructureAsset.country,
                func.sum(InfrastructureAsset.investment_usd).label("total_investment_usd"),
            )
            .filter(InfrastructureAsset.investment_usd.isnot(None))
            .group_by(InfrastructureAsset.country)
                      .order_by(func.sum(InfrastructureAsset.investment_usd).desc())
            .all()
        )
                  return [
            {
                "country": r.country,
                "total_investment_usd": float(r.total_investment_usd) if r.total_investment_usd else 0,
}
            for r in rows
]
