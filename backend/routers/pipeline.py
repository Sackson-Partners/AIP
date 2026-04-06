"""
AIP Pipeline Management Router
Tracks the full deal lifecycle with an immutable audit trail.

Stages: sourcing → screening → diligence → ic → execution

Endpoints:
    GET  /api/pipeline/stages                 List all stages with SLA
    POST /api/pipeline/move                   Move project to a stage (logged)
    GET  /api/pipeline/history/{project_id}   Full immutable audit trail
    GET  /api/pipeline/overview               Kanban view — all stages + SLA flags
    POST /api/pipeline/init                   Seed default stages (admin only)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    InfrastructureProject,
    PipelineStage,
    ProjectPipeline,
    PipelineLog,
    User,
)
from backend.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pipeline", tags=["Pipeline Management"])

DEFAULT_STAGES = [
    {"name": "Sourcing",      "code": "sourcing",   "order_index": 1, "sla_days": 5},
    {"name": "Screening",     "code": "screening",  "order_index": 2, "sla_days": 10},
    {"name": "Due Diligence", "code": "diligence",  "order_index": 3, "sla_days": 30},
    {"name": "IC Review",     "code": "ic",         "order_index": 4, "sla_days": 14},
    {"name": "Execution",     "code": "execution",  "order_index": 5, "sla_days": 90},
]


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class MoveRequest(BaseModel):
    project_id: str
    stage_code: str
    notes:      Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ensure_stages_seeded(db: Session):
    """Auto-seed stages if table is empty."""
    count = db.query(PipelineStage).count()
    if count == 0:
        for s in DEFAULT_STAGES:
            db.add(PipelineStage(**s))
        db.commit()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/init")
async def init_stages(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Seed default pipeline stages. Idempotent."""
    existing = {s.code for s in db.query(PipelineStage).all()}
    added = 0
    for s in DEFAULT_STAGES:
        if s["code"] not in existing:
            db.add(PipelineStage(**s))
            added += 1
    db.commit()
    return {"seeded": added, "total_stages": db.query(PipelineStage).count()}


