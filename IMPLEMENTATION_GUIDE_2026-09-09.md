# AIP Platform - Implementation Guide: What to Do & How to Do It

**Date:** 2026-09-09  
**Purpose:** Practical, step-by-step implementation of security fixes  
**Audience:** Development team  
**Timeline:** 30 days (critical fixes in 7 days)  

---

## 📋 Table of Contents

1. [Week 1: Critical Security Fixes](#week-1-critical-security-fixes)
2. [Week 2: High Priority Fixes](#week-2-high-priority-fixes)
3. [Week 3-4: Medium Priority & Architecture](#week-3-4-medium-priority--architecture)
4. [Testing Strategy](#testing-strategy)
5. [Deployment Checklist](#deployment-checklist)

---

## 🔴 Week 1: Critical Security Fixes

### Day 1: Global Middleware (✅ DONE)

**Status:** ✅ Implemented in `src/middleware.ts`

**What We Did:**
- Created global middleware to protect ALL routes
- Block PENDING users from accessing platform
- Block SUSPENDED/DEACTIVATED users
- Enforce role-based access to admin routes
- Add CORS headers to API responses

**Testing:**
```bash
# Test 1: Unauthenticated access should redirect to signin
curl -v http://localhost:3005/dashboard
# Expected: 307 redirect to /auth/signin

# Test 2: PENDING user should be blocked
# 1. Create test user with status=PENDING
# 2. Sign in with that user
# 3. Try to access /dashboard
# Expected: Redirect to /auth/pending

# Test 3: Non-admin accessing /admin
# 1. Sign in as INSTITUTIONAL_INVESTOR
# 2. Try to access /admin/users
# Expected: Redirect to /unauthorized

# Test 4: API routes require auth
curl -v http://localhost:3005/api/projects
# Expected: 401 Unauthorized
```

**Next Steps:**
1. Deploy to staging
2. Run automated tests
3. Monitor logs for any blocked legitimate users
4. Deploy to production

---

### Day 2: Rate Limiting for Expensive Operations (6 hours)

#### Part 1: Enhanced Rate Limit Library (2 hours)

**File:** `src/lib/rate-limit.ts`

**Current State:**
- Only has `authRateLimit()` for authentication
- Uses in-memory fallback (not production-ready)
- No tiered limits

**What to Do:**
Expand the rate limiting library to support different operation types.

**Step-by-Step Implementation:**

```typescript
// src/lib/rate-limit.ts
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Redis client (reuse across requests)
let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  
  if (!redis) {
    throw new Error('Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN')
  }
  
  return redis
}

// Rate limiters for different operation types
export const rateLimiters = {
  // Authentication: 5 attempts per 5 minutes per IP
  auth: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, '5 m'),
    prefix: 'rl:auth',
    analytics: true,
  }),
  
  // AI generation (expensive): 5 per hour per user
  generate: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:generate',
    analytics: true,
  }),
  
  // AI chat: 20 per hour per user
  chat: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:chat',
    analytics: true,
  }),
  
  // Read operations: 100 per minute per user
  read: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'rl:read',
    analytics: true,
  }),
  
  // Write operations: 20 per hour per user
  write: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'rl:write',
    analytics: true,
  }),
  
  // Contact/spam-prone: 5 per 24 hours per IP
  contact: new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.fixedWindow(5, '24 h'),
    prefix: 'rl:contact',
    analytics: true,
  }),
}

/**
 * Apply rate limiting to a request
 * @param req - Next.js request object
 * @param limiter - Ratelimit instance to use
 * @param identifier - Optional custom identifier (defaults to IP or user ID)
 * @returns NextResponse with 429 if rate limited, null otherwise
 */
export async function applyRateLimit(
  req: NextRequest,
  limiter: Ratelimit,
  identifier?: string
): Promise<NextResponse | null> {
  const id = identifier || getClientIp(req)
  
  try {
    const { success, limit, remaining, reset } = await limiter.limit(id)
    
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      console.log(`[RateLimit] Blocked: ${id}, retry in ${retryAfter}s`)
      
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        }
      )
    }
    
    // Success - log for monitoring
    console.log(`[RateLimit] Allowed: ${id}, remaining: ${remaining}/${limit}`)
    
    return null
  } catch (error) {
    // Rate limiting failed (Redis down?) - allow request but log error
    console.error('[RateLimit] Error:', error)
    return null
  }
}

/**
 * Get client IP address from request headers
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Legacy auth rate limit function (kept for backward compatibility)
 */
export async function authRateLimit(req: NextRequest): Promise<NextResponse | null> {
  return applyRateLimit(req, rateLimiters.auth)
}
```

**Environment Variables Needed:**
```bash
# Add to .env.local and Vercel
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

**How to Get Upstash Redis:**
1. Go to https://console.upstash.com
2. Create free account (10K requests/day free)
3. Create Redis database
4. Copy REST URL and token
5. Add to Vercel environment variables

---

#### Part 2: Apply Rate Limiting to AI Endpoints (4 hours)

**Critical Endpoints to Protect:**

1. **EIN Generation** (`src/app/api/ein/[id]/generate/route.ts`)
2. **PIS Generation** (`src/app/api/pis/[id]/generate/route.ts`)
3. **Chat** (`src/app/api/chat/route.ts`)
4. **Document Summarization** (if exists)
5. **Contact Requests** (`src/app/api/contact-requests/route.ts`)

**Implementation Pattern (Apply to Each):**

```typescript
// Example: src/app/api/ein/[id]/generate/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { applyRateLimit, rateLimiters } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Step 2: Rate limiting (IMPORTANT - per user ID, not IP)
  const rateLimitResponse = await applyRateLimit(
    req,
    rateLimiters.generate,
    session.user.id  // Rate limit per user, not IP
  )
  if (rateLimitResponse) {
    return rateLimitResponse  // 429 Too Many Requests
  }
  
  // Step 3: Authorization check
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id } })
  
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  // Check if user has permission to generate EIN for this project
  const isOwner = project.ownerId === session.user.id
  const isInternal = ['SUPER_ADMIN', 'ADMIN', 'ANALYST'].includes(session.user.role)
  
  if (!isOwner && !isInternal) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Step 4: Existing logic (AI generation)
  try {
    // ... your existing Anthropic API call
    
    return NextResponse.json({ 
      status: 'processing',
      message: 'EIN generation started'
    })
  } catch (error) {
    console.error('[POST /api/ein/[id]/generate]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Checklist - Apply to These Files:**

- [ ] `src/app/api/ein/[id]/generate/route.ts`
- [ ] `src/app/api/pis/[id]/generate/route.ts`
- [ ] `src/app/api/chat/route.ts`
- [ ] `src/app/api/documents/[id]/summarize/route.ts` (if exists)
- [ ] `src/app/api/contact-requests/route.ts`

**Testing Rate Limits:**

```bash
#!/bin/bash
# test-rate-limit.sh

# Get auth token
TOKEN="your-jwt-token-here"

echo "Testing rate limit (should succeed first 5 times)..."

for i in {1..10}; do
  echo "Request $i:"
  curl -X POST http://localhost:3005/api/ein/project-id-123/generate \
    -H "Cookie: next-auth.session-token=$TOKEN" \
    -w "\nHTTP Status: %{http_code}\n\n"
  
  if [ $i -eq 5 ]; then
    echo "Sleeping 2 seconds before hitting rate limit..."
    sleep 2
  fi
done

echo "Expected: First 5 succeed (200), next 5 fail (429)"
```

**Monitoring Rate Limits:**

```typescript
// Add to src/app/api/admin/rate-limits/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // Only admins can view rate limit stats
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  
  // Get all rate limit keys
  const patterns = ['rl:auth:*', 'rl:generate:*', 'rl:chat:*', 'rl:contact:*']
  const stats: Record<string, number> = {}
  
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern)
    stats[pattern] = keys.length
  }
  
  return NextResponse.json({ stats })
}
```

---

### Day 3-4: Mass Assignment Protection (8 hours)

**What is Mass Assignment?**
When API accepts all fields from user input without checking permissions, users can modify restricted fields.

**Example Vulnerability:**
```typescript
// BAD - Current code
const PatchSchema = z.object({
  name: z.string().optional(),
  status: z.string().optional(),  // ❌ User shouldn't change status
  reviewerId: z.string().optional(),  // ❌ User shouldn't assign reviewer
})

await prisma.project.update({ where: { id }, data: body })
// User sends: { status: "APPROVED" } → bypasses admin review!
```

#### Implementation Strategy

**Step 1: Create Role-Based Schemas (2 hours)**

Create a new file for schema definitions:

```typescript
// src/lib/schemas/project.ts
import { z } from 'zod'
import { UserRole, ProjectStatus, ProjectSector, ProjectType, DealStage } from '@prisma/client'

/**
 * Fields that regular users (project owners) can modify
 */
export const UserProjectPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  corridor: z.string().max(200).optional(),
  sector: z.nativeEnum(ProjectSector).optional(),
  projectType: z.nativeEnum(ProjectType).optional(),
  totalCost: z.number().positive().optional(),
  equityRequired: z.number().positive().optional(),
  debtRequired: z.number().positive().optional(),
  grantRequired: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  expectedClose: z.coerce.date().optional(),
  constructionStart: z.coerce.date().optional(),
  operationsStart: z.coerce.date().optional(),
  concessionPeriod: z.number().int().positive().optional(),
})

/**
 * Additional fields that admins can modify
 */
export const AdminProjectPatchSchema = UserProjectPatchSchema.extend({
  status: z.nativeEnum(ProjectStatus).optional(),
  dealStage: z.nativeEnum(DealStage).optional(),
  reviewerId: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
  featuredUntil: z.coerce.date().optional(),
  petfelScore: z.number().min(0).max(100).optional(),
  einScore: z.number().min(0).max(100).optional(),
  riskRating: z.string().optional(),
  esgRating: z.string().optional(),
  archived: z.boolean().optional(),
})

/**
 * Get the appropriate schema based on user role
 */
export function getProjectPatchSchema(role: UserRole) {
  const adminRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]
  return adminRoles.includes(role) ? AdminProjectPatchSchema : UserProjectPatchSchema
}

/**
 * Type helpers
 */
export type UserProjectPatch = z.infer<typeof UserProjectPatchSchema>
export type AdminProjectPatch = z.infer<typeof AdminProjectPatchSchema>
```

**Step 2: Update PATCH Endpoint (2 hours)**

```typescript
// src/app/api/projects/[id]/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getProjectPatchSchema } from '@/lib/schemas/project'
import { UserRole } from '@prisma/client'
import { deleteCached, CacheKeys } from '@/lib/redis'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  // Step 1: Authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  
  // Step 2: Fetch project to check ownership
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, ownerId: true, status: true, title: true }
  })
  
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  // Step 3: Authorization - check ownership or admin role
  const isOwner = project.ownerId === session.user.id
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)
  
  if (!isOwner && !isAdmin) {
    logger.warn('project.patch.forbidden', {
      userId: session.user.id,
      projectId: id,
      reason: 'not_owner_or_admin'
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Step 4: Parse body with role-appropriate schema
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  
  const schema = getProjectPatchSchema(session.user.role as UserRole)
  const parsed = schema.safeParse(body)
  
  if (!parsed.success) {
    logger.warn('project.patch.validation_failed', {
      userId: session.user.id,
      projectId: id,
      errors: parsed.error.flatten()
    })
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }
  
  // Step 5: Additional business logic validation
  // Example: Don't allow changing status from APPROVED back to DRAFT
  if (parsed.data.status && project.status === 'APPROVED' && parsed.data.status === 'DRAFT') {
    return NextResponse.json(
      { error: 'Cannot change status from APPROVED back to DRAFT' },
      { status: 422 }
    )
  }
  
  // Step 6: Update project
  try {
    const updated = await prisma.project.update({
      where: { id },
      data: parsed.data,
    })
    
    // Step 7: Audit log
    await createAuditLog({
      userId: session.user.id,
      email: session.user.email ?? undefined,
      action: 'PROJECT_UPDATED',
      tableName: 'Project',
      recordId: id,
      oldValues: { status: project.status },
      newValues: parsed.data,
    })
    
    // Step 8: Invalidate caches
    await deleteCached(CacheKeys.projects.detail(id))
    await deleteCached('projects:list:*')
    
    logger.info('project.patch.success', {
      userId: session.user.id,
      projectId: id,
      changes: Object.keys(parsed.data)
    })
    
    return NextResponse.json({ data: updated })
  } catch (error) {
    logger.error('project.patch.error', error, {
      userId: session.user.id,
      projectId: id
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 3: Apply to All PATCH Endpoints (4 hours)**

Create schemas for each entity:

1. **User Schema** (`src/lib/schemas/user.ts`)
```typescript
export const UserSelfPatchSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
})

export const AdminUserPatchSchema = UserSelfPatchSchema.extend({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  emailVerified: z.coerce.date().optional(),
})
```

2. **Investor Schema** (`src/lib/schemas/investor.ts`)
3. **DealRoom Schema** (`src/lib/schemas/deal-room.ts`)
4. **Document Schema** (`src/lib/schemas/document.ts`)

**Checklist - Apply Pattern to These Endpoints:**

- [ ] `src/app/api/projects/[id]/route.ts` ✅ (example above)
- [ ] `src/app/api/users/[id]/route.ts`
- [ ] `src/app/api/investors/[id]/route.ts`
- [ ] `src/app/api/deal-rooms/[id]/route.ts`
- [ ] `src/app/api/data-rooms/[projectId]/route.ts`
- [ ] `src/app/api/documents/[id]/route.ts`
- [ ] `src/app/api/ic-committees/[id]/route.ts`
- [ ] `src/app/api/verifications/[id]/route.ts`
- [ ] `src/app/api/events/[id]/route.ts`

**Testing Mass Assignment Protection:**

```typescript
// tests/api/projects-patch.test.ts
import { describe, it, expect } from '@jest/globals'

describe('PATCH /api/projects/[id]', () => {
  it('should prevent non-owners from updating projects', async () => {
    // Create project as user A
    const project = await createProject({ ownerId: 'user-a-id' })
    
    // Try to update as user B
    const response = await patchProject(project.id, { title: 'Hacked' }, 'user-b-token')
    
    expect(response.status).toBe(403)
    expect(response.json).toMatchObject({ error: 'Forbidden' })
  })
  
  it('should prevent regular users from changing status', async () => {
    const project = await createProject({ ownerId: 'user-a-id', status: 'DRAFT' })
    
    // Try to approve own project (should fail)
    const response = await patchProject(
      project.id,
      { status: 'APPROVED' },
      'user-a-token'  // Owner but not admin
    )
    
    expect(response.status).toBe(422)
    expect(response.json.error).toContain('Validation failed')
  })
  
  it('should allow admins to change status', async () => {
    const project = await createProject({ ownerId: 'user-a-id', status: 'DRAFT' })
    
    const response = await patchProject(
      project.id,
      { status: 'APPROVED' },
      'admin-token'
    )
    
    expect(response.status).toBe(200)
    expect(response.json.data.status).toBe('APPROVED')
  })
  
  it('should allow owners to update safe fields', async () => {
    const project = await createProject({ ownerId: 'user-a-id' })
    
    const response = await patchProject(
      project.id,
      { title: 'Updated Title', description: 'Updated desc' },
      'user-a-token'
    )
    
    expect(response.status).toBe(200)
    expect(response.json.data.title).toBe('Updated Title')
  })
})
```

---

### Day 5: Testing & Validation (8 hours)

**Comprehensive Testing Plan:**

#### 1. Unit Tests (4 hours)

Run existing tests and add new ones:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- projects-patch.test.ts

# Run in watch mode
npm test:watch
```

**Add Tests for New Features:**

```typescript
// tests/lib/rate-limit.test.ts
describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    const req = createMockRequest()
    const result = await applyRateLimit(req, rateLimiters.generate, 'test-user')
    expect(result).toBeNull()  // Null means allowed
  })
  
  it('should block requests exceeding limit', async () => {
    const req = createMockRequest()
    const userId = 'test-user-2'
    
    // Make 6 requests (limit is 5)
    for (let i = 0; i < 6; i++) {
      const result = await applyRateLimit(req, rateLimiters.generate, userId)
      if (i < 5) {
        expect(result).toBeNull()
      } else {
        expect(result?.status).toBe(429)
      }
    }
  })
})

// tests/middleware.test.ts
describe('Middleware', () => {
  it('should block PENDING users from dashboard', async () => {
    const req = createMockRequest('/dashboard', { status: 'PENDING' })
    const response = await middleware(req)
    expect(response.status).toBe(307)  // Redirect
    expect(response.headers.get('location')).toContain('/auth/pending')
  })
  
  it('should allow ACTIVE users to access dashboard', async () => {
    const req = createMockRequest('/dashboard', { status: 'ACTIVE' })
    const response = await middleware(req)
    expect(response.status).toBe(200)
  })
  
  it('should block non-admins from /admin routes', async () => {
    const req = createMockRequest('/admin/users', { role: 'INSTITUTIONAL_INVESTOR' })
    const response = await middleware(req)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/unauthorized')
  })
})
```

#### 2. Integration Tests (2 hours)

Test the full request flow:

```bash
# Start dev server
npm run dev

# Run integration tests in another terminal
npm run test:e2e
```

```typescript
// e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test'

test('authentication flow', async ({ page }) => {
  // 1. Visit dashboard without auth
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth\/signin/)
  
  // 2. Sign in
  await page.fill('input[name="email"]', 'admin@africa-infra.com')
  await page.fill('input[name="password"]', 'test-password')
  await page.click('button[type="submit"]')
  
  // 3. Should redirect to dashboard
  await expect(page).toHaveURL('/dashboard')
})

test('rate limiting', async ({ request }) => {
  // Get auth token
  const token = await getAuthToken('test@example.com', 'password')
  
  // Make 6 requests to rate-limited endpoint
  const results = []
  for (let i = 0; i < 6; i++) {
    const response = await request.post('/api/ein/test-project-id/generate', {
      headers: { 'Cookie': `next-auth.session-token=${token}` }
    })
    results.push(response.status())
  }
  
  // First 5 should succeed, 6th should be rate limited
  expect(results.slice(0, 5).every(s => s === 200)).toBe(true)
  expect(results[5]).toBe(429)
})
```

#### 3. Manual Testing Checklist (2 hours)

**Test Cases to Execute Manually:**

```markdown
## Authentication & Authorization

- [ ] Unauthenticated user redirected to signin
- [ ] PENDING user redirected to pending page
- [ ] SUSPENDED user redirected to error page
- [ ] Regular user blocked from /admin
- [ ] Admin can access /admin

## Rate Limiting

- [ ] 6th AI generation request returns 429
- [ ] Rate limit resets after time window
- [ ] Different users have separate rate limits
- [ ] Rate limit headers present in response

## Mass Assignment Protection

- [ ] Regular user CANNOT change project status
- [ ] Regular user CANNOT change reviewerId
- [ ] Regular user CAN change project description
- [ ] Admin CAN change project status
- [ ] Non-owner CANNOT update others' projects
- [ ] Owner CAN update own project

## CORS

- [ ] Preflight OPTIONS requests handled
- [ ] CORS headers present on API responses
- [ ] Requests from allowed origins succeed
- [ ] Requests from disallowed origins fail

## Middleware

- [ ] All /api/* routes require authentication
- [ ] All /dashboard/* routes require authentication
- [ ] Public routes (/, /auth/*) accessible without auth
- [ ] Security headers present on all responses
```

**Testing Tools:**

```bash
# Test authentication
curl -v http://localhost:3005/api/projects
# Expected: 401 Unauthorized

# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3005/api/chat \
    -H "Cookie: next-auth.session-token=$TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"message": "test"}'
  echo ""
done

# Test mass assignment
curl -X PATCH http://localhost:3005/api/projects/abc123 \
  -H "Cookie: next-auth.session-token=$USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}'
# Expected: 422 Validation failed

curl -X PATCH http://localhost:3005/api/projects/abc123 \
  -H "Cookie: next-auth.session-token=$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}'
# Expected: 200 Success
```

---

## 🟠 Week 2: High Priority Fixes

### Day 6-7: Session Version Control (4 hours)

**What is Session Versioning?**
Add a counter to User model that increments when security-sensitive changes occur, forcing all active sessions to re-authenticate.

**Use Cases:**
- User password changed → invalidate all sessions
- User role demoted (ADMIN → USER) → force new login
- User suspended → immediately kick out

**Step 1: Add sessionVersion to User Model (30 min)**

```typescript
// prisma/schema.prisma
model User {
  // ... existing fields
  
  sessionVersion Int @default(1)  // NEW FIELD
  
  // ... rest of model
}
```

**Run Migration:**

```bash
# Create migration
npx prisma migrate dev --name add_session_version

# Generate Prisma client
npx prisma generate
```

**Step 2: Update JWT Callback (1 hour)**

```typescript
// src/lib/auth/auth.config.ts
async jwt({ token, user, trigger }) {
  // On sign-in or manual update
  if (user?.id || trigger === "update") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user?.id || token.userId as string },
      select: {
        id: true,
        role: true,
        status: true,
        sessionVersion: true,  // NEW
        // ... other fields
      }
    })
    
    if (!dbUser) {
      throw new Error("USER_NOT_FOUND")
    }
    
    // Check session version - force re-auth if changed
    if (token.sessionVersion && token.sessionVersion !== dbUser.sessionVersion) {
      console.log(`[JWT] Session version mismatch for user ${dbUser.id}. Forcing re-auth.`)
      throw new Error("SESSION_EXPIRED")
    }
    
    // Update token with fresh data
    token.userId = dbUser.id
    token.role = dbUser.role
    token.status = dbUser.status
    token.sessionVersion = dbUser.sessionVersion  // NEW
    // ... other fields
  }
  
  return token
}
```

**Step 3: Increment sessionVersion on Security Events (1.5 hours)**

```typescript
// src/app/api/users/[id]/change-password/route.ts
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { id } = await params
  const { currentPassword, newPassword } = await req.json()
  
  // Verify current password
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  
  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid current password' }, { status: 401 })
  }
  
  // Hash new password
  const newHash = await bcrypt.hash(newPassword, 12)
  
  // Update password AND increment session version
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: newHash,
      sessionVersion: { increment: 1 },  // ← FORCE RE-AUTH
      mustChangePass: false,
    }
  })
  
  // Log security event
  await createAuditLog({
    userId: id,
    action: 'PASSWORD_CHANGED',
    details: 'User changed password, all sessions invalidated'
  })
  
  return NextResponse.json({ 
    message: 'Password updated. Please sign in again with your new password.' 
  })
}

// src/app/api/admin/users/[id]/update-role/route.ts
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  
  // Only super admins can change roles
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const { id } = await params
  const { role } = await req.json()
  
  // Update role AND increment session version
  const updated = await prisma.user.update({
    where: { id },
    data: {
      role,
      sessionVersion: { increment: 1 },  // ← FORCE RE-AUTH
    }
  })
  
  await createAuditLog({
    userId: session.user.id,
    action: 'ROLE_CHANGED',
    tableName: 'User',
    recordId: id,
    newValues: { role },
  })
  
  return NextResponse.json({ data: updated })
}

// src/app/api/admin/users/[id]/suspend/route.ts
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const { id } = await params
  
  // Suspend user AND force logout
  await prisma.user.update({
    where: { id },
    data: {
      status: 'SUSPENDED',
      sessionVersion: { increment: 1 },  // ← IMMEDIATE LOGOUT
    }
  })
  
  return NextResponse.json({ message: 'User suspended and logged out' })
}
```

**Step 4: Handle SESSION_EXPIRED Error (1 hour)**

Update your sign-in page to show appropriate message:

```typescript
// src/app/auth/signin/page.tsx
export default function SignInPage({ searchParams }: { searchParams: { error?: string } }) {
  const error = searchParams.error
  
  return (
    <div>
      {error === 'SessionExpired' && (
        <Alert variant="warning">
          Your session has expired due to a security change. Please sign in again.
        </Alert>
      )}
      
      {/* ... rest of sign-in form */}
    </div>
  )
}
```

**Testing Session Versioning:**

```typescript
// tests/auth/session-version.test.ts
describe('Session Versioning', () => {
  it('should invalidate session after password change', async () => {
    // 1. Sign in
    const { token } = await signIn('user@example.com', 'old-password')
    
    // 2. Verify can access protected route
    const response1 = await fetch('/api/projects', {
      headers: { Cookie: `next-auth.session-token=${token}` }
    })
    expect(response1.status).toBe(200)
    
    // 3. Change password (from another session)
    await changePassword('user@example.com', 'old-password', 'new-password')
    
    // 4. Old token should now be invalid
    const response2 = await fetch('/api/projects', {
      headers: { Cookie: `next-auth.session-token=${token}` }
    })
    expect(response2.status).toBe(401)
  })
  
  it('should invalidate session after role change', async () => {
    const { token } = await signInAsAdmin()
    
    // Admin can access /admin
    const response1 = await fetch('/admin/users', {
      headers: { Cookie: `next-auth.session-token=${token}` }
    })
    expect(response1.status).toBe(200)
    
    // Demote to regular user
    await updateUserRole(adminId, 'INSTITUTIONAL_INVESTOR')
    
    // Should no longer have admin access
    const response2 = await fetch('/admin/users', {
      headers: { Cookie: `next-auth.session-token=${token}` }
    })
    expect(response2.status).toBe(403)  // Forbidden
  })
})
```

---

### Day 8-9: API Response Sanitization (6 hours)

**Problem:** API responses include sensitive fields that shouldn't be exposed.

**Step 1: Create Select Field Helpers (2 hours)**

```typescript
// src/lib/select-fields.ts
import { Prisma, UserRole } from '@prisma/client'

/**
 * Get safe User fields to return in API responses
 * Excludes: passwordHash, twoFactorSecret, security fields
 */
export function getUserSelectFields(
  role: UserRole,
  isSelf: boolean = false
): Prisma.UserSelect {
  const baseFields: Prisma.UserSelect = {
    id: true,
    email: true,
    name: true,
    firstName: true,
    lastName: true,
    image: true,
    organization: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  }
  
  // Users can see their own additional fields
  if (isSelf) {
    return {
      ...baseFields,
      phone: true,
      timezone: true,
      emailNotifications: true,
      twoFactorEnabled: true,  // But NOT twoFactorSecret
      lastLoginAt: true,
      loginCount: true,
    }
  }
  
  // Admins can see security fields (but still not secrets)
  if (['SUPER_ADMIN', 'ADMIN'].includes(role)) {
    return {
      ...baseFields,
      lastLoginAt: true,
      lastLoginIp: true,
      loginCount: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      twoFactorEnabled: true,
      createdBy: true,
    }
  }
  
  return baseFields
}

/**
 * Get safe Project fields based on role
 */
export function getProjectSelectFields(role: UserRole): Prisma.ProjectSelect {
  const baseFields: Prisma.ProjectSelect = {
    id: true,
    code: true,
    title: true,
    description: true,
    country: true,
    region: true,
    sector: true,
    projectType: true,
    dealStage: true,
    status: true,
    totalCost: true,
    equityRequired: true,
    debtRequired: true,
    grantRequired: true,
    currency: true,
    expectedClose: true,
    ownerId: true,
    publishedAt: true,
    viewCount: true,
    createdAt: true,
    updatedAt: true,
  }
  
  // Internal staff see scoring and review fields
  if (['SUPER_ADMIN', 'ADMIN', 'ANALYST'].includes(role)) {
    return {
      ...baseFields,
      petfelScore: true,
      einScore: true,
      riskRating: true,
      esgRating: true,
      reviewerId: true,
      archived: true,
      archivedAt: true,
      archivedBy: true,
    }
  }
  
  return baseFields
}

/**
 * Get safe Document fields
 */
export function getDocumentSelectFields(role: UserRole): Prisma.DocumentSelect {
  const baseFields: Prisma.DocumentSelect = {
    id: true,
    name: true,
    type: true,
    mimeType: true,
    size: true,
    isPublic: true,
    published: true,
    publishedAt: true,
    version: true,
    summary: true,
    createdAt: true,
    updatedAt: true,
  }
  
  // Internal staff see additional fields
  if (['SUPER_ADMIN', 'ADMIN', 'ANALYST'].includes(role)) {
    return {
      ...baseFields,
      blobUrl: true,
      blobKey: true,
      isConfidential: true,
      uploaderId: true,
      summarizationStatus: true,
    }
  }
  
  return baseFields
}

/**
 * Get safe Investor fields
 */
export function getInvestorSelectFields(role: UserRole): Prisma.InvestorSelect {
  const baseFields: Prisma.InvestorSelect = {
    id: true,
    name: true,
    type: true,
    organizationType: true,
    countryOfOrigin: true,
    website: true,
    description: true,
    profileComplete: true,
  }
  
  // Internal staff see detailed investment criteria
  if (['SUPER_ADMIN', 'ADMIN', 'ANALYST'].includes(role)) {
    return {
      ...baseFields,
      email: true,
      phone: true,
      sectorFocus: true,
      countryFocus: true,
      stageFocus: true,
      minTicket: true,
      maxTicket: true,
      aum: true,
      targetIRR: true,
      instruments: true,
      esgConstraints: true,
    }
  }
  
  return baseFields
}
```

**Step 2: Apply to API Routes (4 hours)**

Update all GET endpoints to use select fields:

```typescript
// src/app/api/users/[id]/route.ts
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { id } = await params
  
  const user = await prisma.user.findUnique({
    where: { id },
    select: getUserSelectFields(
      session.user.role as UserRole,
      session.user.id === id  // isSelf
    ),
  })
  
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  return NextResponse.json({ data: user })
}

// src/app/api/projects/route.ts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  
  const userRole = session.user.role as UserRole
  const isInternal = ['SUPER_ADMIN', 'ADMIN', 'ANALYST'].includes(userRole)
  
  const where: Prisma.ProjectWhereInput = {
    ...(!isInternal ? { status: { in: ['ACTIVE', 'FUNDED', 'CLOSED'] } } : {}),
  }
  
  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      select: getProjectSelectFields(userRole),  // ← Use safe fields
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.count({ where }),
  ])
  
  return NextResponse.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  })
}
```

**Checklist - Apply to These Endpoints:**

- [ ] `GET /api/users` (list)
- [ ] `GET /api/users/[id]` (detail)
- [ ] `GET /api/projects` (list)
- [ ] `GET /api/projects/[id]` (detail)
- [ ] `GET /api/investors` (list)
- [ ] `GET /api/investors/[id]` (detail)
- [ ] `GET /api/documents` (list)
- [ ] `GET /api/documents/[id]` (detail)

---

### Day 10: Enhanced Logging (4 hours)

Already created enhanced logger in the audit document. Let's implement it:

**Step 1: Create Enhanced Logger (1 hour)**

```typescript
// src/lib/logger.ts (REPLACE EXISTING)
import { captureException, captureMessage } from '@sentry/nextjs'

interface LogContext {
  userId?: string
  email?: string
  ip?: string
  action?: string
  [key: string]: unknown
}

/**
 * Sensitive field patterns to redact
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'secret',
  'key',
  'hash',
  'twoFactorSecret',
  'accessToken',
  'refreshToken',
  'apiKey',
  'privateKey',
]

/**
 * Sanitize PII and sensitive data from log context
 */
function sanitizePII(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }
  
  if (typeof data !== 'object') {
    return data
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizePII)
  }
  
  const clean: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase()
    
    // Redact sensitive fields
    if (SENSITIVE_FIELDS.some(field => keyLower.includes(field))) {
      clean[key] = '[REDACTED]'
      continue
    }
    
    // Mask email addresses
    if (key === 'email' && typeof value === 'string') {
      clean[key] = maskEmail(value)
      continue
    }
    
    // Mask IP addresses (keep first 2 octets)
    if (key === 'ip' && typeof value === 'string') {
      clean[key] = maskIP(value)
      continue
    }
    
    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizePII(value)
      continue
    }
    
    clean[key] = value
  }
  
  return clean
}

/**
 * Mask email: john.doe@example.com → j***@example.com
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  
  return `${local[0]}***@${domain}`
}

/**
 * Mask IP: 192.168.1.100 → 192.168.***.***
 */
function maskIP(ip: string): string {
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***. ***`
  }
  return ip
}

