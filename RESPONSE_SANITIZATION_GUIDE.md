# API Response Sanitization - Role-Based Field Filtering

**Date:** 2026-09-11  
**Feature:** Task #9 - API Response Sanitization with Role-Based Fields  
**Impact:** 🔒 Prevents information disclosure by filtering sensitive fields based on user role

---

## Overview

Response sanitization ensures users only see data they're authorized to view by filtering API responses based on:
- **User role** (SUPER_ADMIN, ADMIN, ANALYST, external partners)
- **Context** (viewing own profile vs. viewing others)
- **Entity type** (User, Project, Investor)

This prevents information disclosure vulnerabilities where sensitive data leaks through API responses.

---

## Security Problem

### Before Sanitization ❌
```typescript
// GET /api/admin/users/123
return NextResponse.json({ user })  // Returns EVERYTHING including:
// - passwordHash
// - twoFactorSecret
// - resetToken
// - sessionVersion
// - internal notes
// - sensitive financial data
```

**Risk:** External partners could see internal fields, passwords could leak, audit trails exposed.

---

## Solution: Role-Based Field Filtering

### Implementation
```typescript
import { sanitizeUser } from '@/lib/response-sanitizer'

// GET /api/admin/users/123
const user = await prisma.user.findUnique({ where: { id } })

const isSelf = session.user.id === id
const sanitizedUser = sanitizeUser(
  user as Record<string, any>,
  session.user.role as UserRole,
  isSelf
)

return NextResponse.json({ user: sanitizedUser })  // Safe ✅
```

---

## Sanitization Rules

### 1. Always Hidden Fields (ALL USERS)
```typescript
const ALWAYS_HIDDEN_FIELDS = [
  'passwordHash',
  'twoFactorSecret',
  'resetToken',
  'resetTokenExpiry',
  'verificationToken',
  'apiKey',
  'secretKey',
  'privateKey',
]
```

**These fields are NEVER exposed in any API response, regardless of role.**

---

### 2. User Field Visibility

#### Viewing Own Profile (Self)
```typescript
// Fields visible when isSelf = true
const SELF_FIELDS = [
  'id', 'email', 'name', 'firstName', 'lastName', 'image', 'phone',
  'jobTitle', 'organization', 'country', 'timezone', 'role', 'status',
  'emailNotifications', 'dashboardLayout', 'createdAt', 'lastLoginAt',
  'loginCount', 'twoFactorEnabled', 'mustChangePass',
]
```

**Users see their own sensitive data** (email notifications, login count, etc.)

---

#### Admin Viewing Other Users
```typescript
// Fields visible to SUPER_ADMIN, ADMIN, ANALYST when viewing others
const ADMIN_FIELDS = [
  'id', 'email', 'name', 'firstName', 'lastName', 'image', 'phone',
  'jobTitle', 'organization', 'country', 'timezone', 'role', 'status',
  'authProvider', 'createdAt', 'updatedAt', 'lastLoginAt', 'lastLoginIp',
  'loginCount', 'failedLoginAttempts', 'lockedUntil', 'emailVerified',
  'twoFactorEnabled', 'mustChangePass', 'createdBy', 'sessionVersion',
]
```

**Admins see security audit fields** (loginCount, failedLoginAttempts, sessionVersion)

---

#### Public Profile (External Users)
```typescript
// Fields visible to external partners viewing others
const PUBLIC_FIELDS = [
  'id', 'name', 'firstName', 'lastName', 'image', 'jobTitle', 'organization',
]
```

**External users only see basic contact info** (no email, no role, no status)

---

### 3. Project Field Visibility

#### Internal Users (Staff)
```typescript
// SUPER_ADMIN, ADMIN, ANALYST see ALL fields (except always-hidden)
if (isInternalRole(viewerRole)) {
  return project  // Full access ✅
}
```

---

#### External Partners
```typescript
// External partners only see published project fields
const EXTERNAL_PROJECT_FIELDS = [
  'id', 'code', 'title', 'description', 'country', 'region', 'sector',
  'projectType', 'dealStage', 'totalCost', 'equityRequired', 'debtRequired',
  'location', 'latitude', 'longitude', 'startDate', 'estimatedCompletionDate',
  'irr', 'paybackPeriod', 'esgRating', 'carbonFootprint', 'jobsCreated',
  'riskRating', 'createdAt', 'updatedAt',
]
```

