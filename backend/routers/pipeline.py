"""
Pipeline Management API Routes
Implements deal pipeline with immutable audit trail per PRD Section 4.3
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import (
    PipelineStage, PipelineLog, PipelineStageEnum, Project, User
)

router = APIRouter(prefix="/pipeline", tags=["Pipeline Management"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class StageConfig(BaseModel):
    """Pipeline stage configuration"""
    id: int
    name: str
    code: str
    order_index: int
    sla_days: Optional[int]
    description: Optional[str]

    class Config:
        from_attributes = True


class PipelineMoveRequest(BaseModel):
    """Request to move project to a new stage"""
    project_id: int
    to_stage: str = Field(..., description="Target stage: sourcing, screening, diligence, ic, execution")
    notes: Optional[str] = Field(None, description="Notes for the stage movement")


class PipelineLogResponse(BaseModel):
    """Pipeline movement log entry"""
    id: int
    project_id: int
    from_stage: Optional[str]
    to_stage: str
    changed_by: int
    timestamp: datetime
    notes: Optional[str]
    days_in_previous_stage: Optional[int]
    sla_breached: bool

    class Config:
        from_attributes = True


class ProjectPipelineStatus(BaseModel):
    """Current pipeline status for a project"""
    project_id: int
    project_name: str
    current_stage: str
    entered_at: datetime
    days_in_stage: int
    sla_days: Optional[int]
    sla_status: str  # ok, warning, breached
    sla_remaining: Optional[int]


class StageProjectCount(BaseModel):
    """Project count per stage"""
    stage: str
    count: int
    sla_warning: int
    sla_breached: int


class PipelineOverview(BaseModel):
    """Pipeline overview (Kanban view data)"""
    stages: List[StageConfig]
    stage_counts: List[StageProjectCount]
    total_projects: int


# ============================================================================
# Stage Configuration
# ============================================================================

# Default stage configuration per PRD
DEFAULT_STAGES = [
    {"name": "Sourcing", "code": "sourcing", "order_index": 1, "sla_days": 5},
    {"name": "Screening", "code": "screening", "order_index": 2, "sla_days": 10},
    {"name": "Due Diligence", "code": "diligence", "order_index": 3, "sla_days": 30},
    {"name": "IC Review", "code": "ic", "order_index": 4, "sla_days": 14},
    {"name": "Execution", "code": "execution", "order_index": 5, "sla_days": 90},
]


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/stages", response_model=List[StageConfig], summary="Get pipeline stages")
async def get_stages(db: Session = Depends(get_db)):
    """
    Get all pipeline stages with SLA configuration.
    Stages: Sourcing → Screening → Due Diligence → IC → Execution
    """
    stages = db.query(PipelineStage).filter(
        PipelineStage.is_active == True
    ).order_by(PipelineStage.order_index).all()

    # If no stages configured, return defaults
    if not stages:
        return [
            StageConfig(
                id=i,
                name=s["name"],
                code=s["code"],
                order_index=s["order_index"],
                sla_days=s["sla_days"],
                description=None
            )
            for i, s in enumerate(DEFAULT_STAGES, 1)
        ]

    return stages


@router.post("/seed-stages", summary="Seed default pipeline stages")
async def seed_stages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Seed the default pipeline stages (run once)"""
    existing = db.query(PipelineStage).count()
    if existing > 0:
        return {"message": f"Stages already exist ({existing} stages)"}

    for stage_def in DEFAULT_STAGES:
        stage = PipelineStage(
            name=stage_def["name"],
            code=stage_def["code"],
            order_index=stage_def["order_index"],
            sla_days=stage_def["sla_days"],
        )
        db.add(stage)

    db.commit()
    return {"message": f"Seeded {len(DEFAULT_STAGES)} pipeline stages"}


