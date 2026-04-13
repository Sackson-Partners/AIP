"""Airtable Integration - AIP Platform. Caches results for 5 min."""
import logging
import os
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.models import User
from backend.security.auth import get_current_user

logger = logging.getLogger("aip.airtable")
router = APIRouter(prefix="/airtable", tags=["Airtable"])

AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY", "")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID")
AIRTABLE_TABLE = os.getenv("AIRTABLE_PROJECTS_TABLE")

if not AIRTABLE_BASE_ID:
    raise RuntimeError(
        "AIRTABLE_BASE_ID environment variable is not set. "
        "Add it to your deployment environment before starting the server."
    )
if not AIRTABLE_TABLE:
    raise RuntimeError(
        "AIRTABLE_PROJECTS_TABLE environment variable is not set. "
        "Add it to your deployment environment before starting the server."
    )
BASE_URL = "https://api.airtable.com/v0"
TTL = int(os.getenv("AIRTABLE_CACHE_TTL", "300"))
_cache: dict = {}


def _headers():
    if not AIRTABLE_API_KEY:
        raise HTTPException(status_code=503, detail="Set AIRTABLE_API_KEY env var.")
    return {"Authorization": f"Bearer {AIRTABLE_API_KEY}"}


def _cache_get(key):
    e = _cache.get(key)
    return e[1] if e and (time.time() - e[0]) < TTL else None


def _cache_set(key, val):
    _cache[key] = (time.time(), val)


class AirtableProject(BaseModel):
    record_id: str
    aip_project_id: Optional[str] = None
    project_name: Optional[str] = None
    country: Optional[str] = None
    region_city: Optional[str] = None
    sector: Optional[str] = None
    project_type: Optional[str] = None
    extra_fields: dict = {}


class ProjectsResponse(BaseModel):
    total: int
    cached: bool
    projects: list


async def _fetch_records():
    records, params = [], {"pageSize": 100}
    url = f"{BASE_URL}/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE}"
    async with httpx.AsyncClient(timeout=30) as c:
        while True:
            r = await c.get(url, headers=_headers(), params=params)
            if r.status_code == 401:
                raise HTTPException(401, "Invalid Airtable API key.")
            if r.status_code == 429:
                raise HTTPException(429, "Airtable rate limit. Retry in 30s.")
            r.raise_for_status()
            d = r.json()
            records.extend(d.get("records", []))
            if not d.get("offset"):
                break
            params["offset"] = d["offset"]
    return records


def _map(r):
    f = r.get("fields", {})
    known = {"AIP Project ID", "Project Name", "Country", "Region / City", "Sector", "Project Type"}
    return AirtableProject(
        record_id=r["id"],
        aip_project_id=f.get("AIP Project ID"),
        project_name=f.get("Project Name"),
        country=f.get("Country"),
        region_city=f.get("Region / City"),
        sector=f.get("Sector"),
        project_type=f.get("Project Type"),
        extra_fields={k: v for k, v in f.items() if k not in known},
    )


@router.get("/projects", response_model=ProjectsResponse)
async def list_projects(
    country: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    project_type: Optional[str] = Query(None),
    refresh: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    data = None if refresh else _cache_get("all")
    is_cached = data is not None
    if data is None:
        data = [_map(r) for r in await _fetch_records()]
        _cache_set("all", data)
    results = data
    if country:
        results = [p for p in results if p.country and country.lower() in p.country.lower()]
    if sector:
        results = [p for p in results if p.sector and sector.lower() in p.sector.lower()]
    if project_type:
        results = [p for p in results if p.project_type and project_type.lower() in p.project_type.lower()]
    return ProjectsResponse(total=len(results), cached=is_cached, projects=results)


@router.get("/projects/search/{query}", response_model=ProjectsResponse)
async def search_projects(
    query: str,
    current_user: User = Depends(get_current_user),
):
    data = _cache_get("all")
    if data is None:
        data = [_map(r) for r in await _fetch_records()]
        _cache_set("all", data)
    q = query.lower()
    results = [p for p in data if
        (p.project_name and q in p.project_name.lower()) or
        (p.country and q in p.country.lower()) or
        (p.aip_project_id and q in p.aip_project_id.lower())]
    return ProjectsResponse(total=len(results), cached=True, projects=results)


@router.get("/projects/{record_id}", response_model=AirtableProject)
async def get_project(
    record_id: str,
    current_user: User = Depends(get_current_user),
):
    url = f"{BASE_URL}/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE}/{record_id}"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(url, headers=_headers())
        if r.status_code == 404:
            raise HTTPException(404, f"Record {record_id} not found.")
        r.raise_for_status()
    return _map(r.json())


@router.post("/cache/clear")
async def clear_cache(
    current_user: User = Depends(get_current_user),
):
    _cache.clear()
    return {"message": "Cache cleared"}


@router.get("/meta")
async def meta(
    current_user: User = Depends(get_current_user),
):
    return {"configured": bool(AIRTABLE_API_KEY), "base_id": AIRTABLE_BASE_ID,
            "table": AIRTABLE_TABLE, "cache_ttl": TTL}
