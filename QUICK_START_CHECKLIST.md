# AIP Platform - Quick Start Checklist: Fix Critical Issues This Week

**Date:** 2026-09-09  
**Timeline:** 5 days  
**Goal:** Fix 3 critical security vulnerabilities  

---

## ✅ Day 1: Global Middleware (DONE)

### What We Did
- [x] Created `src/middleware.ts` with authentication protection
- [x] Block PENDING users from accessing platform
- [x] Block SUSPENDED/DEACTIVATED users
- [x] Enforce role-based access to /admin routes
- [x] Add CORS headers to API responses

### Testing Commands

```bash
# Test 1: Unauthenticated access
curl -v http://localhost:3005/dashboard
# Expected: 307 redirect to /auth/signin

# Test 2: API requires auth
curl -v http://localhost:3005/api/projects
# Expected: 401 Unauthorized
```

### Next Steps
1. ✅ Deploy to staging
2. ✅ Test with real users
3. ✅ Deploy to production

---

## 📋 Day 2: Rate Limiting Setup (6 hours)

### Step 1: Get Upstash Redis (30 min)

1. Go to https://console.upstash.com
2. Sign up (free tier: 10K requests/day)
3. Create new Redis database
4. Copy credentials

### Step 2: Add Environment Variables (10 min)

```bash
# Add to .env.local
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

```bash
# Add to Vercel
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
```

### Step 3: Update Rate Limit Library (1 hour)

**File:** `src/lib/rate-limit.ts`

**Changes:**
- ✅ Add tiered rate limiters (generate, chat, read, write, contact)
- ✅ Add `applyRateLimit()` helper function
- ✅ Add rate limit headers to responses

**See:** [Implementation Guide - Day 2](./IMPLEMENTATION_GUIDE_2026-09-09.md#day-2-rate-limiting-for-expensive-operations-6-hours)

### Step 4: Apply to Expensive Endpoints (4 hours)

**Critical Endpoints:**

- [ ] `/api/ein/[id]/generate/route.ts`
- [ ] `/api/pis/[id]/generate/route.ts`
- [ ] `/api/chat/route.ts`
- [ ] `/api/documents/[id]/summarize/route.ts` (if exists)
- [ ] `/api/contact-requests/route.ts`

**Pattern to Apply:**

```typescript
import { applyRateLimit, rateLimiters } from '@/lib/rate-limit'

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // ← ADD THIS
  const rateLimitResponse = await applyRateLimit(
    req,
    rateLimiters.generate,  // or .chat, .contact, etc.
    session.user.id
  )
  if (rateLimitResponse) return rateLimitResponse
  
  // ... existing logic
}
```

### Testing

```bash
# Test rate limit
for i in {1..10}; do
  curl -X POST http://localhost:3005/api/ein/test-id/generate \
    -H "Cookie: next-auth.session-token=$TOKEN"
  echo ""
done

# Expected: First 5 succeed (200), next 5 fail (429)
```

---

## 📋 Day 3-4: Mass Assignment Protection (8 hours)

### Step 1: Create Schema Definitions (2 hours)

Create `src/lib/schemas/project.ts`:

```typescript
import { z } from 'zod'
import { UserRole, ProjectStatus, ProjectSector } from '@prisma/client'

// Regular users can only modify safe fields
export const UserProjectPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  country: z.string().optional(),
  sector: z.nativeEnum(ProjectSector).optional(),
  totalCost: z.number().positive().optional(),
  // ... other safe fields
})

// Admins can modify restricted fields
export const AdminProjectPatchSchema = UserProjectPatchSchema.extend({
  status: z.nativeEnum(ProjectStatus).optional(),  // ← Restricted
  reviewerId: z.string().optional(),  // ← Restricted
  publishedAt: z.coerce.date().optional(),  // ← Restricted
})