@router.post("/move", response_model=PipelineLogResponse, summary="Move project to new stage")
async def move_project(
    move_data: PipelineMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Move a project to a new pipeline stage.
    Creates an immutable audit log entry (INSERT-ONLY).
    """
    # Validate project exists
    project = db.query(Project).filter(Project.id == move_data.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {move_data.project_id} not found"
        )

    # Validate target stage
    valid_stages = [s["code"] for s in DEFAULT_STAGES]
    if move_data.to_stage not in valid_stages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid stage: {move_data.to_stage}. Valid stages: {', '.join(valid_stages)}"
        )

    # Get current stage from latest log
    latest_log = db.query(PipelineLog).filter(
        PipelineLog.project_id == move_data.project_id
    ).order_by(PipelineLog.timestamp.desc()).first()

    from_stage = latest_log.to_stage if latest_log else None

    # Calculate days in previous stage
    days_in_previous = None
    sla_breached = False
    if latest_log:
        delta = datetime.now() - latest_log.timestamp
        days_in_previous = delta.days

        # Check SLA breach
        stage_config = next(
            (s for s in DEFAULT_STAGES if s["code"] == from_stage),
            None
        )
        if stage_config and stage_config["sla_days"]:
            sla_breached = days_in_previous > stage_config["sla_days"]

    # Create immutable log entry (INSERT-ONLY)
    log = PipelineLog(
        project_id=move_data.project_id,
        from_stage=from_stage,
        to_stage=move_data.to_stage,
        changed_by=current_user.id,
        notes=move_data.notes,
        days_in_previous_stage=days_in_previous,
        sla_breached=sla_breached,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return log


@router.get("/history/{project_id}", response_model=List[PipelineLogResponse], summary="Get project pipeline history")
async def get_project_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the complete pipeline audit trail for a project.
    This is an immutable record of all stage movements.
    """
    logs = db.query(PipelineLog).filter(
        PipelineLog.project_id == project_id
    ).order_by(PipelineLog.timestamp.asc()).all()

    return logs


@router.get("/project/{project_id}", response_model=ProjectPipelineStatus, summary="Get project pipeline status")
async def get_project_status(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current pipeline status for a project including SLA tracking"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Get latest log entry
    latest_log = db.query(PipelineLog).filter(
        PipelineLog.project_id == project_id
    ).order_by(PipelineLog.timestamp.desc()).first()

    if not latest_log:
        return ProjectPipelineStatus(
            project_id=project_id,
            project_name=project.name,
            current_stage="sourcing",
            entered_at=project.created_at,
            days_in_stage=0,
            sla_days=5,
            sla_status="ok",
            sla_remaining=5
        )

    # Calculate days in current stage
    delta = datetime.now() - latest_log.timestamp
    days_in_stage = delta.days

    # Get SLA for current stage
    stage_config = next(
        (s for s in DEFAULT_STAGES if s["code"] == latest_log.to_stage),
        None
    )
    sla_days = stage_config["sla_days"] if stage_config else None

    # Determine SLA status
    sla_status = "ok"
    sla_remaining = None
    if sla_days:
        sla_remaining = sla_days - days_in_stage
        if sla_remaining < 0:
            sla_status = "breached"
        elif sla_remaining <= 2:  # Warning when 2 days or less remaining
            sla_status = "warning"

    return ProjectPipelineStatus(
        project_id=project_id,
        project_name=project.name,
        current_stage=latest_log.to_stage,
        entered_at=latest_log.timestamp,
        days_in_stage=days_in_stage,
        sla_days=sla_days,
        sla_status=sla_status,
        sla_remaining=sla_remaining
    )


@router.get("/overview", response_model=PipelineOverview, summary="Get pipeline overview")
async def get_pipeline_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get pipeline overview for Kanban view.
    Returns project counts per stage with SLA status.
    """
    stages = db.query(PipelineStage).filter(
        PipelineStage.is_active == True
    ).order_by(PipelineStage.order_index).all()

    # Use defaults if no stages configured
    if not stages:
        stages = [
            PipelineStage(
                id=i, name=s["name"], code=s["code"],
                order_index=s["order_index"], sla_days=s["sla_days"]
            )
            for i, s in enumerate(DEFAULT_STAGES, 1)
        ]

    # Get all projects with their current stage
    from sqlalchemy import func, distinct

    # Subquery to get latest log per project
    latest_logs_subq = db.query(
        PipelineLog.project_id,
        func.max(PipelineLog.timestamp).label('max_ts')
    ).group_by(PipelineLog.project_id).subquery()

    # Join to get current stage
    current_stages = db.query(
        PipelineLog.project_id,
        PipelineLog.to_stage,
        PipelineLog.timestamp
    ).join(
        latest_logs_subq,
        (PipelineLog.project_id == latest_logs_subq.c.project_id) &
        (PipelineLog.timestamp == latest_logs_subq.c.max_ts)
    ).all()

    # Count projects per stage with SLA status
    stage_counts = []
    total_projects = len(current_stages)

    for stage in stages:
        stage_projects = [p for p in current_stages if p.to_stage == stage.code]
        count = len(stage_projects)
        warning = 0
        breached = 0

        if stage.sla_days:
            now = datetime.now()
            for p in stage_projects:
                days = (now - p.timestamp).days
                remaining = stage.sla_days - days
                if remaining < 0:
                    breached += 1
                elif remaining <= 2:
                    warning += 1

        stage_counts.append(StageProjectCount(
            stage=stage.code,
            count=count,
            sla_warning=warning,
            sla_breached=breached
        ))

    return PipelineOverview(
        stages=[StageConfig(
            id=s.id if hasattr(s, 'id') and s.id else i,
            name=s.name,
            code=s.code,
            order_index=s.order_index,
            sla_days=s.sla_days,
            description=s.description if hasattr(s, 'description') else None
        ) for i, s in enumerate(stages, 1)],
        stage_counts=stage_counts,
        total_projects=total_projects
    )


@router.get("/sla-alerts", response_model=List[ProjectPipelineStatus], summary="Get SLA alerts")
async def get_sla_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get projects that are approaching or have breached SLA"""
    from sqlalchemy import func

    # Get latest log per project
    latest_logs_subq = db.query(
        PipelineLog.project_id,
        func.max(PipelineLog.timestamp).label('max_ts')
    ).group_by(PipelineLog.project_id).subquery()

    current_stages = db.query(
        PipelineLog, Project
    ).join(
        latest_logs_subq,
        (PipelineLog.project_id == latest_logs_subq.c.project_id) &
        (PipelineLog.timestamp == latest_logs_subq.c.max_ts)
    ).join(
        Project, PipelineLog.project_id == Project.id
    ).all()

    alerts = []
    now = datetime.now()

    for log, project in current_stages:
        stage_config = next(
            (s for s in DEFAULT_STAGES if s["code"] == log.to_stage),
            None
        )
        if not stage_config or not stage_config["sla_days"]:
            continue

        days = (now - log.timestamp).days
        remaining = stage_config["sla_days"] - days

        # Only include if warning or breached
        if remaining <= 2:
            sla_status = "breached" if remaining < 0 else "warning"
            alerts.append(ProjectPipelineStatus(
                project_id=project.id,
                project_name=project.name,
                current_stage=log.to_stage,
                entered_at=log.timestamp,
                days_in_stage=days,
                sla_days=stage_config["sla_days"],
                sla_status=sla_status,
                sla_remaining=remaining
            ))

    # Sort by urgency (most breached first)
    alerts.sort(key=lambda x: x.sla_remaining or 0)
    return alerts