/**
 * Structured logger with PII sanitization and Sentry integration
 */
export const logger = {
  info: (event: string, context?: LogContext) => {
    const sanitized = sanitizePII(context || {})
    const log = {
      level: 'info',
      event,
      ...sanitized,
      timestamp: new Date().toISOString(),
    }
    
    console.log(JSON.stringify(log))
    
    // Send to Sentry as breadcrumb
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      captureMessage(event, {
        level: 'info',
        extra: sanitized,
      })
    }
  },
  
  warn: (event: string, context?: LogContext) => {
    const sanitized = sanitizePII(context || {})
    const log = {
      level: 'warn',
      event,
      ...sanitized,
      timestamp: new Date().toISOString(),
    }
    
    console.warn(JSON.stringify(log))
    
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      captureMessage(event, {
        level: 'warning',
        extra: sanitized,
      })
    }
  },
  
  error: (event: string, error: unknown, context?: LogContext) => {
    const sanitized = sanitizePII(context || {})
    const log = {
      level: 'error',
      event,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : String(error),
      ...sanitized,
      timestamp: new Date().toISOString(),
    }
    
    console.error(JSON.stringify(log))
    
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      captureException(error, {
        tags: { event },
        extra: sanitized,
      })
    }
  },
  
  debug: (event: string, context?: LogContext) => {
    // Only log debug in development
    if (process.env.NODE_ENV !== 'development') {
      return
    }
    
    const sanitized = sanitizePII(context || {})
    const log = {
      level: 'debug',
      event,
      ...sanitized,
      timestamp: new Date().toISOString(),
    }
    
    console.debug(JSON.stringify(log))
  },
}
```

**Step 2: Replace console.log Calls (2 hours)**

Search and replace across the codebase:

```bash
# Find all console.log calls
grep -r "console\.log" src/ --include="*.ts" --include="*.tsx"

