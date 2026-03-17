"""
Strategic Intelligence Map API endpoints.

Provides endpoints for:
- Map project listing and filtering
- GeoJSON data for map display
- Intelligence brief generation
- Map layers management
"""
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.core.database import get_db
from app.models.user import User
from app.models.infrastructure_map import InfrastructureMapProject, IntelligenceBrief, MapLayer
from app.schemas.infrastructure_map import (
    MapProjectCreate,
    MapProjectUpdate,
    MapProjectResponse,
    MapProjectListResponse,
    MapProjectGeoJSON,
    MapProjectGeoFeature,
    IntelligenceBriefResponse,
    GenerateBriefRequest,
    GenerateBriefResponse,
    MapLayerCreate,
    MapLayerResponse,
    MapStatistics,
    MapBounds,
)
from app.services.map_service import map_service, FEATURED_PROJECTS_SEED
from .auth import require_auth, optional_auth

router = APIRouter(prefix="/map", tags=["Strategic Map"])


# ============================================================================
# Map Project Endpoints
# ============================================================================

@router.get("/projects", response_model=MapProjectListResponse)
async def list_map_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sector: Optional[str] = None,
    sectors: Optional[List[str]] = Query(None),
    region: Optional[str] = None,
    regions: Optional[List[str]] = Query(None),
    country: Optional[str] = None,
    countries: Optional[List[str]] = Query(None),
    status: Optional[str] = None,
    statuses: Optional[List[str]] = Query(None),
    investment_range: Optional[str] = None,
    investment_ranges: Optional[List[str]] = Query(None),
    corridor_id: Optional[int] = None,
    is_featured: Optional[bool] = None,
    min_investment_usd: Optional[float] = None,
    max_investment_usd: Optional[float] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List infrastructure projects for the Strategic Intelligence Map.

    Supports extensive filtering by sector, region, country, status, and investment size.
    """
    query = db.query(InfrastructureMapProject)

    # Single value filters
    if sector:
        query = query.filter(InfrastructureMapProject.sector == sector)
    if region:
        query = query.filter(InfrastructureMapProject.region == region)
    if country:
        query = query.filter(InfrastructureMapProject.primary_country == country)
    if status:
        query = query.filter(InfrastructureMapProject.status == status)
    if investment_range:
        query = query.filter(InfrastructureMapProject.investment_range == investment_range)
    if corridor_id:
        query = query.filter(InfrastructureMapProject.corridor_id == corridor_id)
    if is_featured is not None:
        query = query.filter(InfrastructureMapProject.is_featured == is_featured)

    # Multi-value filters
    if sectors:
        query = query.filter(InfrastructureMapProject.sector.in_(sectors))
    if regions:
        query = query.filter(InfrastructureMapProject.region.in_(regions))
    if countries:
        query = query.filter(InfrastructureMapProject.primary_country.in_(countries))
    if statuses:
        query = query.filter(InfrastructureMapProject.status.in_(statuses))
    if investment_ranges:
        query = query.filter(InfrastructureMapProject.investment_range.in_(investment_ranges))

    # Investment range filters
    if min_investment_usd:
        query = query.filter(InfrastructureMapProject.investment_usd >= min_investment_usd)
    if max_investment_usd:
        query = query.filter(InfrastructureMapProject.investment_usd <= max_investment_usd)

    # Search filter
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                InfrastructureMapProject.name.ilike(search_filter),
                InfrastructureMapProject.description.ilike(search_filter),
                InfrastructureMapProject.summary.ilike(search_filter),
                InfrastructureMapProject.sponsor.ilike(search_filter)
            )
        )

    # Order by featured status and priority, then by investment size
    query = query.order_by(
        InfrastructureMapProject.is_featured.desc(),
        InfrastructureMapProject.display_priority.desc(),
        InfrastructureMapProject.investment_usd.desc().nullslast()
    )

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return MapProjectListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0
    )


@router.get("/projects/geojson", response_model=MapProjectGeoJSON)
async def get_projects_geojson(
    sectors: Optional[List[str]] = Query(None),
    regions: Optional[List[str]] = Query(None),
    countries: Optional[List[str]] = Query(None),
    statuses: Optional[List[str]] = Query(None),
    investment_ranges: Optional[List[str]] = Query(None),
    corridor_id: Optional[int] = None,
    is_featured: Optional[bool] = None,
    north: Optional[float] = None,
    south: Optional[float] = None,
    east: Optional[float] = None,
    west: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Get projects as GeoJSON FeatureCollection for map display.

    Supports filtering and optional bounding box for viewport-based loading.
    """
    query = db.query(InfrastructureMapProject)

    # Apply filters
    if sectors:
        query = query.filter(InfrastructureMapProject.sector.in_(sectors))
    if regions:
        query = query.filter(InfrastructureMapProject.region.in_(regions))
    if countries:
        query = query.filter(InfrastructureMapProject.primary_country.in_(countries))
    if statuses:
        query = query.filter(InfrastructureMapProject.status.in_(statuses))
    if investment_ranges:
        query = query.filter(InfrastructureMapProject.investment_range.in_(investment_ranges))
    if corridor_id:
        query = query.filter(InfrastructureMapProject.corridor_id == corridor_id)
    if is_featured is not None:
        query = query.filter(InfrastructureMapProject.is_featured == is_featured)

    # Bounding box filter
    if all(v is not None for v in [north, south, east, west]):
        query = query.filter(
            and_(
                InfrastructureMapProject.latitude >= south,
                InfrastructureMapProject.latitude <= north,
                InfrastructureMapProject.longitude >= west,
                InfrastructureMapProject.longitude <= east
            )
        )

    projects = query.all()

    # Convert to GeoJSON
    features = []
    for project in projects:
        marker_style = map_service.get_marker_style(
            project.sector,
            project.status,
            project.is_featured
        )

        feature = MapProjectGeoFeature(
            type="Feature",
            geometry={
                "type": "Point",
                "coordinates": [float(project.longitude), float(project.latitude)]
            },
            properties={
                "id": project.id,
                "uuid": project.uuid,
                "name": project.name,
                "sector": project.sector,
                "sub_sector": project.sub_sector,
                "country": project.primary_country,
                "region": project.region,
                "investment_usd": float(project.investment_usd) if project.investment_usd else None,
                "investment_range": project.investment_range,
                "status": project.status,
                "is_featured": project.is_featured,
                "marker_color": project.marker_color or marker_style["color"],
                "marker_icon": project.marker_icon or marker_style["icon"],
                "marker_size": marker_style["size"],
                "opacity": marker_style["opacity"],
            }
        )
        features.append(feature)

    return MapProjectGeoJSON(
        type="FeatureCollection",
        features=features
    )


