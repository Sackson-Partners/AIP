# AIP Platform - Priority Implementation List

**Date:** 2026-09-10  
**Total Tasks:** 27  
**Estimated Total Time:** 186 hours (~5 weeks for 1 developer)  
**Critical Path:** Tasks #1-5 (26 hours / 3-4 days)  

---

## 🎯 Priority Overview

| Priority | Tasks | Time | Impact | When |
|----------|-------|------|--------|------|
| 🔴 **CRITICAL** | #1-5 | 26h | Security + Performance | This Week |
| 🟠 **HIGH** | #6-10 | 30h | Architecture + Security | Week 2-3 |
| 🟡 **MEDIUM** | #11-19 | 72h | Quality + Scalability | Month 2 |
| 🟢 **LOW** | #20-21 | 8h | Compliance | Month 2-3 |
| 🚀 **STRATEGIC** | #22-27 | 82h | Innovation + Competitive Edge | Month 3+ |

---

## 🔴 CRITICAL PRIORITY (Week 1: 3-4 days)

### Task #1: Add Critical Database Indexes
**Time:** 2 hours  
**Impact:** 🔥 10-100x faster queries  
**Urgency:** Immediate - Performance bottleneck  

**What to do:**
```prisma
// Add to prisma/schema.prisma
model Project {
  @@index([status, createdAt])
  @@index([ownerId, status])
  @@index([country, sector])
}

model User {
  @@index([role, status])
  @@index([lastLoginAt])
}

model Document {
  @@index([projectId, published])
  @@index([uploaderId, createdAt])
}

model Notification {
  @@index([userId, read, createdAt])
}
```

**Commands:**
```bash
npx prisma migrate dev --name add_performance_indexes
npx prisma generate
```

---

### Task #2: Fix N+1 Query Problems
**Time:** 4 hours  
**Impact:** 🔥 80% faster page loads  
**Urgency:** Immediate - User experience  

**Files:** `src/app/dashboard/projects/page.tsx`

**Before (slow):**
```typescript
const projects = await projectsApi.list()
for (const p of projects) {
  const verification = await verificationsApi.get(p.id)  // N+1!
}
```

**After (fast):**
```typescript
const projects = await prisma.project.findMany({
  include: {
    verifications: true,
    milestones: true,
    documents: { where: { published: true } }
  }
})
```

---

### Task #3: Implement Pagination
**Time:** 6 hours  
**Impact:** 🔥 Prevents crashes at scale  
**Urgency:** Immediate - Scalability blocker  

**Files:**
- `src/app/api/investors/route.ts`
- `src/app/api/documents/route.ts`
- `src/app/api/notifications/route.ts`

**Pattern:**
```typescript
export async function GET(req: NextRequest) {
  const cursor = searchParams.get('cursor')
  const limit = 20
  
  const items = await prisma.investor.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' }
  })
  
  const hasMore = items.length > limit
  const results = hasMore ? items.slice(0, -1) : items
  
  return NextResponse.json({
    data: results,
    nextCursor: hasMore ? results[results.length - 1].id : null
  })
}
```

---

### Task #4: Set Up Rate Limiting
**Time:** 6 hours  
**Impact:** 🔥 $500-1000/month cost savings  
**Urgency:** Immediate - Cost control  
**Status:** ✅ Middleware created, need to apply  

**Steps:**
1. Sign up at https://console.upstash.com
2. Add env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
3. Update `src/lib/rate-limit.ts` (already planned)
4. Apply to endpoints:
   - `/api/ein/[id]/generate`
   - `/api/pis/[id]/generate`
   - `/api/chat`
   - `/api/contact-requests`

---

### Task #5: Mass Assignment Protection
**Time:** 8 hours  
**Impact:** 🔥 Prevents privilege escalation  
**Urgency:** Immediate - Security vulnerability  

**Files to create:**
- `src/lib/schemas/project.ts`
- `src/lib/schemas/user.ts`
- `src/lib/schemas/investor.ts`

**Apply to 8 endpoints:**
- `/api/projects/[id]`
- `/api/users/[id]`
- `/api/investors/[id]`
- `/api/deal-rooms/[id]`
- `/api/documents/[id]`
- `/api/verifications/[id]`
- `/api/ic-committees/[id]`
- `/api/events/[id]`

---

## 🟠 HIGH PRIORITY (Week 2-3: 30 hours)

### Task #6: Project State Machine
**Time:** 4 hours  
**Impact:** Data integrity + clear workflow  

**Create:** `src/lib/project-state-machine.ts`

Valid transitions:
```
DRAFT → SUBMITTED → UNDER_REVIEW → {APPROVED, REJECTED}
APPROVED → ACTIVE
ACTIVE → {FUNDED, ON_HOLD, CLOSED}
```

---

### Task #7: Convert to Server Components
**Time:** 12 hours  
**Impact:** 🔥 -400KB bundle, +300ms FCP  

**Convert these pages:**
1. `/dashboard/projects/page.tsx`
2. `/dashboard/analytics/page.tsx`
3. `/dashboard/profile/page.tsx`
4. `/dashboard/investors/page.tsx`
5. `/dashboard/verifications/page.tsx`