# Find all console.error calls
grep -r "console\.error" src/ --include="*.ts" --include="*.tsx"
```

Replace with logger:

```typescript
// BEFORE
console.log('[GET /api/projects] User: %s, Role: %s', email, role)

// AFTER
logger.info('api.projects.get', { 
  userId: session.user.id,
  role: session.user.role
})

// BEFORE
console.error('[POST /api/projects] Error:', error)

// AFTER
logger.error('api.projects.post', error, {
  userId: session.user.id,
  action: 'create_project'
})
```

**Step 3: Set Up Log Monitoring (1 hour)**

Configure Sentry alerts:

1. Go to Sentry dashboard
2. Create alert rule: "Error rate exceeds 10/minute"
3. Create alert rule: "Rate limit violations > 50/hour"
4. Set up Slack notifications

---

## Testing Strategy

### Automated Testing

**Run Before Every Deployment:**

```bash
#!/bin/bash
# pre-deploy-tests.sh

echo "🧪 Running pre-deployment tests..."

# 1. Lint
echo "1/5 Linting..."
npm run lint || exit 1

# 2. Type check
echo "2/5 Type checking..."
npx tsc --noEmit || exit 1

# 3. Unit tests
echo "3/5 Running unit tests..."
npm test -- --coverage || exit 1