export function getProjectPatchSchema(role: UserRole) {
  const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN]
  return adminRoles.includes(role) ? AdminProjectPatchSchema : UserProjectPatchSchema
}
```

### Step 2: Update PATCH Endpoints (2 hours each endpoint)

**File:** `src/app/api/projects/[id]/route.ts`

**Changes:**

```typescript
import { getProjectPatchSchema } from '@/lib/schemas/project'

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  
  // ← ADD: Fetch project and check ownership
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, ownerId: true }
  })
  
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  // ← ADD: Authorization check
  const isOwner = project.ownerId === session.user.id
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)
  
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // ← CHANGE: Use role-based schema
  const body = await req.json()
  const schema = getProjectPatchSchema(session.user.role as UserRole)
  const parsed = schema.safeParse(body)
  
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }
  
  // ← Update as before
  const updated = await prisma.project.update({
    where: { id },
    data: parsed.data,
  })
  
  return NextResponse.json({ data: updated })
}
```

### Step 3: Apply to All PATCH Endpoints (4 hours)

**Checklist:**

- [ ] `/api/projects/[id]/route.ts` (example above)
- [ ] `/api/users/[id]/route.ts`
- [ ] `/api/investors/[id]/route.ts`
- [ ] `/api/deal-rooms/[id]/route.ts`
- [ ] `/api/documents/[id]/route.ts`
- [ ] `/api/verifications/[id]/route.ts`
- [ ] `/api/ic-committees/[id]/route.ts`
- [ ] `/api/events/[id]/route.ts`

**Pattern:**
1. Create schema in `src/lib/schemas/[entity].ts`
2. Update PATCH endpoint
3. Test with user and admin accounts

### Testing

```bash
# Test 1: User tries to change status (should fail)
curl -X PATCH http://localhost:3005/api/projects/abc123 \
  -H "Cookie: next-auth.session-token=$USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}'
# Expected: 422 Validation failed

# Test 2: Admin changes status (should succeed)
curl -X PATCH http://localhost:3005/api/projects/abc123 \
  -H "Cookie: next-auth.session-token=$ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "APPROVED"}'
# Expected: 200 Success

# Test 3: User updates own project (safe fields)
curl -X PATCH http://localhost:3005/api/projects/abc123 \
  -H "Cookie: next-auth.session-token=$OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'
# Expected: 200 Success

# Test 4: User tries to update other's project (should fail)
curl -X PATCH http://localhost:3005/api/projects/abc123 \
  -H "Cookie: next-auth.session-token=$OTHER_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked"}'
# Expected: 403 Forbidden
```

---

## 📋 Day 5: Testing & Deployment (8 hours)

### Morning: Comprehensive Testing (4 hours)

#### 1. Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Aim for: >80% coverage on new code
```

#### 2. Integration Tests

```bash
# Start dev server
npm run dev

# Run E2E tests
npm run test:e2e
```

#### 3. Manual Testing Checklist

```markdown
## Critical Path Testing

### Authentication & Authorization
- [ ] Unauthenticated user redirected to signin
- [ ] PENDING user redirected to pending page
- [ ] SUSPENDED user cannot access platform
- [ ] Regular user blocked from /admin
- [ ] Admin can access /admin

### Rate Limiting
- [ ] 6th AI generation request returns 429
- [ ] Rate limit headers present in response
- [ ] Different users have separate rate limits

### Mass Assignment Protection
- [ ] Regular user CANNOT change project status
- [ ] Regular user CAN update project description
- [ ] Admin CAN change project status
- [ ] Non-owner CANNOT update others' projects

### Middleware
- [ ] All /api/* routes require authentication
- [ ] Security headers present on all responses
```

### Afternoon: Staging Deployment (2 hours)

```bash
# 1. Deploy to staging
vercel --env=preview

# 2. Get staging URL
vercel inspect <deployment-id>

# 3. Test on staging
./test-staging.sh

# 4. Monitor logs
vercel logs --env=preview --follow
```

### Evening: Production Deployment (2 hours)

```bash
# 1. Final checks
npm run lint
npm test
npm run test:e2e

# 2. Deploy to production
vercel --prod

# 3. Monitor deployment
vercel logs --prod --follow

# 4. Health check
curl https://app.africa-infra.com/api/health

# 5. Smoke test critical paths
./test-production.sh
```

