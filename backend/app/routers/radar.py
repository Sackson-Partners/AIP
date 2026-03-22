"""
Africa Infrastructure Radar API router.

Endpoints
---------
GET  /api/radar/projects            - list / filter detected projects
GET  /api/radar/projects/{id}       - get a single project
POST /api/radar/projects            - create a project manually
PUT  /api/radar/projects/{id}       - update a project

GET  /api/radar/opportunities       - filter projects by investment readiness
GET  /api/radar/corridors           - list strategic corridors
GET  /api/radar/corridors/{id}      - get a single corridor
POST /api/radar/corridors           - create a corridor
GET  /api/radar/corridors/{id}/projects - projects within a corridor

POST /api/radar/analyze             - AI-analyse a raw signal
POST /api/radar/projects/{id}/reanalyze - re-run AI on an existing project

GET  /api/radar/signals             - list signals
POST /api/radar/signals             - create a signal

GET  /api/radar/stats               - system statistics
GET  /api/radar/scan-logs           - recent scan audit logs
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.radar import RadarProject, RadarScanLog, RadarSignal, StrategicCorridor
from app.models.user import User
from app.schemas.radar import (
    AnalysisResponse,
    AnalyzeSignalRequest,
    RadarCorridorListResponse,
    RadarProjectCreate,
    RadarProjectListResponse,
    RadarProjectResponse,
    RadarProjectUpdate,
    RadarScanLogResponse,
    RadarSignalCreate,
    RadarSignalResponse,
    StrategicCorridorCreate,
    StrategicCorridorResponse,
)
from app.services.radar_service import radar_service
from .auth import require_auth

router = APIRouter(prefix="/radar", tags=["Radar"])


# =============================================================================
# Projects
# =============================================================================

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
        db: Session = Depends(get_db),
):
        """List all detected and analysed infrastructure projects."""
        query = db.query(RadarProject)

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
                                                                like = f"%{search}%"
                                                                query = query.filter(
                                                                    or_(
                                                                        RadarProject.name.ilike(like),
                                                                        RadarProject.description.ilike(like),
                                                                        RadarProject.summary.ilike(like),
                                                                    )
                                                                )

    query = query.order_by(RadarProject.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return RadarProjectListResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                pages=(total + page_size - 1) // page_size if total > 0 else 0,
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
        db: Session = Depends(get_db),
):
        """Create a new radar project manually."""
    project = RadarProject(**project_data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put("/projects/{project_id}", response_model=RadarProjectResponse)
async def update_radar_project(
        project_id: int,
        project_data: RadarProjectUpdate,
        current_user: User = Depends(require_auth),
        db: Session = Depends(get_db),
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


# =============================================================================
# Investment Opportunities
# =============================================================================

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
        db: Session = Depends(get_db),
):
        """Filter projects by investment readiness - returns active opportunities."""
    query = db.query(RadarProject)

    active_readiness = ["tender_open", "financing_sought", "feasibility"]
    if investment_readiness:
                query = query.filter(RadarProject.investment_readiness.in_(investment_readiness))
else:
        query = query.filter(RadarProject.investment_readiness.in_(active_readiness))

    if min_investment_usd is not None:
                query = query.filter(RadarProject.estimated_investment_usd >= min_investment_usd)
            if max_investment_usd is not None:
                        query = query.filter(RadarProject.estimated_investment_usd <= max_investment_usd)
                    if sectors:
                                query = query.filter(RadarProject.sector.in_(sectors))
                            if regions:
                                        query = query.filter(RadarProject.region.in_(regions))
                                    if countries:
                                                query = query.filter(RadarProject.primary_country.in_(countries))

    query = query.order_by(RadarProject.estimated_investment_usd.desc().nullslast())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return RadarProjectListResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


# =============================================================================
# Strategic Corridors
# =============================================================================

@router.get("/corridors", response_model=RadarCorridorListResponse)
async def list_strategic_corridors(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        corridor_type: Optional[str] = None,
        development_status: Optional[str] = None,
        country: Optional[str] = None,
        db: Session = Depends(get_db),
):
        """List strategic regional corridors across Africa."""
        query = db.query(StrategicCorridor)
        if corridor_type:
                    query = query.filter(StrategicCorridor.corridor_type == corridor_type)
                if development_status:
                            query = query.filter(StrategicCorridor.development_status == development_status)
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
                pages=(total + page_size - 1) // page_size if total > 0 else 0,
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
        db: Session = Depends(get_db),
):
        """Create a new strategic corridor."""
    existing = db.query(StrategicCorridor).filter(
                StrategicCorridor.name == corridor_data.name
    ).first()
    if existing:
                raise HTTPException(status_code=400, detail="A corridor with this name already exists")

    corridor = StrategicCorridor(**corridor_data.model_dump())
    db.add(corridor)
    db.commit()
    db.refresh(corridor)
    return corridor


@router.get("/corridors/{corridor_id}/projects", response_model=RadarProjectListResponse)
async def get_corridor_projects(
        corridor_id: int,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        db: Session = Depends(get_db),
):
        """List all projects associated with a corridor."""
    corridor = db.query(StrategicCorridor).filter(StrategicCorridor.id == corridor_id).first()
    if not corridor:
                raise HTTPException(status_code=404, detail="Strategic corridor not found")

    query = (
                db.query(RadarProject)
                .filter(RadarProject.corridor_id == corridor_id)
                .order_by(RadarProject.estimated_investment_usd.desc().nullslast())
    )
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return RadarProjectListResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


# =============================================================================
# AI Analysis
# =============================================================================

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_signal(
        request: AnalyzeSignalRequest,
        current_user: User = Depends(require_auth),
        db: Session = Depends(get_db),
):
        """
            Trigger AI analysis on a new project signal.

                Accepts:
                    - ``signal_id``: ID of an existing unprocessed signal, OR
                        - ``signal_content`` + ``signal_title``: raw content to analyse.
                            """
    signal = None
    content = request.signal_content
    title = request.signal_title
    source_name = request.source_name or "Manual Input"
    source_type = request.source_type or "manual"

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
                    detail="Provide either signal_id or both signal_content and signal_title",
    )

    analysis = await radar_service.analyze_signal(
                title=title,
                content=content,
                source_name=source_name,
                source_type=source_type,
    )

    investment_range = radar_service.classify_investment_range(analysis.estimated_investment_usd)
    region = analysis.region or radar_service.classify_region(analysis.countries)

    project = RadarProject(
                name=analysis.project_name,
                description=content[:2000] if content else None,
                summary=analysis.summary,
                primary_country=analysis.primary_country,
                countries=analysis.countries,
                region=region,
                sector=analysis.sector,
                sub_sector=analysis.sub_sector,
                estimated_investment_usd=analysis.estimated_investment_usd,
                investment_range=investment_range,
                investment_readiness=analysis.investment_readiness,
                strategic_importance=analysis.strategic_importance,
                regional_impact=analysis.regional_impact,
                investment_opportunity=analysis.investment_opportunity,
                risk_factors=analysis.risk_factors,
                key_stakeholders=analysis.key_stakeholders,
                draft_article=analysis.draft_article,
                podcast_suggestion=analysis.podcast_suggestion,
                status="verified",
                ai_analysis_version="1.0",
                ai_confidence_score=analysis.confidence_score,
                last_analyzed_at=datetime.utcnow(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)

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
                                "summary": analysis.summary,
                                "sector": analysis.sector,
                                "region": region,
                                "investment_range": investment_range,
                                "investment_readiness": analysis.investment_readiness,
                                "strategic_importance": analysis.strategic_importance,
                                "regional_impact": analysis.regional_impact,
                                "investment_opportunity": analysis.investment_opportunity,
                                "risk_factors": analysis.risk_factors,
                                "key_stakeholders": analysis.key_stakeholders,
                },
                confidence_score=analysis.confidence_score,
                processing_time_ms=analysis.processing_time_ms,
                timestamp=datetime.utcnow(),
    )


@router.post("/projects/{project_id}/reanalyze", response_model=RadarProjectResponse)
async def reanalyze_project(
        project_id: int,
        current_user: User = Depends(require_auth),
        db: Session = Depends(get_db),
):
        """Re-run AI analysis on an existing radar project."""
    project = db.query(RadarProject).filter(RadarProject.id == project_id).first()
    if not project:
                raise HTTPException(status_code=404, detail="Radar project not found")

    signal = db.query(RadarSignal).filter(
                RadarSignal.radar_project_id == project_id
    ).first()

    content = (signal.raw_content if signal else None) or project.description
    title = (signal.title if signal else None) or project.name

    if not content:
                raise HTTPException(status_code=400, detail="No content available for re-analysis")

    analysis = await radar_service.analyze_signal(
                title=title,
                content=content,
                source_name=signal.source_name if signal else "AIP",
                source_type=signal.source_type if signal else "internal",
    )

    project.summary = analysis.summary
    project.strategic_importance = analysis.strategic_importance
                                        project.regional_impact = analysis.regional_impact
    project.investment_opportunity = analysis.investment_opportunity
    project.risk_factors = analysis.risk_factors
    project.key_stakeholders = analysis.key_stakeholders
    project.draft_article = analysis.draft_article
    project.podcast_suggestion = analysis.podcast_suggestion
    project.ai_confidence_score = analysis.confidence_score
    project.last_analyzed_at = datetime.utcnow()

    db.commit()
    db.refresh(project)
    return project


# =============================================================================
# Signals
# =============================================================================

@router.get("/signals", response_model=List[RadarSignalResponse])
async def list_signals(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        is_processed: Optional[bool] = None,
        source_type: Optional[str] = None,
        db: Session = Depends(get_db),
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
        db: Session = Depends(get_db),
):
        """Create a new radar signal for processing."""
    import hashlib

    content_hash: Optional[str] = None
    if signal_data.raw_content:
                content_hash = hashlib.sha256(signal_data.raw_content.encode()).hexdigest()
        existing = db.query(RadarSignal).filter(
                        RadarSignal.content_hash == content_hash
        ).first()
        if existing:
                        raise HTTPException(status_code=400, detail="Signal with identical content already exists")

    signal = RadarSignal(
                **signal_data.model_dump(),
                content_hash=content_hash,
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)
    return signal


# =============================================================================
# Statistics & Reporting
# =============================================================================

@router.get("/stats")
async def get_radar_stats(db: Session = Depends(get_db)):
        """Return radar system statistics."""
    from sqlalchemy import func

    total_projects = db.query(RadarProject).count()
    total_signals = db.query(RadarSignal).count()
    unprocessed_signals = db.query(RadarSignal).filter(
                RadarSignal.is_processed == False  # noqa: E712
    ).count()
    total_corridors = db.query(StrategicCorridor).count()

    sector_counts = db.query(
                RadarProject.sector, func.count(RadarProject.id)
    ).group_by(RadarProject.sector).all()

    region_counts = db.query(
                RadarProject.region, func.count(RadarProject.id)
    ).group_by(RadarProject.region).all()

    readiness_counts = db.query(
                RadarProject.investment_readiness, func.count(RadarProject.id)
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
        db: Session = Depends(get_db),
):
        """Return recent radar scan audit logs."""
    return (
                db.query(RadarScanLog)
                .order_by(RadarScanLog.started_at.desc())
                .limit(limit)
                .all()
    )