**External partners do NOT see:**
- Internal notes (`strategicNotes`)
- Reviewer assignments (`reviewerId`)
- Audit fields (`createdBy`, `archivedById`)
- Draft status (filtered at query level)

---

### 4. Investor Field Visibility

#### Own Profile
```typescript
// Users viewing their own investor profile see everything
if (isOwn) {
  return investor  // Full access ✅
}
```

---

#### Internal Staff
```typescript
// SUPER_ADMIN, ADMIN, ANALYST see most fields
const INTERNAL_INVESTOR_FIELDS = [
  'id', 'name', 'email', 'phone', 'type', 'status', 'organizationType',
  'countryOfOrigin', 'sectorFocus', 'countryFocus', 'stageFocus',
  'instruments', 'minTicket', 'maxTicket', 'aum', 'targetIRR',
  'esgConstraints', 'description', 'website', 'verified', 'verifiedAt',
  'profileComplete', 'createdAt', 'updatedAt',
]
```

---

#### External Users
```typescript
// External users see limited public info
const EXTERNAL_INVESTOR_FIELDS = [
  'id', 'name', 'organizationType', 'countryOfOrigin', 'sectorFocus',
  'countryFocus', 'stageFocus', 'description', 'website',
]
```

**External users do NOT see:**
- Email/phone (contact info)
- Financial data (AUM, ticket sizes)
- Verification status

---

## Applied Endpoints

### User Endpoints ✅

#### GET /api/admin/users/[id]
```typescript
const user = await prisma.user.findUnique({ where: { id }, include: userInclude })
const isSelf = session.user.id === id
const sanitizedUser = sanitizeUser(user, session.user.role, isSelf)
return NextResponse.json({ user: sanitizedUser })
```

#### PATCH /api/admin/users/[id]
```typescript
const updated = await prisma.user.update({ where: { id }, data: userUpdate })
const sanitizedUser = sanitizeUser(updated, session.user.role, isSelf)
return NextResponse.json({ user: sanitizedUser })
```

#### GET /api/admin/users (List)
```typescript
const users = await prisma.user.findMany({ where, skip, take })
const sanitizedUsers = sanitizeList(users, (user) => 
  sanitizeUser(user, session.user.role, user.id === session.user.id)
)
return NextResponse.json({ users: sanitizedUsers })
```

#### POST /api/admin/users (Create)
```typescript
const user = await prisma.user.create({ data })
const sanitizedUser = sanitizeUser(user, session.user.role, false)
return NextResponse.json({ user: sanitizedUser }, { status: 201 })
```

---

### Project Endpoints ✅

#### GET /api/projects/[id]
```typescript
const project = await prisma.project.findUnique({ where: { id } })
const sanitizedProject = sanitizeProject(project, session.user.role)
return NextResponse.json({ data: sanitizedProject })
```

#### PATCH /api/projects/[id]
```typescript
const updated = await prisma.project.update({ where: { id }, data })
const sanitizedProject = sanitizeProject(updated, session.user.role)
return NextResponse.json({ data: sanitizedProject })
```

#### GET /api/projects (List)
```typescript
const projects = await prisma.project.findMany({ where, skip, take })
const sanitizedData = sanitizeList(projects, (project) => 
  sanitizeProject(project, session.user.role)
)
return NextResponse.json({ data: sanitizedData })
```

#### POST /api/projects (Create)
```typescript
const project = await prisma.project.create({ data })
const sanitizedProject = sanitizeProject(project, session.user.role)
return NextResponse.json({ data: sanitizedProject }, { status: 201 })
```

---

### Investor Endpoints ✅

#### GET /api/investors/[id]
```typescript
const investor = await prisma.investor.findUnique({ where: { id } })
const isOwn = investor.userId === session.user.id
const sanitizedInvestor = sanitizeInvestor(investor, session.user.role, isOwn)
return NextResponse.json({ data: sanitizedInvestor })
```

#### PATCH /api/investors/[id]
```typescript
const updated = await prisma.investor.update({ where: { id }, data })
const sanitizedInvestor = sanitizeInvestor(updated, session.user.role, isOwn)
return NextResponse.json({ data: sanitizedInvestor })
```

