# AIP Platform — Africa Infrastructure Partners

## Overview

AIP Platform is an institutional-grade deal origination and due diligence system for African infrastructure investment. It provides PETFEL (Political, Economic, Technical, Financial, Environmental, Legal) due diligence scoring, Executive Investment Note (EIN) generation, AI-powered investor-project matching, and a full deal pipeline with IC governance.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5.6, Tailwind CSS 4 |
| Backend | FastAPI 0.135, Python 3.11, SQLAlchemy 2, Alembic |
| Auth | Supabase (JWT, OAuth) |
| Database | PostgreSQL via Supabase (prod), SQLite (local/test) |
| Storage | Azure Blob Storage (documents, signed URLs) |
| AI | Anthropic Claude API |
| Monitoring | Sentry (frontend + backend) |
| Deployment | Vercel (frontend), Azure Container Apps (backend) |

## Prerequisites

- Node.js 20+
- Python 3.11+
- Supabase account (for auth)
- Azure account (for storage)
- Vercel account (for frontend deployment)

## Local Development Setup

### Frontend

```bash
git clone https://github.com/Sackson-Partners/AIP
cd AIP
npm install
cp .env.example .env.local
# Fill in required values (see Environment Variables below)
npm run dev
```

### Backend

```bash
cd AIP
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in required values (see Environment Variables below)
alembic upgrade head
uvicorn backend.main:app --reload
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SECRET_KEY` | Yes | JWT signing key — generate with `openssl rand -hex 32` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (backend only) |
| `SUPABASE_JWT_SECRET` | Yes | Supabase JWT secret (for offline token verification) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL (frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (frontend) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key |
| `AZURE_STORAGE_CONNECTION_STRING` | Yes | Azure Blob Storage connection string |
| `AZURE_STORAGE_CONTAINER` | No | Container name (default: `aip-documents`) |
| `ALLOWED_ORIGINS` | Yes (prod) | Comma-separated allowed CORS origins |
| `SENTRY_DSN` | No | Backend Sentry DSN (leave blank to disable) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Frontend Sentry DSN |
| `SENTRY_AUTH_TOKEN` | No | Sentry auth token for source map upload |
| `ENVIRONMENT` | No | `development` / `staging` / `production` |
| `APP_VERSION` | No | Release version for Sentry (e.g. `aip@1.0.0`) |

See `.env.example` for a complete list with descriptions.

## Testing

```bash
# Backend tests with coverage
pytest backend/tests/ --cov=backend --cov-fail-under=60 -v

# Frontend unit tests
npm run test

# E2E tests (requires running server at http://localhost:3000)
npm run test:e2e
```

Set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` environment variables for E2E tests.

## Deployment

### Vercel (Frontend)
Push to `main` — Vercel auto-deploys from GitHub.

### Azure Container Apps (Backend)
GitHub Actions CI/CD deploys automatically on push to `main`.

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription GUID |
| `AZURE_RESOURCE_GROUP` | Azure resource group name |
| `AZURE_CONTAINER_APP_NAME` | Azure Container App name |
| `AZURE_CREDENTIALS` | Azure service principal JSON |
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `POSTGRES_PASSWORD` | Production database password |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload |

## Architecture

```
Browser
  │
  ▼
Vercel (Next.js Frontend)
  │  ├─ Supabase Auth (login, register, JWT)
  │  └─ /api/* → Azure Backend (via Next.js rewrite)
  │
  ▼
Azure Container Apps (FastAPI Backend)
  │  ├─ Supabase PostgreSQL (primary database)
  │  ├─ Azure Blob Storage (documents)
  │  └─ Anthropic Claude API (AI features)
```

## CI/CD Pipeline

The pipeline (`.github/workflows/ci-cd.yml`) runs on every push to `main`:

1. **Security Scan** — `npm audit`, ESLint, TypeScript check, `pip-audit`
2. **Frontend Check** — TypeScript compilation
3. **Backend Test** — pytest with coverage (≥50% required)
4. **Docker Build + Push** — builds and pushes to Docker Hub, runs smoke test
5. **Azure Deploy** — deploys to Azure Container Apps with automatic rollback on failure