**Pattern:**
```typescript
// Server Component (default)
export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({ take: 20 })
  return <ProjectsClient initialProjects={projects} />
}

// Client Component (minimal interactivity)
'use client'
export default function ProjectsClient({ initialProjects }) {
  const [projects, setProjects] = useState(initialProjects)
  // Only interactive features
}
```

---

### Task #8: Session Versioning
**Time:** 4 hours  
**Impact:** Immediate logout on security changes  

**Steps:**
1. Add `sessionVersion Int @default(1)` to User model
2. Update JWT callback to validate version
3. Increment on password change, role change, suspension

---

### Task #9: API Response Sanitization
**Time:** 6 hours  
**Impact:** No sensitive data leaks  

**Create:** `src/lib/select-fields.ts`

**Pattern:**
```typescript
export function getUserSelectFields(role: UserRole, isSelf: boolean) {
  const baseFields = { id: true, email: true, name: true }
  
  if (isSelf) return { ...baseFields, phone: true, timezone: true }
  if (isAdmin(role)) return { ...baseFields, lastLoginAt: true }
  
  return baseFields
}
```

---

### Task #10: Enhanced Logging
**Time:** 4 hours  
**Impact:** Better debugging + GDPR compliance  

**Update:** `src/lib/logger.ts` with PII sanitization

**Replace all:**
```typescript
// BEFORE
console.log('[API] User:', email)

// AFTER
logger.info('api.request', { userId: id, endpoint: '/api/projects' })
```

---

## 🟡 MEDIUM PRIORITY (Month 2: 72 hours)

### Task #11: Test Coverage (20 hours)
Target: 80% coverage on critical paths

**Priority:**
1. Auth flows (sign-in, sign-out, token validation)
2. API routes (projects CRUD, users, deal-rooms)
3. Business logic (state machine, financial validation)

---

### Task #12: Duplicate Detection (6 hours)
Fuzzy match project names before creation

---

### Task #13: Financial Validation (2 hours)
Enforce: `equity + debt + grant ≤ totalCost`

---

### Task #14: Health Checks (2 hours)
Check DB, Redis, external APIs

---

### Task #15: Metrics & Observability (4 hours)
Track API latency, error rates, user actions

---

### Task #16: Bundle Optimization (4 hours)
Dynamic imports for MapView, Charts → -400KB

---

### Task #17: Standardize API Responses (8 hours)
Consistent format across 127 endpoints

---

### Task #18: Soft Delete Pattern (4 hours)
Cascade archiving to related entities

---

### Task #19: Input Sanitization (4 hours)
DOMPurify for XSS prevention

---

## 🟢 LOW PRIORITY (Month 2-3: 8 hours)

### Task #20: GDPR Data Export (4 hours)
`GET /api/users/[id]/export`

### Task #21: GDPR Data Deletion (4 hours)
`DELETE /api/users/[id]` with cascading

---

## 🚀 STRATEGIC INITIATIVES (Month 3+: 82 hours)

### Task #22: Evaluate tRPC Migration (16 hours)
**ROI:** End-to-end type safety, -60% type bugs

**Deliverables:**
1. Proof-of-concept with 5 endpoints
2. Developer experience comparison
3. Migration roadmap (12-16 weeks)

---

### Task #23: Feature Flag System (6 hours)
Safe deployments, A/B testing, gradual rollouts

---

### Task #24: OpenAPI Documentation (12 hours)
Interactive docs for 127 endpoints

---

### Task #25: 🤖 AI Investor Matching (20 hours)
**Business Value:** 10x faster deal sourcing

**Features:**
- Claude analyzes project + investor profiles
- Automatic ranking with reasoning
- Nightly batch matching
- Human-in-the-loop workflow

**Expected Output:**
```json
{
  "investorId": "inv-123",
  "matchScore": 92,
  "reasoning": "Strong sector fit (Energy), right ticket size ($10M), operates in target geography (West Africa), IRR expectations align (15%)"
}
```

---

### Task #26: 🔄 Real-Time Collaboration (16 hours)
**Business Value:** Google Docs-style UX

**Features:**
- See who's viewing project
- Live updates when someone edits
- Presence indicators
- Change notifications

---

### Task #27: ✅ Automated Compliance (12 hours)
**Business Value:** Reduced legal risk, faster approvals

**Checks:**
- Environmental Impact Assessment (EIA)
- Land acquisition regulations
- Local content requirements
- Financial disclosure
- Anti-corruption compliance

**Output:**
```json
{
  "overallScore": 85,
  "checks": [
    { "category": "Environmental", "status": "compliant" },
    { "category": "Financial", "status": "needs-review" }
  ],
  "risks": ["Missing EIA permit for Phase 2"]
}
```

---

## 📅 Recommended Timeline

### Week 1 (26 hours / 3-4 days)
**Focus:** Critical security + performance
- ✅ Monday: Task #1 (Indexes - 2h)
- ✅ Monday-Tuesday: Task #2 (N+1 - 4h)
- ✅ Tuesday: Task #4 (Rate Limiting - 6h)
- ✅ Wednesday-Thursday: Task #3 (Pagination - 6h) + Task #5 (Mass Assignment - 8h)

