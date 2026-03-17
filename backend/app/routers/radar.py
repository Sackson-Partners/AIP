"""
Africa Infrastructure Radar API endpoints.

Provides endpoints for:
- GET /api/radar/projects - List all detected and analyzed projects
- GET /api/radar/opportunities - Filter projects by investment readiness
- GET /api/radar/corridors - View strategic regional corridors
- POST /api/radar/analyze - Trigger AI analysis on a new project signal
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.user import User
from app.models.radar import RadarProject, RadarSignal, StrategicCorridor, RadarScanLog
from app.schemas.radar import (
    RadarProjectCreate,
    RadarProjectUpdate,
    RadarProjectResponse,
    RadarProjectListResponse,
    StrategicCorridorCreate,
    StrategicCorridorResponse,
    RadarCorridorListResponse,
    RadarSignalCreate,
    RadarSignalResponse,
    AnalyzeSignalRequest,
    AnalysisResponse,
    RadarScanLogResponse,
)
from app.services.radar_service import radar_service
from .auth import require_auth, optional_auth

router = APIRouter(prefix="/radar", tags=["Radar"])


# ============================================================================
# Project Endpoints
# ============================================================================

@router.get("/projects", response_model=RadarProjectListResponse)
async def list_radar_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sector: Optional[str] = None,
    region: Optional[str] = None,
    country: Optional[str] = None,
    status: Optional[str] = None,
    investment_range: Optional[str] = None,
    corridor_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all detected and analyzed infrastructure projects.

    Supports filtering by sector, region, country, status, and investment range.
    """
    query = db.query(RadarProject)

    # Apply filters
    if sector:
        query = query.filter(RadarProject.sector == sector)
    if region:
        query = query.filter(RadarProject.region == region)
    if country:
        query = query.filter(RadarProject.primary_country == country)
    if status:
        query = query.filter(RadarProject.status == status)
    if investment_range:
        query = query.filter(RadarProject.investment_range == investment_range)
    if corridor_id:
        query = query.filter(RadarProject.corridor_id == corridor_id)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                RadarProject.name.ilike(search_filter),
                RadarProject.description.ilike(search_filter),
                RadarProject.summary.ilike(search_filter)
            )
        )

    # Order by most recent
    query = query.order_by(RadarProject.created_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return RadarProjectListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0
    )