@router.get("/projects/{project_id}", response_model=MapProjectResponse)
async def get_map_project(project_id: int, db: Session = Depends(get_db)):
    """Get a specific map project by ID."""
    project = db.query(InfrastructureMapProject).filter(
        InfrastructureMapProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Map project not found")
    return project


@router.post("/projects", response_model=MapProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_map_project(
    project_data: MapProjectCreate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Create a new map project."""
    # Calculate investment range if not provided
    investment_range = project_data.investment_range
    if not investment_range and project_data.investment_usd:
        investment_range = map_service.calculate_investment_range(
            float(project_data.investment_usd)
        )

    project = InfrastructureMapProject(
        name=project_data.name,
        description=project_data.description,
        summary=project_data.summary,
        primary_country=project_data.primary_country,
        countries=project_data.countries,
        region=project_data.region,
        latitude=project_data.latitude,
        longitude=project_data.longitude,
        location_name=project_data.location_name,
        geo_json=project_data.geo_json,
        sector=project_data.sector,
        sub_sector=project_data.sub_sector,
        project_type=project_data.project_type,
        investment_usd=project_data.investment_usd,
        investment_range=investment_range,
        capacity_value=project_data.capacity_value,
        capacity_unit=project_data.capacity_unit,
        status=project_data.status,
        development_phase=project_data.development_phase,
        completion_year=project_data.completion_year,
        start_year=project_data.start_year,
        sponsor=project_data.sponsor,
        developers=project_data.developers,
        financiers=project_data.financiers,
        government_agencies=project_data.government_agencies,
        corridor_id=project_data.corridor_id,
        radar_project_id=project_data.radar_project_id,
        aip_project_id=project_data.aip_project_id,
        is_featured=project_data.is_featured,
        display_priority=project_data.display_priority,
        marker_color=project_data.marker_color,
        marker_icon=project_data.marker_icon,
        data_source=project_data.data_source,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=MapProjectResponse)
async def update_map_project(
    project_id: int,
    project_data: MapProjectUpdate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update a map project."""
    project = db.query(InfrastructureMapProject).filter(
        InfrastructureMapProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Map project not found")

    update_data = project_data.model_dump(exclude_unset=True)

    # Recalculate investment range if investment changed
    if "investment_usd" in update_data and update_data["investment_usd"]:
        if "investment_range" not in update_data:
            update_data["investment_range"] = map_service.calculate_investment_range(
                float(update_data["investment_usd"])
            )

    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_map_project(
    project_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Delete a map project."""
    project = db.query(InfrastructureMapProject).filter(
        InfrastructureMapProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Map project not found")

    db.delete(project)
    db.commit()


# ============================================================================
# Intelligence Brief Endpoints
# ============================================================================

@router.post("/projects/{project_id}/brief", response_model=GenerateBriefResponse)
async def generate_intelligence_brief(
    project_id: int,
    request: GenerateBriefRequest = GenerateBriefRequest(),
    current_user: User = Depends(optional_auth),
    db: Session = Depends(get_db)
):
    """
    Generate an AI-powered intelligence brief for a project.

    Uses Claude API to generate comprehensive strategic analysis.
    Returns cached brief if available and not expired.
    """
    import time
    start_time = time.time()

    project = db.query(InfrastructureMapProject).filter(
        InfrastructureMapProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Map project not found")

    # Check for existing brief
    existing_brief = db.query(IntelligenceBrief).filter(
        IntelligenceBrief.map_project_id == project_id
    ).order_by(IntelligenceBrief.generated_at.desc()).first()

    # Return cached brief if valid and not forcing regeneration
    if existing_brief and not request.force_regenerate:
        if existing_brief.expires_at is None or existing_brief.expires_at > datetime.utcnow():
            # Update view count
            existing_brief.view_count += 1
            existing_brief.last_viewed = datetime.utcnow()
            db.commit()

            total_time = int((time.time() - start_time) * 1000)
            return GenerateBriefResponse(
                brief=existing_brief,
                was_cached=True,
                processing_time_ms=total_time
            )

    # Generate new brief
    result = await map_service.generate_intelligence_brief(
        name=project.name,
        sector=project.sector,
        sub_sector=project.sub_sector,
        country=project.primary_country,
        region=project.region,
        location_name=project.location_name,
        investment_usd=float(project.investment_usd) if project.investment_usd else None,
        status=project.status,
        development_phase=project.development_phase,
        sponsor=project.sponsor,
        description=project.description
    )

    # Create new brief record
    brief = IntelligenceBrief(
        map_project_id=project_id,
        executive_summary=result.executive_summary,
        strategic_importance=result.strategic_importance,
        investment_opportunity=result.investment_opportunity,
        regional_impact=result.regional_impact,
        risk_assessment=result.risk_assessment,
        key_milestones=result.key_milestones,
        related_projects=result.related_projects,
        ai_model_version="claude-sonnet-4",
        confidence_score=result.confidence_score,
        processing_time_ms=result.processing_time_ms,
        view_count=1,
        last_viewed=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=7)  # Cache for 7 days
    )

    db.add(brief)

    # Update project's cached brief
    project.last_brief_generated = datetime.utcnow()
    project.brief_content = {
        "executive_summary": result.executive_summary,
        "strategic_importance": result.strategic_importance,
        "investment_opportunity": result.investment_opportunity,
    }

    db.commit()
    db.refresh(brief)

    total_time = int((time.time() - start_time) * 1000)
    return GenerateBriefResponse(
        brief=brief,
        was_cached=False,
        processing_time_ms=total_time
    )


@router.get("/projects/{project_id}/brief", response_model=IntelligenceBriefResponse)
async def get_intelligence_brief(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Get the most recent intelligence brief for a project."""
    brief = db.query(IntelligenceBrief).filter(
        IntelligenceBrief.map_project_id == project_id
    ).order_by(IntelligenceBrief.generated_at.desc()).first()

    if not brief:
        raise HTTPException(
            status_code=404,
            detail="No intelligence brief found. Use POST to generate one."
        )

    # Update view count
    brief.view_count += 1
    brief.last_viewed = datetime.utcnow()
    db.commit()

    return brief


# ============================================================================
# Map Layers Endpoints
# ============================================================================

@router.get("/layers", response_model=List[MapLayerResponse])
async def list_map_layers(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get all map layers."""
    query = db.query(MapLayer)
    if active_only:
        query = query.filter(MapLayer.is_active == True)
    return query.order_by(MapLayer.display_order).all()


@router.post("/layers", response_model=MapLayerResponse, status_code=status.HTTP_201_CREATED)
async def create_map_layer(
    layer_data: MapLayerCreate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Create a new map layer."""
    layer = MapLayer(
        name=layer_data.name,
        description=layer_data.description,
        layer_type=layer_data.layer_type,
        geo_json=layer_data.geo_json,
        style=layer_data.style,
        color=layer_data.color,
        opacity=layer_data.opacity,
        is_active=layer_data.is_active,
        display_order=layer_data.display_order,
        min_zoom=layer_data.min_zoom,
        max_zoom=layer_data.max_zoom,
    )
    db.add(layer)
    db.commit()
    db.refresh(layer)
    return layer


@router.get("/layers/{layer_id}", response_model=MapLayerResponse)
async def get_map_layer(layer_id: int, db: Session = Depends(get_db)):
    """Get a specific map layer."""
    layer = db.query(MapLayer).filter(MapLayer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Map layer not found")
    return layer


# ============================================================================
# Statistics and Utilities
# ============================================================================

@router.get("/stats", response_model=MapStatistics)
async def get_map_statistics(db: Session = Depends(get_db)):
    """Get statistics for the infrastructure map."""
    total_projects = db.query(InfrastructureMapProject).count()
    featured_count = db.query(InfrastructureMapProject).filter(
        InfrastructureMapProject.is_featured == True
    ).count()

    # Total investment
    total_investment = db.query(func.sum(InfrastructureMapProject.investment_usd)).scalar()

    # Projects by sector
    sector_counts = db.query(
        InfrastructureMapProject.sector,
        func.count(InfrastructureMapProject.id)
    ).group_by(InfrastructureMapProject.sector).all()

    # Projects by region
    region_counts = db.query(
        InfrastructureMapProject.region,
        func.count(InfrastructureMapProject.id)
    ).group_by(InfrastructureMapProject.region).all()

    # Projects by status
    status_counts = db.query(
        InfrastructureMapProject.status,
        func.count(InfrastructureMapProject.id)
    ).group_by(InfrastructureMapProject.status).all()

    # Projects by investment range
    range_counts = db.query(
        InfrastructureMapProject.investment_range,
        func.count(InfrastructureMapProject.id)
    ).group_by(InfrastructureMapProject.investment_range).all()

    return MapStatistics(
        total_projects=total_projects,
        total_investment_usd=total_investment,
        projects_by_sector={s: c for s, c in sector_counts if s},
        projects_by_region={r: c for r, c in region_counts if r},
        projects_by_status={s: c for s, c in status_counts if s},
        projects_by_investment_range={r: c for r, c in range_counts if r},
        featured_count=featured_count
    )


@router.get("/sectors")
async def get_available_sectors(db: Session = Depends(get_db)):
    """Get list of available sectors."""
    sectors = db.query(InfrastructureMapProject.sector).distinct().all()
    return [s[0] for s in sectors if s[0]]


@router.get("/regions")
async def get_available_regions(db: Session = Depends(get_db)):
    """Get list of available regions."""
    regions = db.query(InfrastructureMapProject.region).distinct().all()
    return [r[0] for r in regions if r[0]]


@router.get("/countries")
async def get_available_countries(db: Session = Depends(get_db)):
    """Get list of available countries."""
    countries = db.query(InfrastructureMapProject.primary_country).distinct().all()
    return sorted([c[0] for c in countries if c[0]])


# ============================================================================
# Seed Data Endpoint
# ============================================================================

@router.post("/seed-featured", status_code=status.HTTP_201_CREATED)
async def seed_featured_projects(
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Seed the database with featured infrastructure projects.

    This creates the initial set of major projects for the map.
    """
    created = []

    for project_data in FEATURED_PROJECTS_SEED:
        # Check if project already exists
        existing = db.query(InfrastructureMapProject).filter(
            InfrastructureMapProject.name == project_data["name"]
        ).first()

        if not existing:
            project = InfrastructureMapProject(**project_data)
            db.add(project)
            created.append(project_data["name"])

    db.commit()

    return {
        "message": f"Seeded {len(created)} featured projects",
        "projects": created
    }
