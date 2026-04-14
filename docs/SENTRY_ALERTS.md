# Sentry Alerts Configuration

## Overview

AIP uses Sentry for error monitoring and performance tracing across the frontend (Next.js) and backend (FastAPI). This document describes recommended alert rules and thresholds.

## Frontend Alerts (Sentry Project: aip-frontend)

| Alert | Condition | Threshold | Action |
|-------|-----------|-----------|--------|
| High error rate | `error.rate` per minute | > 5 errors/min | Notify #eng-alerts |
| P75 LCP degraded | `measurements.lcp` | > 4000ms | Notify #frontend |
| Auth errors | `transaction:/api/auth/*` error | Any 5xx | PagerDuty |
| JS exception spike | Unhandled JS exceptions | > 10/min | Notify #eng-alerts |

## Backend Alerts (Sentry Project: aip-backend)

| Alert | Condition | Threshold | Action |
|-------|-----------|-----------|--------|
| 5xx spike | HTTP 500+ responses | > 3/min | PagerDuty |
| Slow transaction | `transaction.duration` | > 5000ms P95 | Notify #eng-alerts |
| Database timeout | `db.query` span | > 2000ms | Notify #eng-alerts |
| Slow DB query | `SLOW QUERY` log message | Any | Sentry `warning` |
| Memory pressure | `process.memory` | > 512MB | Notify #ops |

## Performance Baselines

The following baselines were established during load testing:

| Endpoint | P50 | P95 | SLO |
|----------|-----|-----|-----|
| `GET /api/projects` | 80ms | 200ms | 99.5% < 500ms |
| `POST /api/projects` | 120ms | 350ms | 99% < 1000ms |
| `GET /api/pipeline/overview` | 150ms | 400ms | 99% < 1000ms |
| `POST /api/petfel/assess/{id}` | 200ms | 600ms | 99% < 2000ms |
| `POST /api/radar/scan` (AI) | 3000ms | 8000ms | 95% < 15000ms |

## Slow Query Logging

The backend logs all queries slower than 0.5s at `INFO` level and captures queries slower than 2.0s to Sentry as `warning` level events. See `backend/database.py` for the SQLAlchemy event listeners.

## Setup

1. Create a Sentry project for `aip-backend` and `aip-frontend`
2. Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in your environment
3. Import the alert rules above in Sentry → Alerts → Create Alert Rule
4. Configure PagerDuty integration under Sentry → Settings → Integrations

## Alert Routing

```
severity: critical  → PagerDuty (on-call rotation)
severity: warning   → Slack #eng-alerts
severity: info      → Sentry inbox only
```