@router.get("/projects/{project_id}", response_model=RadarProjectResponse)
async def get_radar_project(project_id: int, db: Session = Depends(get_db)):
    """Get a specific radar project by ID."""
    project = db.query(RadarProject).filter(RadarProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Radar project not found")
    return project


@router.post("/projects", response_model=RadarProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_radar_project(
    project_data: RadarProjectCreate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Create a new radar project manually."""
    project = RadarProject(
        name=project_data.name,
        description=project_data.description,
        summary=project_data.summary,
        primary_country=project_data.primary_country,
        countries=project_data.countries,
        region=project_data.region,
        latitude=project_data.latitude,
        longitude=project_data.longitude,
        sector=project_data.sector,
        sub_sector=project_data.sub_sector,
        project_type=project_data.project_type,
        estimated_investment_usd=project_data.estimated_investment_usd,
        investment_range=project_data.investment_range,
        funding_sources=project_data.funding_sources,
        status=project_data.status,
        investment_readiness=project_data.investment_readiness,
        timeline=project_data.timeline,
        corridor_id=project_data.corridor_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=RadarProjectResponse)
async def update_radar_project(
    project_id: int,
    project_data: RadarProjectUpdate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update a radar project."""
    project = db.query(RadarProject).filter(RadarProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Radar project not found")

    for field, value in project_data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


# ============================================================================
# Opportunities Endpoints
# ============================================================================

@router.get("/opportunities", response_model=RadarProjectListResponse)
async def list_investment_opportunities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    investment_readiness: Optional[List[str]] = Query(None),
    min_investment_usd: Optional[float] = None,
    max_investment_usd: Optional[float] = None,
    sectors: Optional[List[str]] = Query(None),
    countries: Optional[List[str]] = Query(None),
    regions: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Filter projects by investment readiness and opportunity parameters.

    Returns projects that are actively seeking investment or in tender phases.
    """
    query = db.query(RadarProject)

    # Filter by investment readiness - default to active opportunities
    active_readiness = ["tender_open", "financing_sought", "feasibility"]
    if investment_readiness:
        query = query.filter(RadarProject.investment_readiness.in_(investment_readiness))
    else:
        query = query.filter(RadarProject.investment_readiness.in_(active_readiness))

    # Investment size filters
    if min_investment_usd:
        query = query.filter(RadarProject.estimated_investment_usd >= min_investment_usd)
    if max_investment_usd:
        query = query.filter(RadarProject.estimated_investment_usd <= max_investment_usd)

    # Multi-value filters
    if sectors:
        query = query.filter(RadarProject.sector.in_(sectors))
    if regions:
        query = query.filter(RadarProject.region.in_(regions))
    if countries:
        query = query.filter(RadarProject.primary_country.in_(countries))

    # Order by investment size (largest first)
    query = query.order_by(RadarProject.estimated_investment_usd.desc().nullslast())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return RadarProjectListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0
    )


# ============================================================================
# Corridors Endpoints
# ============================================================================

@router.get("/corridors", response_model=RadarCorridorListResponse)
async def list_strategic_corridors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    country: Optional[str] = None,
    region: Optional[str] = None,
    corridor_type: Optional[str] = None,
    development_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    View strategic regional corridors across Africa.

    Corridors represent multi-country infrastructure initiatives.
    """
    query = db.query(StrategicCorridor)

    if corridor_type:
        query = query.filter(StrategicCorridor.corridor_type == corridor_type)
    if development_status:
        query = query.filter(StrategicCorridor.development_status == development_status)

    # Filter by country (check JSON array)
    # Note: For production, consider using proper JSON operators based on your database
    if country:
        query = query.filter(StrategicCorridor.countries.contains([country]))

    query = query.order_by(StrategicCorridor.name)

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return RadarCorridorListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0
    )


@router.get("/corridors/{corridor_id}", response_model=StrategicCorridorResponse)
async def get_strategic_corridor(corridor_id: int, db: Session = Depends(get_db)):
    """Get a specific strategic corridor by ID."""
    corridor = db.query(StrategicCorridor).filter(StrategicCorridor.id == corridor_id).first()
    if not corridor:
        raise HTTPException(status_code=404, detail="Strategic corridor not found")
    return corridor


@router.post("/corridors", response_model=StrategicCorridorResponse, status_code=status.HTTP_201_CREATED)
async def create_strategic_corridor(
    corridor_data: StrategicCorridorCreate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Create a new strategic corridor."""
    # Check for duplicate name
    existing = db.query(StrategicCorridor).filter(
        StrategicCorridor.name == corridor_data.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A corridor with this name already exists"
        )

    corridor = StrategicCorridor(
        name=corridor_data.name,
        description=corridor_data.description,
        countries=corridor_data.countries,
        regions=corridor_data.regions,
        coordinates=corridor_data.coordinates,
        corridor_type=corridor_data.corridor_type,
        primary_sector=corridor_data.primary_sector,
        total_investment_usd=corridor_data.total_investment_usd,
        length_km=corridor_data.length_km,
        strategic_significance=corridor_data.strategic_significance,
        economic_impact=corridor_data.economic_impact,
        key_infrastructure=corridor_data.key_infrastructure,
        development_status=corridor_data.development_status,
        completion_target=corridor_data.completion_target,
    )
    db.add(corridor)
    db.commit()
    db.refresh(corridor)
    return corridor


@router.get("/corridors/{corridor_id}/projects", response_model=RadarProjectListResponse)
async def get_corridor_projects(
    corridor_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get all projects associated with a corridor."""
    corridor = db.query(StrategicCorridor).filter(StrategicCorridor.id == corridor_id).first()
    if not corridor:
        raise HTTPException(status_code=404, detail="Strategic corridor not found")

    query = db.query(RadarProject).filter(RadarProject.corridor_id == corridor_id)
    query = query.order_by(RadarProject.estimated_investment_usd.desc().nullslast())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return RadarProjectListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0
    )


# ============================================================================
# Analysis Endpoints
# ============================================================================

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_signal(
    request: AnalyzeSignalRequest,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """
    Trigger AI analysis on a new project signal.

    Accepts either:
    - signal_id: ID of an existing unprocessed signal
    - signal_content + signal_title: Raw content to analyze

    Returns the analyzed project with AI-generated intelligence.
    """
    signal = None
    content = request.signal_content
    title = request.signal_title
    source_name = request.source_name or "Manual Input"
    source_type = request.source_type

    # If signal_id provided, fetch the signal
    if request.signal_id:
        signal = db.query(RadarSignal).filter(RadarSignal.id == request.signal_id).first()
        if not signal:
            raise HTTPException(status_code=404, detail="Signal not found")
        if signal.is_processed:
            raise HTTPException(status_code=400, detail="Signal already processed")

        content = signal.raw_content
        title = signal.title
        source_name = signal.source_name
        source_type = signal.source_type

    if not content or not title:
        raise HTTPException(
            status_code=400,
            detail="Either signal_id or both signal_content and signal_title required"
        )

    # Run AI analysis
    analysis_result = await radar_service.analyze_signal(
        title=title,
        content=content,
        source_name=source_name,
        source_type=source_type
    )

    # Determine investment range
    investment_range = radar_service.classify_investment_range(
        analysis_result.estimated_investment_usd
    )

    # Create the radar project
    project = RadarProject(
        name=analysis_result.project_name,
        description=content[:2000] if content else None,  # Store truncated original
        summary=analysis_result.summary,
        primary_country=analysis_result.primary_country,
        countries=analysis_result.countries,
        region=analysis_result.region or radar_service.classify_region(analysis_result.countries),
        sector=analysis_result.sector,
        sub_sector=analysis_result.sub_sector,
        estimated_investment_usd=analysis_result.estimated_investment_usd,
        investment_range=investment_range,
        investment_readiness=analysis_result.investment_readiness,
        strategic_importance=analysis_result.strategic_importance,
        regional_impact=analysis_result.regional_impact,
        investment_opportunity=analysis_result.investment_opportunity,
        risk_factors=analysis_result.risk_factors,
        key_stakeholders=analysis_result.key_stakeholders,
        draft_article=analysis_result.draft_article,
        podcast_suggestion=analysis_result.podcast_suggestion,
        status="verified",
        ai_analysis_version="1.0",
        ai_confidence_score=analysis_result.confidence_score,
        last_analyzed_at=datetime.utcnow(),
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    # Update signal if provided
    if signal:
        signal.is_processed = True
        signal.processed_at = datetime.utcnow()
        signal.radar_project_id = project.id
        db.commit()

    return AnalysisResponse(
        project_id=project.id,
        project_uuid=project.uuid,
        name=project.name,
        analysis={
            "summary": analysis_result.summary,
            "sector": analysis_result.sector,
            "region": analysis_result.region,
            "investment_range": investment_range,
            "investment_readiness": analysis_result.investment_readiness,
            "strategic_importance": analysis_result.strategic_importance,
            "regional_impact": analysis_result.regional_impact,
            "investment_opportunity": analysis_result.investment_opportunity,
            "risk_factors": analysis_result.risk_factors,
            "key_stakeholders": analysis_result.key_stakeholders,
        },
        confidence_score=analysis_result.confidence_score,
        processing_time_ms=analysis_result.processing_time_ms,
        timestamp=datetime.utcnow()
    )


@router.post("/projects/{project_id}/reanalyze", response_model=RadarProjectResponse)
async def reanalyze_project(
    project_id: int,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Re-run AI analysis on an existing project."""
    project = db.query(RadarProject).filter(RadarProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Radar project not found")

    # Get associated signal content if available
    signal = db.query(RadarSignal).filter(
        RadarSignal.radar_project_id == project_id
    ).first()

    content = signal.raw_content if signal else project.description
    title = signal.title if signal else project.name

    if not content:
        raise HTTPException(
            status_code=400,
            detail="No content available for re-analysis"
        )

    # Run AI analysis
    analysis_result = await radar_service.analyze_signal(
        title=title,
        content=content,
        source_name=signal.source_name if signal else "AIP",
        source_type=signal.source_type if signal else "internal"
    )

    # Update project with new analysis
    project.summary = analysis_result.summary
    project.strategic_importance = analysis_result.strategic_importance
    project.regional_impact = analysis_result.regional_impact
    project.investment_opportunity = analysis_result.investment_opportunity
    project.risk_factors = analysis_result.risk_factors
    project.key_stakeholders = analysis_result.key_stakeholders
    project.draft_article = analysis_result.draft_article
    project.podcast_suggestion = analysis_result.podcast_suggestion
    project.ai_confidence_score = analysis_result.confidence_score
    project.last_analyzed_at = datetime.utcnow()

    db.commit()
    db.refresh(project)
    return project


# ============================================================================
# Signal Management Endpoints
# ============================================================================

@router.get("/signals", response_model=List[RadarSignalResponse])
async def list_signals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_processed: Optional[bool] = None,
    source_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List radar signals with optional filtering."""
    query = db.query(RadarSignal)

    if is_processed is not None:
        query = query.filter(RadarSignal.is_processed == is_processed)
    if source_type:
        query = query.filter(RadarSignal.source_type == source_type)

    query = query.order_by(RadarSignal.detected_at.desc())

    return query.offset((page - 1) * page_size).limit(page_size).all()


@router.post("/signals", response_model=RadarSignalResponse, status_code=status.HTTP_201_CREATED)
async def create_signal(
    signal_data: RadarSignalCreate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Create a new radar signal for processing."""
    import hashlib

    content_hash = None
    if signal_data.raw_content:
        content_hash = hashlib.sha256(signal_data.raw_content.encode()).hexdigest()

        # Check for duplicate
        existing = db.query(RadarSignal).filter(
            RadarSignal.content_hash == content_hash
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Signal with identical content already exists"
            )

    signal = RadarSignal(
        source_type=signal_data.source_type,
        source_name=signal_data.source_name,
        source_url=signal_data.source_url,
        source_date=signal_data.source_date,
        title=signal_data.title,
        raw_content=signal_data.raw_content,
        content_hash=content_hash,
        signal_type=signal_data.signal_type,
        countries=signal_data.countries,
        sectors=signal_data.sectors,
        estimated_value_usd=signal_data.estimated_value_usd,
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal


# ============================================================================
# Statistics and Reporting
# ============================================================================

@router.get("/stats")
async def get_radar_stats(db: Session = Depends(get_db)):
    """Get radar system statistics."""
    total_projects = db.query(RadarProject).count()
    total_signals = db.query(RadarSignal).count()
    unprocessed_signals = db.query(RadarSignal).filter(RadarSignal.is_processed == False).count()
    total_corridors = db.query(StrategicCorridor).count()

    # Projects by sector
    from sqlalchemy import func
    sector_counts = db.query(
        RadarProject.sector,
        func.count(RadarProject.id)
    ).group_by(RadarProject.sector).all()

    # Projects by region
    region_counts = db.query(
        RadarProject.region,
        func.count(RadarProject.id)
    ).group_by(RadarProject.region).all()

    # Projects by investment readiness
    readiness_counts = db.query(
        RadarProject.investment_readiness,
        func.count(RadarProject.id)
    ).group_by(RadarProject.investment_readiness).all()

    return {
        "total_projects": total_projects,
        "total_signals": total_signals,
        "unprocessed_signals": unprocessed_signals,
        "total_corridors": total_corridors,
        "projects_by_sector": {s: c for s, c in sector_counts if s},
        "projects_by_region": {r: c for r, c in region_counts if r},
        "projects_by_readiness": {r: c for r, c in readiness_counts if r},
    }


@router.get("/scan-logs", response_model=List[RadarScanLogResponse])
async def get_scan_logs(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get recent radar scan logs."""
    logs = db.query(RadarScanLog).order_by(
        RadarScanLog.started_at.desc()
    ).limit(limit).all()
    return logs
