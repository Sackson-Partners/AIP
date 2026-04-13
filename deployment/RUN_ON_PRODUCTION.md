# AIP Platform — Production Deployment Runbook

Run these steps **in order** after each deployment that includes database changes.
All commands assume you have `DATABASE_URL` set to the production PostgreSQL connection string.

---

## 1. Set environment variables

```bash
export DATABASE_URL="postgresql+psycopg2://<user>:<password>@<host>:5432/<dbname>"
```

For Azure Database for PostgreSQL, the connection string format is:
```
postgresql+psycopg2://<adminuser>@<server>:<password>@<server>.postgres.database.azure.com:5432/<dbname>?sslmode=require
```

---

## 2. Run Alembic migrations

From the repo root:

```bash
alembic upgrade head
```

To verify the current revision matches `head`:

```bash
alembic current
```

Expected output after full migration chain:
```
006_add_notifications (head)
```

### Migration chain (as of 2026-04-13)

| Revision | What it does |
|---|---|
| `be9b3e8a2c28` | Initial schema — all core tables |
| `002_extend_deal_rooms` | Adds 10 columns to deal_rooms |
| `003_add_deal_room_subtables` | Creates deal_room_members, deal_room_documents, deal_room_meetings |
| `004_extend_project_events` | Adds 5 columns to project_events |
| `005_add_missing_indexes` | Adds 7 FK/filter indexes |
| `006_add_notifications` | Creates notifications table |

---

## 3. Verify migration integrity

Check for any models not covered by migrations (should print nothing):

```bash
python3 - <<'EOF'
import os
os.environ.setdefault('AIRTABLE_BASE_ID', 'check')
os.environ.setdefault('AIRTABLE_PROJECTS_TABLE', 'check')
from backend.models import Base
tables = sorted(Base.metadata.tables.keys())
print(f"Total tables registered in ORM metadata: {len(tables)}")
for t in tables:
    print(f"  {t}")
EOF
```

---

## 4. Restart the container app

On Azure Container Apps:

```bash
az containerapp update \
  --name <AZURE_CONTAINER_APP_NAME> \
  --resource-group <AZURE_RESOURCE_GROUP> \
  --image sacksons/aip-api:latest
```

---

## 5. Health check

```bash
curl -sf https://<your-app-fqdn>/health && echo "OK"
```

---

## Rollback

To roll back one migration:

```bash
alembic downgrade -1
```

To roll back to a specific revision:

```bash
alembic downgrade 005_add_missing_indexes
```

---

## Notes

- **Schema drift check**: `alembic check` (requires Alembic 1.9+) compares the live DB to model metadata and reports differences.
- **SQLite not supported for production migrations** — migrations 002+ use PostgreSQL-only foreign key syntax. Always run against PostgreSQL.
- The `env.py` import chain: `env.py` → `backend.models` → `backend.models_aip_v2`. Both files share `Base` from `backend.database`, so all tables are captured in `target_metadata`.