# 4. E2E tests
echo "4/5 Running E2E tests..."
npm run test:e2e || exit 1

# 5. Security audit
echo "5/5 Running security audit..."
npm audit --audit-level=high || exit 1

echo "✅ All tests passed!"
```

### Manual Testing Checklist

```markdown
## Critical Path Testing

### Authentication Flow
- [ ] Can sign in with Azure AD
- [ ] Can sign in with credentials
- [ ] PENDING user redirected to pending page
- [ ] SUSPENDED user cannot access platform
- [ ] Password reset works

### Authorization
- [ ] Regular user blocked from /admin
- [ ] Admin can access /admin
- [ ] User can only edit own projects
- [ ] Admin can edit any project

### Rate Limiting
- [ ] AI generation rate limited (6th request fails)
- [ ] Chat rate limited (21st request fails)
- [ ] Contact form rate limited (6th request in 24h fails)
- [ ] Rate limit headers present

### Mass Assignment Protection
- [ ] User cannot change project status
- [ ] User cannot change reviewerId
- [ ] Admin can change status
- [ ] Non-owner cannot edit project

### API Response Sanitization
- [ ] passwordHash not in user response
- [ ] petfelScore only visible to internal users
- [ ] twoFactorSecret never returned

### Session Versioning
- [ ] Password change invalidates sessions
- [ ] Role change invalidates sessions
- [ ] Suspension immediately logs out user
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed by 2+ developers
- [ ] Security checklist completed
- [ ] Environment variables configured
- [ ] Database migrations tested

