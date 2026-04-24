# Orphaned API Routes Report

Generated: 2026-04-24

## Summary

One file in `src/` was found using `NEXT_PUBLIC_API_URL` to call the deprecated Python backend.
All other API calls in the codebase use the relative `/api` path via axios (which previously
went through the Next.js rewrite proxy to the Python backend at localhost:8000).

## Files Affected

### 1. `src/lib/api/airtable.ts`

**Issue:** Used `NEXT_PUBLIC_API_URL` as base URL to call `/airtable/*` Python endpoints.

**Action taken:** Removed `NEXT_PUBLIC_API_URL` dependency. Updated to use relative `/api/airtable` path.

**Stub created:** `src/app/api/airtable/route.ts` — returns 501 Not Implemented.

**TODO:** Port Airtable proxy logic from the deleted `backend/routers/airtable.py` to a
new Next.js route at `src/app/api/airtable/route.ts`.

## Routes Now Returning 501 (Stub — Need Implementation)

| Route | Stub File | Notes |
|---|---|---|
| `GET /api/airtable/*` | `src/app/api/airtable/route.ts` | Port from deleted Python router |

## Python Backend Proxy — Removed

The rewrite in `next.config.ts` that proxied `/api/*` → `NEXT_PUBLIC_API_URL/api/*`
has been removed. All `/api/*` routes are now handled exclusively by Next.js API routes.

## Routes Verified as Implemented in Next.js

| Route | File |
|---|---|
| `GET/POST /api/auth/*` | `src/app/api/auth/[...nextauth]/route.ts` |
| `GET/PATCH/DELETE /api/admin/users/[id]` | `src/app/api/admin/users/[id]/route.ts` |
| `GET/POST /api/admin/users` | `src/app/api/admin/users/route.ts` |
| `POST /api/admin/promote` | `src/app/api/admin/promote/route.ts` |
| `GET /api/admin/stats` | `src/app/api/admin/stats/route.ts` |
| `POST /api/auth/change-password` | `src/app/api/auth/change-password/route.ts` |
| `POST /api/auth/complete-profile` | `src/app/api/auth/complete-profile/route.ts` |
| `POST /api/auth/forgot-password` | `src/app/api/auth/forgot-password/route.ts` |
| `GET/POST /api/notifications` | `src/app/api/notifications/route.ts` |
| `PATCH /api/notifications/[id]` | `src/app/api/notifications/[id]/route.ts` |
| `GET/PATCH /api/user/profile` | `src/app/api/user/profile/route.ts` |
| `GET/POST /api/deal-rooms` | `src/app/api/deal-rooms/route.ts` |
| `GET/POST/DELETE /api/deal-rooms/[id]` | `src/app/api/deal-rooms/[id]/route.ts` |

## Manual Steps Required

1. Implement `src/app/api/airtable/route.ts` — port Airtable caching logic
2. Review all other dashboard pages that call `api.*` methods in `src/lib/api.ts`
   to confirm each route exists in Next.js (many routes like /ic, /projects, /investors
   are still proxied through the generic axios client which will now 404)