#### GET /api/investors (List)
```typescript
const investors = await prisma.investor.findMany({ where, skip, take })
const sanitizedData = sanitizeList(investors, (investor) => 
  sanitizeInvestor(investor, session.user.role, investor.userId === session.user.id)
)
return NextResponse.json({ data: sanitizedData })
```

#### POST /api/investors (Create)
```typescript
const investor = await prisma.investor.create({ data })
const isOwn = investor.userId === session.user.id
const sanitizedInvestor = sanitizeInvestor(investor, session.user.role, isOwn)
return NextResponse.json({ data: sanitizedInvestor }, { status: 201 })
```

---

## Testing

### Test 1: Admin Viewing Self vs. Others
```bash
# Admin viewing own profile
curl http://localhost:3005/api/admin/users/admin-id \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: Full self fields (emailNotifications, dashboardLayout, etc.)

# Admin viewing another user
curl http://localhost:3005/api/admin/users/other-user-id \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: Admin fields (sessionVersion, lastLoginIp, failedLoginAttempts)
# NOT: emailNotifications, dashboardLayout (self-only)
```

---

### Test 2: External Partner Viewing Projects
```bash
# External partner (INVESTOR role)
curl http://localhost:3005/api/projects/project-id \
  -H "Authorization: Bearer $INVESTOR_TOKEN"

# Expected: Published fields only
# - title, description, country, sector, totalCost, irr, esgRating ✅
# NOT:
# - strategicNotes, reviewerId, createdBy ❌
```

---

### Test 3: Investor Viewing Own vs. Other Profiles
```bash
# Investor viewing own profile
curl http://localhost:3005/api/investors/own-investor-id \
  -H "Authorization: Bearer $INVESTOR_TOKEN"

# Expected: Full profile (email, phone, AUM, ticket sizes)

# Investor viewing another investor
curl http://localhost:3005/api/investors/other-investor-id \
  -H "Authorization: Bearer $INVESTOR_TOKEN"

# Expected: Public fields only (name, sector focus, description)
# NOT: email, phone, AUM, targetIRR ❌
```

---

### Test 4: Sensitive Fields Never Exposed
```bash
# Try to access as SUPER_ADMIN (highest role)
curl http://localhost:3005/api/admin/users/user-id \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN"

# Expected: Admin fields ✅
# NOT: passwordHash, twoFactorSecret, resetToken ❌ (always hidden)
```

---

## Benefits

### 1. Prevents Information Disclosure ✅
- External partners cannot see internal project notes
- Users cannot see other users' email addresses
- No password hashes or secrets in responses

---

### 2. Context-Aware Visibility ✅
- Users see more of their own data (self context)
- Admins see audit fields when viewing others
- External users see minimal public info

---

### 3. Type-Safe and Reusable ✅
```typescript
// Single sanitizer function per entity type
sanitizeUser(user: Record<string, any>, viewerRole: UserRole, isSelf: boolean)
sanitizeProject(project: Record<string, any>, viewerRole: UserRole)
sanitizeInvestor(investor: Record<string, any>, viewerRole: UserRole, isOwn: boolean)

// List helper
sanitizeList<T>(items: T[], sanitizer: (item: T) => Record<string, any>)
```

---

### 4. Centralized Field Definitions ✅
- All visibility rules in one file: `src/lib/response-sanitizer.ts`
- Easy to audit and update
- Consistent across all endpoints

---

## Comparison with Alternatives

### Alternative 1: Manual Field Selection
```typescript
// ❌ Error-prone, inconsistent
const user = await prisma.user.findUnique({
  select: { id: true, email: true, name: true }  // Forgot to check role!
})
```

**Problem:** Easy to forget fields, duplicate logic across endpoints

---

### Alternative 2: GraphQL Field-Level Permissions
```typescript
// ❌ Requires GraphQL adoption
// ❌ Complex middleware setup
// ❌ Not RESTful
```

**Problem:** Large migration, different paradigm

---

### Alternative 3: Post-Query Manual Deletion
```typescript
// ❌ Easy to miss fields
const user = await prisma.user.findUnique({ where: { id } })
delete user.passwordHash
delete user.twoFactorSecret  // Oops, forgot resetToken!
return user
```

**Problem:** Fragile, no type safety, easy to miss fields

---

