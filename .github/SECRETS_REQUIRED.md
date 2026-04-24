# Required GitHub Actions Secrets

All secrets below must be set in:
**GitHub → Repository → Settings → Secrets and variables → Actions → Repository secrets**

## Authentication (Required for build + E2E tests)

| Secret | Description | Example |
|---|---|---|
| `NEXTAUTH_URL` | Full URL of deployed app | `https://app.africa-infra.com` |
| `NEXTAUTH_SECRET` | Random 32-byte base64 string | `openssl rand -base64 32` |
| `AZURE_AD_CLIENT_ID` | Azure Entra app client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_AD_CLIENT_SECRET` | Azure Entra app client secret | From Entra portal → Certificates & secrets |
| `AZURE_AD_TENANT_ID` | Azure Entra tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

## Database

| Secret | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |

## Monitoring

| Secret | Description | Required? |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking | Optional — disables Sentry if blank |
| `SENTRY_AUTH_TOKEN` | Sentry CLI auth token for source maps | Optional |
| `SENTRY_ORG` | Sentry organisation slug | Optional |
| `SENTRY_PROJECT` | Sentry project slug | Optional |

## E2E Tests

| Secret | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL (if applicable) |
| `E2E_TEST_EMAIL` | Test user email for Playwright |
| `E2E_TEST_PASSWORD` | Test user password for Playwright |

## Rate Limiting (Optional)

| Secret | Description |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL (falls back to in-memory if absent) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

## How to Rotate Secrets

- `NEXTAUTH_SECRET`: `openssl rand -base64 32` — rotate every 90 days
- `AZURE_AD_CLIENT_SECRET`: Rotate in Entra portal before expiry — update here simultaneously
- `DATABASE_URL`: Update after any DB credential rotation
