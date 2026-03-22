"""
AIP Pipeline Management Router
================================
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

from fastapi import APIRouter, Depends, HTTPException, status
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

    # Get current stage (if any)
    current_pipeline = db.query(ProjectPipeline).filter(
        ProjectPipeline.project_id == payload.project_id
    ).first()
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
    result = []

    for stage in stages:
        positions = db.query(ProjectPipeline).filter(
            ProjectPipeline.stage_code == stage.code
        ).all()

        cards = []
        for pos in positions:
            project = db.query(InfrastructureProject).filter(
                InfrastructureProject.id == pos.project_id
            ).first()
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