### Our Solution ✅
- **Centralized rules** in one sanitizer file
- **Role-based visibility** with context awareness
- **Type-safe** with TypeScript
- **Reusable** across all endpoints
- **Whitelist approach** (explicit allowed fields, not blacklist)

---

## Edge Cases

### Case 1: Admin Viewing Own Profile
```typescript
const isSelf = session.user.id === id  // true
sanitizeUser(user, 'SUPER_ADMIN', true)
// Uses SELF_FIELDS (not ADMIN_FIELDS)
// Admin sees their own emailNotifications, dashboardLayout ✅
```

---

### Case 2: New Field Added to Database
```
1. Developer adds `user.socialSecurityNumber` field
2. Sanitizer does NOT include it in any visibility list
3. Field is automatically excluded from responses ✅ (whitelist approach)
```

**Whitelist approach = secure by default**

---

### Case 3: External Partner Creates Project
```typescript
// External user (role: INVESTOR) creates project
const project = await prisma.project.create({ data, ownerId: session.user.id })

// Sanitize for INVESTOR role
const sanitized = sanitizeProject(project, 'INVESTOR')

// Response includes: title, description, country, sector ✅
// Response excludes: strategicNotes, reviewerId ❌
```

---

### Case 4: Nested Relations
```typescript
// Project includes nested owner (User)
const project = await prisma.project.findUnique({
  where: { id },
  include: { owner: true }
})

// Sanitize nested user relation
const sanitized = sanitizeNested(project, viewerRole, {
  userFields: ['owner']  // Sanitize project.owner
})
```

**Helper function `sanitizeNested()` handles nested objects**

---

## Performance Considerations

### Overhead
- **Minimal:** Object property filtering in memory
- **Fast:** No database queries, just JavaScript object operations
- **Cacheable:** Sanitized responses can be cached in Redis

---

### Optimization
```typescript
// Cache sanitized responses (not raw data)
const cacheKey = `projects:detail:${id}:role:${userRole}`
const cached = await getCached<Record<string, any>>(cacheKey)
if (cached) {
  return NextResponse.json({ data: cached })  // Already sanitized ✅
}

// Fetch and sanitize
const project = await prisma.project.findUnique({ where: { id } })
const sanitized = sanitizeProject(project, userRole)

// Cache sanitized result
await setCached(cacheKey, sanitized, CacheTTL.MEDIUM)
```

**Cache key includes role** so different roles get different cached responses

---

## Future Enhancements

### Phase 2: Field-Level Permissions
```typescript
// More granular control
const USER_FIELD_PERMISSIONS = {
  email: { read: ['SELF', 'SUPER_ADMIN', 'ADMIN'] },
  sessionVersion: { read: ['SUPER_ADMIN'], write: ['SYSTEM'] },
  dashboardLayout: { read: ['SELF'], write: ['SELF'] },
}
```

---

### Phase 3: Audit Sanitization Access
```typescript
// Log when sensitive fields are accessed
await createAuditLog({
  action: 'VIEW_SENSITIVE_DATA',
  details: { field: 'sessionVersion', targetUserId: id },
})
```

---

### Phase 4: Dynamic Sanitization Rules
```typescript
// Load rules from database
const rules = await prisma.sanitizationRule.findMany({ where: { entity: 'User' } })
sanitizeUser(user, viewerRole, isSelf, { customRules: rules })
```

---

## Summary

Response sanitization provides **secure, role-based field filtering** for all API responses.

**Key Benefits:**
- ✅ Prevents information disclosure
- ✅ Context-aware (self vs. others)
- ✅ Entity-specific rules (User, Project, Investor)
- ✅ Always hides sensitive fields (passwords, secrets)
- ✅ Whitelist approach (secure by default)
- ✅ Centralized and reusable

**Applied To:**
- ✅ User endpoints (GET, PATCH, POST, list)
- ✅ Project endpoints (GET, PATCH, POST, list)
- ✅ Investor endpoints (GET, PATCH, POST, list)

**Security Impact:**
- 🔒 External partners cannot see internal fields
- 🔒 Users cannot see other users' private data
- 🔒 No password hashes or secrets in responses
- 🔒 Audit trails protected from external view

---

**Last Updated:** 2026-09-11  
**Status:** ✅ COMPLETED  
**Task:** #9 - API Response Sanitization with Role-Based Fields