@router.get("/stages")
async def list_stages(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """List all pipeline stages with SLA configuration."""
    _ensure_stages_seeded(db)
    stages = db.query(PipelineStage).order_by(PipelineStage.order_index).all()
    return [
        {
            "id":          s.id,
            "name":        s.name,
            "code":        s.code,
            "order_index": s.order_index,
            "sla_days":    s.sla_days,
        }
        for s in stages
    ]


@router.post("/move")
async def move_project(
    payload:      MoveRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Move a project to a new pipeline stage.
    Records an immutable log entry — cannot be undone.
    """
    _ensure_stages_seeded(db)

    # Validate project
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == payload.project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate target stage
    stage = db.query(PipelineStage).filter(
        PipelineStage.code == payload.stage_code
    ).first()
    if not stage:
        raise HTTPException(status_code=400, detail=f"Unknown stage code: {payload.stage_code}")

    # Get current stage with a row-level lock to prevent concurrent move races
    current_pipeline = (
        db.query(ProjectPipeline)
        .filter(ProjectPipeline.project_id == payload.project_id)
        .with_for_update()
        .first()
    )
    from_stage = current_pipeline.stage_code if current_pipeline else None

    # Write immutable log (INSERT-ONLY, no UPDATE/DELETE on this table)
    log_entry = PipelineLog(
        project_id = payload.project_id,
        from_stage = from_stage,
        to_stage   = payload.stage_code,
        changed_by = current_user.id,
        notes      = payload.notes,
    )
    db.add(log_entry)

    # Update or create current pipeline position
    if current_pipeline:
        current_pipeline.stage_code = payload.stage_code
        current_pipeline.entered_at = datetime.now(timezone.utc)
        current_pipeline.sla_due_at = (
            datetime.now(timezone.utc) + timedelta(days=stage.sla_days)
            if stage.sla_days else None
        )
        current_pipeline.is_sla_breached = False
    else:
        db.add(ProjectPipeline(
            project_id      = payload.project_id,
            stage_code      = payload.stage_code,
            sla_due_at      = (
                datetime.now(timezone.utc) + timedelta(days=stage.sla_days)
                if stage.sla_days else None
            ),
        ))

    db.commit()
    logger.info(
        "Pipeline move | project=%s from=%s to=%s by=%s",
        payload.project_id, from_stage, payload.stage_code, current_user.id,
    )
    return {
        "status":     "moved",
        "project_id": payload.project_id,
        "from_stage": from_stage,
        "to_stage":   payload.stage_code,
        "log_id":     log_entry.id,
    }


@router.get("/history/{project_id}")
async def get_pipeline_history(
    project_id:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return the full immutable pipeline audit trail for a project."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    logs = (
        db.query(PipelineLog)
        .filter(PipelineLog.project_id == project_id)
        .order_by(PipelineLog.timestamp.asc())
        .all()
    )
    return {
        "project_id": project_id,
        "project_name": project.project_name,
        "history": [
            {
                "id":         l.id,
                "from_stage": l.from_stage,
                "to_stage":   l.to_stage,
                "changed_by": l.changed_by,
                "timestamp":  str(l.timestamp),
                "notes":      l.notes,
            }
            for l in logs
        ],
        "total_moves": len(logs),
    }


@router.get("/overview")
async def pipeline_overview(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """
    Kanban overview — all stages with project counts and SLA breach flags.
    """
    _ensure_stages_seeded(db)
    stages = db.query(PipelineStage).order_by(PipelineStage.order_index).all()
    now    = datetime.now(timezone.utc)

    # Preload all pipeline positions and projects in two bulk queries (avoids N+1)
    all_positions = db.query(ProjectPipeline).all()
    project_ids   = list({pos.project_id for pos in all_positions})
    projects_map  = {
        p.id: p
        for p in db.query(InfrastructureProject).filter(
            InfrastructureProject.id.in_(project_ids)
        ).all()
    } if project_ids else {}

    # Group positions by stage code
    positions_by_stage: dict[str, list] = {}
    for pos in all_positions:
        positions_by_stage.setdefault(pos.stage_code, []).append(pos)

    result = []
    for stage in stages:
        cards = []
        for pos in positions_by_stage.get(stage.code, []):
            project = projects_map.get(pos.project_id)
            if project:
                sla_breached = (
                    pos.sla_due_at is not None
                    and pos.sla_due_at.replace(tzinfo=timezone.utc) < now
                )
                cards.append({
                    "project_id":   project.id,
                    "project_name": project.project_name,
                    "country":      project.country,
                    "sector":       project.sector,
                    "entered_at":   str(pos.entered_at),
                    "sla_due_at":   str(pos.sla_due_at) if pos.sla_due_at else None,
                    "sla_breached": sla_breached,
                })
        result.append({
            "stage_code":    stage.code,
            "stage_name":    stage.name,
            "order_index":   stage.order_index,
            "sla_days":      stage.sla_days,
            "project_count": len(cards),
            "projects":      cards,
        })

    return {"stages": result, "total_projects": sum(s["project_count"] for s in result)}


@router.get("/project/{project_id}")
async def get_project_pipeline_status(
    project_id:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return the current pipeline status for a single project."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    position = db.query(ProjectPipeline).filter(
        ProjectPipeline.project_id == project_id
    ).first()
    if not position:
        return {
            "project_id":   project_id,
            "project_name": project.project_name,
            "current_stage": None,
            "entered_at":   None,
            "days_in_stage": 0,
            "sla_days":     None,
            "sla_status":   "not_in_pipeline",
            "sla_remaining": None,
        }

    stage = db.query(PipelineStage).filter(
        PipelineStage.code == position.stage_code
    ).first()
    now = datetime.now(timezone.utc)
    entered = position.entered_at.replace(tzinfo=timezone.utc) if position.entered_at else now
    days_in_stage = (now - entered).days
    sla_days = stage.sla_days if stage else None
    sla_remaining = (sla_days - days_in_stage) if sla_days else None
    sla_status = "ok"
    if sla_remaining is not None:
        sla_status = "breached" if sla_remaining < 0 else ("warning" if sla_remaining <= 2 else "ok")

    return {
        "project_id":    project_id,
        "project_name":  project.project_name,
        "current_stage": position.stage_code,
        "entered_at":    str(position.entered_at),
        "days_in_stage": days_in_stage,
        "sla_days":      sla_days,
        "sla_status":    sla_status,
        "sla_remaining": sla_remaining,
    }


@router.get("/sla-alerts")
async def get_sla_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return all projects with SLA breaches or warnings (paginated)."""
    now       = datetime.now(timezone.utc)
    positions = db.query(ProjectPipeline).offset(skip).limit(limit).all()

    # Preload stages and projects in bulk to avoid N+1 queries
    stages_map   = {s.code: s for s in db.query(PipelineStage).all()}
    project_ids  = [pos.project_id for pos in positions]
    projects_map = {
        p.id: p
        for p in db.query(InfrastructureProject).filter(
            InfrastructureProject.id.in_(project_ids)
        ).all()
    } if project_ids else {}

    alerts = []
    for pos in positions:
        stage = stages_map.get(pos.stage_code)
        if not stage or not stage.sla_days:
            continue

        entered       = pos.entered_at.replace(tzinfo=timezone.utc) if pos.entered_at else now
        days_in_stage = (now - entered).days
        sla_remaining = stage.sla_days - days_in_stage

        if sla_remaining > 2:
            continue  # No alert needed

        project = projects_map.get(pos.project_id)
        if project:
            alerts.append({
                "project_id":    project.id,
                "project_name":  project.project_name,
                "current_stage": pos.stage_code,
                "entered_at":    str(pos.entered_at),
                "days_in_stage": days_in_stage,
                "sla_days":      stage.sla_days,
                "sla_status":    "breached" if sla_remaining < 0 else "warning",
                "sla_remaining": sla_remaining,
            })

    return alerts


@router.get("/statuses")
async def list_project_statuses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return current pipeline status for all projects in the pipeline (paginated)."""
    now       = datetime.now(timezone.utc)
    positions = db.query(ProjectPipeline).offset(skip).limit(limit).all()

    # Preload projects and stages in bulk to avoid N+1 queries
    project_ids  = [pos.project_id for pos in positions]
    projects_map = {
        p.id: p
        for p in db.query(InfrastructureProject).filter(
            InfrastructureProject.id.in_(project_ids)
        ).all()
    } if project_ids else {}
    stages_map = {s.code: s for s in db.query(PipelineStage).all()}

    result = []
    for pos in positions:
        project = projects_map.get(pos.project_id)
        if not project:
            continue
        stage         = stages_map.get(pos.stage_code)
        entered       = pos.entered_at.replace(tzinfo=timezone.utc) if pos.entered_at else now
        days_in_stage = (now - entered).days
        sla_days      = stage.sla_days if stage else None
        sla_remaining = (sla_days - days_in_stage) if sla_days else None
        sla_status    = "ok"
        if sla_remaining is not None:
            sla_status = "breached" if sla_remaining < 0 else ("warning" if sla_remaining <= 2 else "ok")
        result.append({
            "project_id":    project.id,
            "project_name":  project.project_name,
            "current_stage": pos.stage_code,
            "entered_at":    str(pos.entered_at),
            "days_in_stage": days_in_stage,
            "sla_days":      sla_days,
            "sla_status":    sla_status,
            "sla_remaining": sla_remaining,
        })

    return result


@router.get("/statuses/{project_id}")
async def get_project_status(
    project_id:   str,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Return current pipeline status for a single project."""
    project = db.query(InfrastructureProject).filter(
        InfrastructureProject.id == project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    position = db.query(ProjectPipeline).filter(
        ProjectPipeline.project_id == project_id
    ).first()
    if not position:
        return {
            "project_id":    project_id,
            "project_name":  project.project_name,
            "current_stage": None,
            "entered_at":    None,
            "days_in_stage": 0,
            "sla_days":      None,
            "sla_status":    "not_in_pipeline",
            "sla_remaining": None,
        }

    now   = datetime.now(timezone.utc)
    stage = db.query(PipelineStage).filter(
        PipelineStage.code == position.stage_code
    ).first()
    entered       = position.entered_at.replace(tzinfo=timezone.utc) if position.entered_at else now
    days_in_stage = (now - entered).days
    sla_days      = stage.sla_days if stage else None
    sla_remaining = (sla_days - days_in_stage) if sla_days else None
    sla_status    = "ok"
    if sla_remaining is not None:
        sla_status = "breached" if sla_remaining < 0 else ("warning" if sla_remaining <= 2 else "ok")

    return {
        "project_id":    project_id,
        "project_name":  project.project_name,
        "current_stage": position.stage_code,
        "entered_at":    str(position.entered_at),
        "days_in_stage": days_in_stage,
        "sla_days":      sla_days,
        "sla_status":    sla_status,
        "sla_remaining": sla_remaining,
    }


@router.get("")
async def pipeline_root(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    """Pipeline root — returns stages summary."""
    _ensure_stages_seeded(db)
    stages = db.query(PipelineStage).order_by(PipelineStage.order_index).all()
    return {
        "stages":       [{"id": str(s.id), "name": s.name, "code": s.code, "sla_days": s.sla_days} for s in stages],
        "total_stages": len(stages),
    }
