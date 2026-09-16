# Security Audit - Immediate Actions Required

**Date:** 2026-09-16  
**Status:** 🔴 URGENT  
**Deadline:** 48 hours

---

## Executive Summary

Security audit complete. Overall posture is **GOOD** with 18 strong security controls in place, but **3 CRITICAL vulnerabilities** require immediate attention.

### Your Security Score: 🟡 **7.5/10**

**Strengths:**
- ✅ Excellent authentication (bcrypt, 2FA, session versioning)
- ✅ Nonce-based CSP (no unsafe-inline)
- ✅ Comprehensive PII-aware logging
- ✅ Strong rate limiting implementation
- ✅ Proper CORS and security headers

**Critical Gaps:**
- 🔴 3 Critical auth CVEs in dependencies
- 🔴 Potential plaintext password storage in DealRoom
- 🔴 Missing CSRF protection
- 🟠 6 high-severity issues

---

## 🔴 CRITICAL: Fix in Next 24 Hours

### 1. Update Dependencies (15 minutes)

**Issue:** Auth.js has 3 critical CVEs including account takeover vulnerabilities

```bash
# Run now:
npm audit fix --force

# Verify:
npm audit --omit=dev

# If auto-fix fails:
npm install @auth/prisma-adapter@latest @babel/core@latest
```

**Impact if not fixed:** Authentication bypass, account takeover, DoS

---

### 2. Verify DealRoom Password Security (30 minutes)

**Issue:** Schema warns about plaintext password storage

```bash
# Check all password operations:
grep -r "dealRoom.*password\|password.*dealRoom" src/app/api

# Specifically check PATCH routes:
grep -r "PATCH\|UPDATE" src/app/api/**/deal-room*
```

**If plaintext found, add this middleware:**

```typescript
// src/lib/prisma.ts

prisma.$use(async (params, next) => {
  if (params.model === 'DealRoom') {
    if (['create', 'update', 'updateMany'].includes(params.action)) {
      if (params.args.data?.password && !params.args.data.password.startsWith('$2a$')) {
        // Hash password if not already hashed
        params.args.data.password = await bcrypt.hash(params.args.data.password, 12)
      }
    }
  }
  return next(params)
})
```

---

### 3. Fix Environment File Permissions (5 minutes)

**Issue:** `.env` files readable by all users (security risk on shared systems)

```bash
# Fix immediately:
chmod 600 .env .env.local .env.vercel

# Verify:
ls -la .env*
# Should show: -rw------- (600)

# Check if secrets were committed to git:
git log --all --full-history -- ".env*"

# If found: rotate all secrets immediately!
```

---

## 🟠 HIGH: Fix This Week

### 4. Add CSRF Protection (4 hours)

**Issue:** State-changing operations lack CSRF tokens

Create `src/lib/csrf.ts`:

```typescript
import { getCsrfToken } from "next-auth/react"
import { NextRequest, NextResponse } from "next/server"

export async function validateCsrf(req: NextRequest): Promise<NextResponse | null> {
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    const csrfToken = req.headers.get('x-csrf-token')
    const sessionCsrf = await getCsrfToken({ req })
    
    if (!csrfToken || csrfToken !== sessionCsrf) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' }, 
        { status: 403 }
      )
    }
  }
  return null
}
```

Apply to routes:
- `/api/projects` (POST)
- `/api/deal-rooms` (POST/PATCH)
- `/api/access-requests` (POST/PATCH)
- `/api/users/[id]` (PATCH/DELETE)

---

### 5. Secure Admin Migration Routes (2 hours)

**Issue:** SQL injection risk in `/api/admin/run-migrations`

**Option A: Remove these endpoints** (recommended)
```bash
rm -rf src/app/api/admin/run-migrations
rm -rf src/app/api/admin/run-migration
rm -rf src/app/api/admin/migrate-*

# Use Prisma migrations instead:
npx prisma migrate deploy
```

**Option B: Whitelist specific migrations**
```typescript
const ALLOWED_MIGRATIONS = new Set([
  'add_session_version',
  'add_user_id_column'
])

export async function POST(req: NextRequest) {
  const { migration } = await req.json()
  
  if (!ALLOWED_MIGRATIONS.has(migration)) {
    return NextResponse.json({ error: 'Invalid migration' }, { status: 400 })
  }
  
  // Execute hardcoded SQL only (no user input)
  switch (migration) {
    case 'add_session_version':
      await prisma.$executeRaw`
        ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER DEFAULT 1
      `
      break
  }
}
```

---

### 6. Extend Rate Limiting (2 hours)

**Issue:** Only 22 out of 133 routes have rate limiting

Add to these routes:
```
/api/projects/[id] (PATCH/DELETE)
/api/users/[id] (PATCH/DELETE)  
/api/documents/[id] (DELETE)
/api/deal-rooms/[id] (PATCH/DELETE)
/api/notifications (POST)
```

Pattern:
```typescript
import { applyRateLimit, rateLimiters } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // Add rate limit:
  const rateLimitResponse = await applyRateLimit(
    req, 
    rateLimiters.write, 
    session?.user?.id
  )
  if (rateLimitResponse) return rateLimitResponse
  
  // Continue...
}
```

---

### 7. Add Authorization Checks (3 hours)

**Issue:** Not all routes verify user permissions beyond authentication