### Post-Deployment Monitoring

**First 30 minutes:**
- Watch Sentry for errors
- Check Vercel logs for issues
- Test auth flow yourself
- Test rate limiting
- Verify middleware blocking

**First 24 hours:**
- Monitor error rates
- Check rate limit violations
- Review audit logs
- Watch for user complaints

### Rollback Plan

If critical issues detected:

```bash
# Option 1: Rollback via Vercel dashboard
# Go to Deployments → Find previous deployment → Promote to Production

# Option 2: Rollback via CLI
vercel rollback

# Option 3: Redeploy previous commit
git checkout <previous-commit>
vercel --prod
```

---

## 📊 Success Criteria

### Week 1 Goals

- [x] ✅ Global middleware protecting all routes
- [ ] ⏳ Rate limiting on all expensive operations
- [ ] ⏳ Mass assignment protection on all PATCH endpoints
- [ ] ⏳ Zero security incidents
- [ ] ⏳ All tests passing
- [ ] ⏳ Deployed to production

### Metrics to Track

| Metric | Target |
|--------|--------|
| API error rate | < 1% |
| Rate limit violations | < 50/day |
| Anthropic API cost | < $500/mo |
| Failed login attempts | < 100/day |
| Unauthorized access attempts | 0 |

---

## 🚨 If You Get Stuck

### Rate Limiting Issues

**Problem:** Redis connection errors  
**Solution:** Check environment variables are set correctly

```bash
# Verify in dev
echo $UPSTASH_REDIS_REST_URL

# Verify in Vercel
vercel env ls
```

**Problem:** Rate limit not working  
**Solution:** Check Upstash dashboard, verify requests are being tracked

### Mass Assignment Issues

**Problem:** Validation always fails  
**Solution:** Check Zod schema matches Prisma enums exactly

```typescript
// Make sure enum values match
z.nativeEnum(ProjectStatus)  // ✅
z.enum(['DRAFT', 'ACTIVE'])  // ❌ Might not match all values
```

**Problem:** User can still modify restricted fields  
**Solution:** Verify schema selection logic

```typescript
// Debug: Log which schema is being used
console.log('Using schema:', isAdmin ? 'AdminSchema' : 'UserSchema')
```

### Middleware Issues

**Problem:** Infinite redirect loop  
**Solution:** Check public routes are excluded in middleware config

```typescript
// Make sure auth routes are public
const publicRoutes = ['/auth/signin', '/auth/error', '/auth/pending']
```

**Problem:** Middleware not running  
**Solution:** Check matcher config includes your route

```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
}
```

---

## 📞 Need Help?

### Resources

- **Implementation Guide:** [IMPLEMENTATION_GUIDE_2026-09-09.md](./IMPLEMENTATION_GUIDE_2026-09-09.md)
- **Full Audit Report:** [BACKEND_SECURITY_AUDIT_BRAINSTORM_2026-09-09.md](./BACKEND_SECURITY_AUDIT_BRAINSTORM_2026-09-09.md)
- **Action Plan:** [SECURITY_ACTION_PLAN_2026-09-09.md](./SECURITY_ACTION_PLAN_2026-09-09.md)

### Quick Links

- [Upstash Console](https://console.upstash.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Sentry Dashboard](https://sentry.io)
- [NextAuth Middleware Docs](https://next-auth.js.org/configuration/nextjs#middleware)
- [Upstash Rate Limiting Docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)

---

## 🎯 Next Week Preview

After completing critical fixes, Week 2 focuses on:

1. **Session Version Control** - Force logout on password/role change
2. **API Response Sanitization** - Remove sensitive fields
3. **Enhanced Logging** - Structured logs with PII sanitization

**Estimated:** 14 hours total (2-3 days)

---

**Last Updated:** 2026-09-09  
**Status:** 🚀 IN PROGRESS  
**Next Review:** End of Day 5
