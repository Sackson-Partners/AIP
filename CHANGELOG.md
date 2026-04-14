# Changelog

All notable changes to AIP Platform are documented here.

## [Unreleased]

### Security
- Added authentication to `/projects` and `/investors` endpoints (previously public)
- Fixed privilege escalation via unrestricted `setattr` on user fields
- Added ownership checks on documents and deal rooms (403 for cross-user access)
- Removed role self-assignment from registration endpoint
- Fixed open redirect vulnerability in login flow via `safeRedirect` utility
- Tightened rate limiting from 10/min to 5/min on login endpoints
- Added ALLOWED_ORIGINS validation assertion in production

### Fixed
- ErrorBoundary now reports exceptions to Sentry with component stack context
- Backend global exception handler now captures all unhandled errors to Sentry
- JWT role claim no longer written to database (prevents role self-escalation)
- Passlib (unmaintained) replaced with direct `bcrypt` usage
- Duplicate auth modules consolidated (`backend/app/` dead code removed)
- FastAPI `/docs` and `/redoc` disabled in production environment

### Performance
- Added database indexes on 5 high-query FK columns (pipeline_logs, investment_committees, investor_interests)
- Added 300ms debounce to project filter inputs to reduce API call frequency
- Added `useMemo` to expensive computed values (analytics counts, pipeline stage map, PETFEL pillar scores)
- Added `AbortController` to dashboard useEffect to prevent state updates after unmount
- Batched PETFEL pillar score queries (was N+1, now 1 query with in-memory grouping)
- Extracted pipeline SLA calculation logic into reusable helper

### Improved
- Shared SVG icon components extracted to `src/components/ui/icons.tsx` (removed 23 duplicates)
- Sentry user context (`id`, `email`) set after successful login, cleared on logout
- Release version tracking added to Sentry (frontend + backend)
- `useDebounce` hook extracted to `src/hooks/useDebounce.ts`
- CI npm audit level tightened from `high` to `moderate`
- HSTS (`Strict-Transport-Security`) header added to all responses
- Content Security Policy header hardened
- Request ID middleware added to all backend responses (`X-Request-ID`)
- Structured health check endpoint with database connectivity verification
- Debug router (`/api/debug/test-sentry`) for verifying Sentry integration (non-production only)

### Tests Added
- `test_auth_protection.py` — 401 verification for all newly protected endpoints
- `test_ownership_checks.py` — cross-user access denied (403) for documents and deal rooms
- `test_role_security.py` — role self-assignment blocked, admin-only role changes
- `test_rbac.py` — full RBAC matrix (analyst, admin, unauthenticated)
- `test_rate_limiting.py` — login rate limit enforcement
- `test_ai_endpoints.py` — AI endpoint auth and schema validation
- `test_db_indexes.py` — database index presence verification
- Frontend unit tests: `safeRedirect`, `useDebounce`, `ErrorBoundary`, icon components
- E2E tests: auth flow (login, logout, register, open redirect), dashboard navigation

### Documentation
- README rewritten with full setup, architecture, and deployment documentation
- CHANGELOG created
- CONTRIBUTING guide created