**Deliverables:**
- 10-100x faster queries
- API cost control
- No privilege escalation vulnerabilities
- Scalable for 10K+ records

---

### Week 2-3 (30 hours)
**Focus:** Architecture + security hardening
- Task #6: State machine (4h)
- Task #7: Server Components (12h)
- Task #8: Session versioning (4h)
- Task #9: API sanitization (6h)
- Task #10: Enhanced logging (4h)

**Deliverables:**
- -400KB bundle size
- Better data integrity
- Immediate security logout
- No sensitive data exposure

---

### Month 2 (72 hours)
**Focus:** Quality + operational excellence
- Tasks #11-19: Tests, validation, monitoring, optimization

**Deliverables:**
- 80% test coverage
- Full observability
- Optimized performance
- Production-ready

---

### Month 3+ (82 hours)
**Focus:** Innovation + competitive advantage
- Tasks #22-27: tRPC evaluation, AI features, real-time collaboration

**Deliverables:**
- AI investor matching (10x faster deals)
- Real-time collaboration (better UX)
- Automated compliance (reduced risk)

---

## 🎯 Success Metrics

### Week 1 Targets
- [ ] Query time: 2000ms → 20ms (100x improvement)
- [ ] Rate limit violations: 0
- [ ] Privilege escalation attempts: 0
- [ ] All tests passing

### Month 1 Targets
- [ ] Bundle size: 1.1GB → 700MB (-36%)
- [ ] First Contentful Paint: 4s → 2.5s (-38%)
- [ ] Lighthouse score: Unknown → 90+
- [ ] Test coverage: 1.5% → 80%

### Month 3 Targets
- [ ] AI matching: 100 projects matched
- [ ] Real-time collaboration: 50+ active users
- [ ] Compliance checks: 30 projects analyzed
- [ ] Developer velocity: +50%

---

## 💰 ROI Summary

### Time Investment
- Week 1: 26 hours (Critical)
- Month 1: 56 hours total
- Month 2: 128 hours total
- Month 3: 210 hours total (full roadmap)

### Financial Impact
- **Cost Savings:** $500-1000/month (rate limiting)
- **Security Risk:** Prevented breaches (priceless)
- **Developer Productivity:** +50% velocity → 2 months saved/year
- **Business Value:** 10x faster deal sourcing with AI matching

### Competitive Advantage
- AI matching: Unique feature in market
- Real-time collaboration: Modern UX expectation
- Automated compliance: Differentiator for legal/regulated sectors

---

## 🚦 Decision Framework

**Start immediately if:**
- Security vulnerability (Tasks #1, #4, #5)
- Performance bottleneck (Tasks #1, #2, #3)
- Cost exposure (Task #4)

**Start this month if:**
- User experience issue (Task #7)
- Data integrity concern (Task #6, #13)
- Monitoring gap (Tasks #14, #15)

**Plan for next quarter if:**
- Strategic advantage (Tasks #25, #26, #27)
- Developer experience (Tasks #22, #23, #24)
- Compliance requirement (Tasks #20, #21)

---

## 📞 Questions to Clarify

Before starting, consider:

1. **Team Size:** How many developers available?
   - 1 dev → 5 weeks for critical path
   - 2 devs → 2.5 weeks (parallel work)
   - 3+ devs → 1.5 weeks

2. **Budget:** Any constraints on external services?
   - Upstash Redis: $0-10/month (free tier OK)
   - Pusher: $49/month (for real-time)
   - OpenAI/Anthropic: $100-500/month (for AI features)

3. **Priorities:** Business vs. technical?
   - Revenue focus → AI matching first
   - Security focus → Critical tasks first
   - Growth focus → Performance + UX first

4. **Timeline:** Hard deadlines?
   - Demo in 1 week → Tasks #1, #2 only
   - Launch in 1 month → All critical + high priority
   - No rush → Follow roadmap as-is

---

## 📋 Next Steps

**Right Now:**
1. ✅ Review this priority list
2. ✅ Confirm timeline and team size
3. ✅ Start Task #1 (Database indexes - 2 hours)

**This Week:**
1. Complete Tasks #1-5 (critical path)
2. Deploy to staging after each task
3. Test thoroughly before production
4. Monitor metrics

**This Month:**
1. Complete Tasks #6-10 (high priority)
2. Begin Task #11 (test coverage)
3. Measure improvements (bundle size, query speed)
4. Celebrate wins with team! 🎉

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-10  
**Status:** 🚀 READY TO EXECUTE  

**Related Documents:**
- [Quick Start Checklist](./QUICK_START_CHECKLIST.md)
- [Implementation Guide](./IMPLEMENTATION_GUIDE_2026-09-09.md)
- [Security Action Plan](./SECURITY_ACTION_PLAN_2026-09-09.md)
- [Full-Stack Audit](./FULL_STACK_AUDIT_BRAINSTORM_2026-09-10.md)
