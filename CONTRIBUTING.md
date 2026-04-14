# Contributing to AIP Platform

## Development Workflow

1. Create a branch from `main`
2. Make changes
3. Run tests locally (see below)
4. Submit a pull request

## Branch Naming

```
feature/description
fix/description
security/description
perf/description
docs/description
test/description
```

## Commit Convention

```
feat: add new feature
fix: fix a bug
security: security improvement
perf: performance improvement
docs: documentation only
test: add or fix tests
chore: maintenance, dependencies, config
```

## Before Submitting a PR

- [ ] All backend tests pass: `pytest backend/tests/ -v`
- [ ] Frontend builds: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] TypeScript check: `npx tsc --noEmit`
- [ ] No new npm vulnerabilities: `npm audit --audit-level=moderate`
- [ ] New features have tests
- [ ] `.env.example` updated if new environment variables were added

## Running Tests

```bash
# Backend (from repo root)
pytest backend/tests/ --cov=backend -v

# Frontend unit tests
npm run test

# E2E tests (requires dev server running)
npm run dev &
npm run test:e2e
```

## Environment Setup

```bash
cp .env.example .env.local    # frontend
cp .env.example .env          # backend
```

Fill in the required values. Never commit `.env` or `.env.local` — they are in `.gitignore`.

## Architecture Constraints

- **Supabase** = Authentication only (JWT issuance, user identity)
- **Azure** = Backend API + PostgreSQL database + Blob Storage
- **Vercel** = Frontend hosting only

Do not route backend logic through Vercel serverless functions.
Do not use Supabase as a primary data store — it is auth-only.

## Security Guidelines

- Never commit secrets or API keys
- All new endpoints must have authentication (`get_current_user` or stricter)
- All user-owned resources must check ownership before mutation
- Password complexity is enforced — do not weaken validation rules
- Rate limiting is required on all authentication endpoints
