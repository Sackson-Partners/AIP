# Migration Notes — aip_backend Decision

**Date:** 2026-04-25
**Decision:** Option C — Drop aip_backend

## Audit Results

Audited the `aip_backend` database on the shared `aip-db` Azure PostgreSQL server.

### Tables found (37 total)

| Table                  | Row Count |
|------------------------|-----------|
| infrastructure_projects | 5        |
| pipeline_stages         | 5        |
| investors               | 4        |
| users                   | 4        |
| All other 33 tables     | 0        |

### Date range analysis

| Table                   | Min created_at      | Max created_at      |
|-------------------------|---------------------|---------------------|
| infrastructure_projects | 2026-03-26 09:46    | 2026-03-26 13:20    |
| investors               | 2026-03-26 10:13    | 2026-03-26 13:20    |
| users                   | 2026-03-26 09:46    | 2026-04-03 13:22    |

### Schema characteristics

- Managed by **Alembic** (Python migration tool) — completely different from the Prisma schema
- Snake_case table and column names (`infrastructure_projects`, not `Project`)
- 37 tables, only 4 with any data
- All data confined to a single day (2026-03-26) — confirms this is development seed data

## Decision Rationale

**Option C chosen** because:

1. **No real production data** — all rows were created on 2026-03-26, a single development seeding session
2. **Incompatible schema** — Alembic-managed Python schema is structurally different from the Prisma schema; migration would require mapping every table/column manually with no guarantee of correctness
3. **Low risk** — 13 rows total across 4 tables; nothing that cannot be re-created from the new seed script
4. **Clean break** — the Python backend has been fully removed from the codebase; keeping its database adds operational overhead with no benefit

## How to Drop

Run the drop script as the Azure PostgreSQL admin:

```bash
psql "host=aip-db.postgres.database.azure.com port=5432 dbname=postgres user=sackson sslmode=require" \
  -f scripts/drop-aip-backend.sql
```

**Note:** This script terminates active connections before dropping. Confirm no other services are connected to `aip_backend` before running.

## Current Database State (post-migration)

| Database         | Status  | Purpose                          |
|------------------|---------|----------------------------------|
| aip_frontend     | Active  | Next.js app — Prisma managed     |
| aip_backend      | Pending drop | Python legacy — orphaned    |
| postgres         | System  | Azure admin DB                   |
| azure_maintenance| System  | Azure internal                   |
| azure_sys        | System  | Azure internal                   |