### Staging Deployment

```bash
# 1. Deploy to staging
vercel --env=preview

# 2. Run smoke tests
npm run test:smoke -- --env=staging

# 3. Manual testing on staging
# ... test critical flows

# 4. Monitor logs for errors
vercel logs --env=preview --follow
```

### Production Deployment

```bash
# 1. Deploy to production
vercel --prod

# 2. Monitor deployment
vercel logs --prod --follow

# 3. Check health endpoint
curl https://app.africa-infra.com/api/health

# 4. Monitor Sentry for errors
# ... check Sentry dashboard

# 5. Monitor rate limit violations
# ... check Upstash dashboard
```

### Post-Deployment

- [ ] Health check passing
- [ ] No Sentry errors
- [ ] Rate limiting working
- [ ] Middleware blocking correctly
- [ ] Session versioning working
- [ ] API responses sanitized

### Rollback Plan

If issues detected:

```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy specific commit
git checkout <previous-commit-hash>
vercel --prod
```

---

## Week 3-4: Medium Priority & Architecture

### Input Sanitization (Day 11 - 4 hours)

```bash
npm install isomorphic-dompurify
```

```typescript
// src/lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  })
}

export function sanitizePlainText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
}

// Apply to all schemas
const ProjectSchema = z.object({
  description: z.string().max(2000).transform(sanitizeHTML),
  notes: z.string().optional().transform(sanitizePlainText),
})
```