Create `src/lib/permissions.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function canAccessProject(
  userId: string, 
  projectId: string
): Promise<boolean> {
  const [project, user] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })
  ])
  
  if (!project || !user) return false
  
  // Owner or admin can access
  return project.ownerId === userId || 
         ['SUPER_ADMIN', 'ADMIN'].includes(user.role)
}

export async function canModifyProject(
  userId: string, 
  projectId: string
): Promise<boolean> {
  const [project, user] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })
  ])
  
  if (!project || !user) return false
  
  // Only owner or super admin can modify
  return project.ownerId === userId || user.role === 'SUPER_ADMIN'
}

export async function canAccessDealRoom(
  userId: string, 
  dealRoomId: string
): Promise<boolean> {
  const dealRoom = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: { 
      project: { select: { ownerId: true } },
      members: { where: { userId } }
    }
  })
  
  if (!dealRoom) return false
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })
  
  // Project owner, deal room member, or admin
  return dealRoom.project.ownerId === userId ||
         dealRoom.members.length > 0 ||
         ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '')
}
```

Apply to routes:
```typescript
// /api/projects/[id] DELETE
if (!await canModifyProject(session.user.id, projectId)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// /api/deal-rooms/[id] GET
if (!await canAccessDealRoom(session.user.id, dealRoomId)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## 🟡 MEDIUM: Fix This Month

### 8. Secure Debug Endpoints (30 minutes)

**Routes:**
- `/api/debug`
- `/api/sentry-test`
- `/api/airtable`

Add to each:
```typescript
export async function GET(req: NextRequest) {
  // Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  // Require super admin
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Debug logic...
}
```

---

### 9. Secure Health Endpoint (30 minutes)

**Issue:** `/api/health` exposes configuration details without authentication

```typescript
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const healthSecret = process.env.HEALTH_CHECK_SECRET || 'change-me'
  
  const isAuthorized = authHeader === `Bearer ${healthSecret}`
  
  if (!isAuthorized) {
    // Minimal response for public uptime monitors
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  }
  
  // Full detailed health check (existing logic)
  // ...
}
```

Add to `.env`:
```bash
HEALTH_CHECK_SECRET="$(openssl rand -base64 32)"
```

---

### 10. Add MIME Type Validation (1 hour)

Install library:
```bash
npm install file-type
```

Update upload routes:
```typescript
import { fileTypeFromBuffer } from 'file-type'

export async function POST(req: NextRequest) {
  const file = formData.get('file') as File
  const buffer = await file.arrayBuffer()
  const fileType = await fileTypeFromBuffer(new Uint8Array(buffer))
  
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument',
    'application/msword',
    'image/jpeg',
    'image/png'
  ]
  
  if (!fileType || !ALLOWED_TYPES.includes(fileType.mime)) {
    return NextResponse.json({ 
      error: 'Invalid file type. Only PDF, Word, Excel, and images allowed.' 
    }, { status: 400 })
  }
  
  // Continue with upload...
}
```

---

## Testing Checklist

After implementing fixes:

```bash
# 1. Verify dependencies fixed
npm audit --omit=dev
# Should show 0 critical vulnerabilities

# 2. Test authentication
curl -X POST http://localhost:3005/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
# Should return error, not crash

# 3. Test CSRF protection
curl -X POST http://localhost:3005/api/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"name":"Test Project"}'
# Should fail with CSRF error (403)

# 4. Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3005/api/auth/signin
done
# Should get 429 after 5 attempts

# 5. Test authorization
curl -X DELETE http://localhost:3005/api/projects/{other-user-project-id} \
  -H "Cookie: next-auth.session-token=..."
# Should return 403 Forbidden

# 6. Verify file permissions
ls -la .env*
# Should all show -rw------- (600)

# 7. Check security headers
curl -I http://localhost:3005
# Should include CSP, X-Frame-Options, etc.
```

---

## Summary Checklist

### Immediate (24 hours)
- [ ] `npm audit fix --force`
- [ ] Verify DealRoom password hashing
- [ ] Fix `.env` file permissions (chmod 600)
- [ ] Check git history for leaked secrets

### This Week
- [ ] Add CSRF protection to POST/PATCH/DELETE routes
- [ ] Secure or remove admin migration routes
- [ ] Extend rate limiting to all write operations
- [ ] Add authorization checks (canAccessProject, etc.)

### This Month
- [ ] Secure debug endpoints (SUPER_ADMIN only + disable in prod)
- [ ] Add authentication to health endpoint
- [ ] Add MIME type validation to file uploads
- [ ] Review and apply input sanitization consistently

### Monitoring
- [ ] Set up Sentry alerts for auth failures
- [ ] Monitor rate limit violations
- [ ] Track failed authorization attempts
- [ ] Review audit logs weekly

---

## Questions or Issues?

If you encounter problems implementing these fixes:

1. **Dependency conflicts:** Try `npm audit fix` without `--force` first
2. **CSRF breaks frontend:** Ensure frontend sends `x-csrf-token` header
3. **Rate limiting too strict:** Adjust limits in `src/lib/rate-limit.ts`
4. **Authorization too restrictive:** Review role hierarchy in `canAccessProject()`

---

## Full Report

For detailed findings, attack scenarios, and code examples:
📄 **See:** `COMPREHENSIVE_SECURITY_AUDIT_2026-09-16.md`

---

**Next Audit Recommended:** 2026-12-16 (Quarterly)  
**Security Score Target:** 🟢 9.0/10
