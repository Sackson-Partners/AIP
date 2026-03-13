cached_projects = [_map_record(r) for r in raw_records]
        _cache_set(cache_key, cached_projects)
        is_cached = False
else:
        is_cached = True
        projects = cached_projects
        if country:
                    projects = [p for p in projects if p.country and country.lower() in p.country.lower()]
                if sector:
                            projects = [p for p in projects if p.sector and sector.lower() in p.sector.lower()]
                        if project_type:
                                    projects = [p for p in projects if p.project_type and project_type.lower() in p.project_type.lower()]
                                return AirtableProjectsResponse(total=len(projects), cached=is_cached, projects=projects)

@router.get("/projects/{record_id}", response_model=AirtableProject)
async def get_airtable_project(record_id: str):
        url = f"{AIRTABLE_BASE_URL}/{AIRTABLE_BASE_ID}/{AIRTABLE_PROJECTS_TABLE}/{record_id}"
    async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, headers=_airtable_headers())
                if resp.status_code == 404:
                                raise HTTPException(status_code=404, detail=f"Record {record_id} not found.")
                            resp.raise_for_status()
    return _map_record(resp.json())

@router.get("/projects/search/{query}", response_model=AirtableProjectsResponse)
async def search_airtable_projects(query: str):
        cache_key = "airtable:projects:all"
    cached_projects = _cache_get(cache_key)
    if cached_projects is None:
                raw_records = await _fetch_all_records(AIRTABLE_PROJECTS_TABLE)
        cached_projects = [_map_record(r) for r in raw_records]
        _cache_set(cache_key, cached_projects)
    q = query.lower()
    results = [p for p in cached_projects if
        (p.project_name and q in p.project_name.lower()) or
        (p.aip_project_id and q in p.aip_project_id.lower()) or
        (p.country and q in p.country.lower())]
    return AirtableProjectsResponse(total=len(results), cached=True, projects=results)

@router.post("/cache/clear")
async def clear_airtable_cache():
        _cache_clear()
    return {"message": "Airtable cache cleared"}

@router.get("/meta")
async def airtable_meta():
        return {"configured": bool(AIRTABLE_API_KEY), "base_id": AIRTABLE_BASE_ID, "projects_table": AIRTABLE_PROJECTS_TABLE, "cache_ttl_seconds": CACHE_TTL}import os
import httpx
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

router = APIRouter(prefix="/api/v1/airtable", tags=["airtable"])

AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY", "")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID", "appBWrnDeccJv9abz")

TABLE_IDS = {
    "projects": os.getenv("AIRTABLE_TABLE_PROJECTS", ""),
    "petfel_criteria": os.getenv("AIRTABLE_TABLE_PETFEL_CRITERIA", ""),
    "petfel_assessments": os.getenv("AIRTABLE_TABLE_PETFEL_ASSESSMENTS", ""),
    "project_risks": os.getenv("AIRTABLE_TABLE_PROJECT_RISKS", ""),
}


async def fetch_table_records(base_id: str, table_id: str) -> list:
    """Fetch all records from an Airtable table with pagination."""
    if not AIRTABLE_API_KEY:
        raise HTTPException(status_code=500, detail="AIRTABLE_API_KEY not configured")
    headers = {"Authorization": f"Bearer {AIRTABLE_API_KEY}"}
    records = []
    offset = None
    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            params = {}
            if offset:
                params["offset"] = offset
            url = f"https://api.airtable.com/v0/{base_id}/{table_id}"
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Airtable error {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json()
            records.extend(data.get("records", []))
            offset = data.get("offset")
            if not offset:
                break
    return records


@router.post("/sync")
async def sync_all_tables() -> Dict[str, Any]:
    """Sync all Airtable tables and return record counts."""
    if not AIRTABLE_API_KEY:
        raise HTTPException(status_code=500, detail="AIRTABLE_API_KEY not configured")

    results = {}
    for name, table_id in TABLE_IDS.items():
        if not table_id:
            results[name] = {"status": "skipped", "reason": "table_id not set"}
            continue
        try:
            records = await fetch_table_records(AIRTABLE_BASE_ID, table_id)
            results[name] = {"status": "success", "records_fetched": len(records)}
        except HTTPException as e:
            results[name] = {"status": "failed", "error": e.detail}
        except Exception as e:
            results[name] = {"status": "failed", "error": str(e)}

    total = sum(r.get("records_fetched", 0) for r in results.values())
    return {"status": "completed", "results": results, "total_records": total}


@router.get("/status")
async def airtable_status() -> Dict[str, Any]:
    """Check Airtable connectivity."""
    if not AIRTABLE_API_KEY:
        return {"connected": False, "error": "AIRTABLE_API_KEY not set"}
    headers = {"Authorization": f"Bearer {AIRTABLE_API_KEY}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"https://api.airtable.com/v0/meta/bases",
                headers=headers
            )
            if resp.status_code == 200:
                return {"connected": True, "base_id": AIRTABLE_BASE_ID}
            return {"connected": False, "error": f"HTTP {resp.status_code}"}
        except Exception as e:
            return {"connected": False, "error": str(e)}