### GDPR Data Export (Day 12-13 - 12 hours)

```typescript
// src/app/api/users/[id]/export/route.ts
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { id } = await params
  
  // Only user themselves or admin can export
  if (session.user.id !== id && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Fetch ALL user data
  const userData = await prisma.user.findUnique({
    where: { id },
    include: {
      ownedProjects: true,
      documents: true,
      notifications: true,
      activityLogs: true,
      // ... all relations
    },
  })
  
  // Exclude sensitive fields
  const exportData = {
    ...userData,
    passwordHash: undefined,
    twoFactorSecret: undefined,
  }
  
  // Return as JSON
  return NextResponse.json(exportData, {
    headers: {
      'Content-Disposition': `attachment; filename="user-data-${id}.json"`,
    },
  })
}
```

---

## Success Metrics

Track these KPIs after deployment:

| Metric | Baseline | Target | Current |
|--------|----------|--------|---------|
| Failed login attempts | ❓ | < 100/day | TBD |
| Rate limit violations | ❓ | < 50/day | TBD |
| API error rate | ❓ | < 1% | TBD |
| Anthropic API cost | ❓ | < $500/mo | TBD |
| Unauthorized access attempts | ❓ | 0 | TBD |
| Security incidents | ❓ | 0 | TBD |

---

## Next Steps

After completing Week 1-2 critical and high priority fixes:

1. **Retrospective** - What went well? What can improve?
2. **Architecture Planning** - tRPC migration, Inngest queues
3. **Performance Optimization** - Read replicas, caching improvements
4. **Security Testing** - Penetration testing, OWASP ZAP scans
5. **Compliance** - SOC 2 readiness, GDPR full compliance

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-09  
**Next Update:** After Week 1 completion  

---

**STATUS:** 🚀 READY FOR IMPLEMENTATION
