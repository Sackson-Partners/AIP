# Security Hardening — Fixes Applied

Date: 2026-04-23

## FIX 1 — DealRoom password hashing

- Created `src/app/api/deal-rooms/route.ts` — GET (list) and POST (create with bcrypt.hash password)
- Created `src/app/api/deal-rooms/[id]/route.ts` — GET (strip password), POST (access check via bcrypt.compare, returns 403 on mismatch), DELETE (require auth)

## FIX 2 — ACCOUNT_LOCKED UI feedback

File: `src/app/auth/signin/page.tsx`

- Added `LockKeyhole` to lucide-react imports
- Added `ACCOUNT_LOCKED`, `CredentialsSignin`, `AccessDenied` entries to `ERROR_MESSAGES`
- Added `errorCode` state to track raw error code separately from display message
- Updated `useEffect` and `handleInternalSignIn` to call `setErrorCode(err)`
- Updated error display to use red + LockKeyhole for ACCOUNT_LOCKED, amber + AlertCircle for all other errors
- Added `role="alert"` and `aria-live="assertive"` for accessibility
- Clears `errorCode` when switching tabs

## FIX 3 — Orphaned Azure AD user cleanup script

- Created `scripts/cleanup-orphaned-users.ts` — dry-run by default, `--confirm-delete` flag to delete
- Added `"cleanup:orphaned-users"` to `package.json` scripts

## FIX 4 — Rate limiting

- Installed `@upstash/ratelimit` and `@upstash/redis`
- Created `src/lib/rate-limit.ts` — uses Upstash Redis if env vars present, falls back to in-memory Map
- Updated `src/app/api/auth/[...nextauth]/route.ts` — applies rate limit to `POST /api/auth/signin/internal-credentials` only

## FIX 5 — File upload security validator

- Created `src/lib/file-validator.ts` — validates extension (allowlist + blocklist), path traversal check, 50 MB size limit, sanitizes filename

## FIX 6 — Remove Python backend proxy from next.config.ts

- Removed both rewrites from `next.config.ts` (`/api/auth/:path*` self-rewrite and `/api/:path*` → Python backend proxy)
- Removed `NEXT_PUBLIC_API_URL` from `src/lib/api/airtable.ts`, updated fetch to use `/api/airtable` relative path
- Created stub `src/app/api/airtable/route.ts` returning 501 Not Implemented

## FIX 7 — ICCommittee TypeScript fix

File: `src/app/dashboard/ic/page.tsx`

- Added `ICCommitteeListItem` interface with correct fields: `committee_id`, `project_id`, `project_name?`, `scheduled_date?`, `status`, `outcome?`, `vote_count`, `quorum`
- Changed `committees` state type from `ICCommittee[]` to `ICCommitteeListItem[]`
- Changed `selectedCommittee` state type to `ICCommitteeListItem | null`
- Changed `openCommittee` parameter type to `ICCommitteeListItem`
- Updated `openCommittee` to use `committee.committee_id` instead of `committee.id`
- Removed unused `ICCommittee` import
- Removed `(committees as any[])` cast — now `committees.map((c) => ...` directly

## FIX 8 — Error states on IC page catch blocks

File: `src/app/dashboard/ic/page.tsx`

- Added `loadError` state
- Updated `fetchCommittees` catch to set `loadError` message in addition to Sentry
- Updated `fetchData` catch to set `loadError` message in addition to Sentry
- Updated `openCommittee` catch to call `toastError` in addition to Sentry (removed `eslint-disable no-console` comments that were no longer needed)
- Added `loadError` display block in JSX above sessions list

## FIX 9 — Orphaned API routes report

- Created `ORPHANED_ROUTES_REPORT.md` documenting the one affected file, the stub created, and all verified Next.js routes

## FIX 10 — GitHub Actions secrets documentation

- Created `.github/SECRETS_REQUIRED.md` documenting all required and optional secrets
- Updated `.github/workflows/ci-cd.yml` — added "Check required secrets" step as first step in `frontend-check` job

## Pre-existing lint errors fixed (collateral)

- `src/app/admin/layout.tsx` — removed unused `LogOut` import
- `src/app/admin/settings/page.tsx` — removed unused `useEffect` import
- `src/app/admin/users/page.tsx` — removed unused `Eye` and `Edit2` imports
- `src/app/api/admin/users/[id]/route.ts` — added eslint-disable for destructured `passwordHash` vars
- `src/components/layout/DashboardShell.tsx` — removed unused `Bell` import
- `src/hooks/useRBAC.ts` — prefixed unused `permission` parameter with `_`
- `src/app/dashboard/investor/page.tsx` — removed unused `STAGES` constant
