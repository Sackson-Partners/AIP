# Session Versioning - Immediate Logout on Security Changes

**Date:** 2026-09-11  
**Feature:** Task #8 - Session Versioning for Immediate Logout  
**Impact:** 🔥 Immediate session invalidation on password/role/status changes

---

## Overview

Session versioning forces users to re-authenticate immediately when security-relevant changes occur to their account. This prevents compromised sessions from remaining active after password changes, role modifications, or account suspensions.

---

## How It Works

### Database Field
```prisma
model User {
  sessionVersion Int @default(1)  // Incremented on security changes
}
```

### JWT Token
```typescript
// JWT includes sessionVersion
token.sessionVersion = user.sessionVersion  // e.g., 3
```

### Middleware Validation
```typescript
// On every request, check if token version matches database
if (token.sessionVersion !== dbUser.sessionVersion) {
  // Force logout - redirect to signin
  return redirect("/auth/signin?error=SessionExpired")
}
```

---

## When Sessions Are Invalidated

### 1. Password Changes ✅
**Trigger:** Admin resets user password  
**Endpoint:** `POST /api/admin/users/[id]/reset-password`

```typescript
await prisma.user.update({
  where: { id },
  data: { passwordHash: newHash },
})

// Increment session version → all sessions invalidated
await invalidateAllSessions(
  userId,
  SessionInvalidationReason.PASSWORD_CHANGE,
  adminId
)
```

**Result:** User is immediately logged out on next request

---

### 2. Role Changes ✅
**Trigger:** Admin changes user's role  
**Endpoint:** `PATCH /api/admin/users/[id]`

```typescript
// Admin changes role from USER to ADMIN
await prisma.user.update({
  where: { id },
  data: { role: 'ADMIN' },
})

// Invalidate sessions to force re-authentication with new permissions
await invalidateAllSessions(
  userId,
  SessionInvalidationReason.ROLE_CHANGE,
  adminId
)
```

**Why:** Ensures user's active sessions don't have stale permissions

---

### 3. Account Suspension/Deactivation ✅
**Trigger:** Admin suspends or deactivates user  
**Endpoint:** `PATCH /api/admin/users/[id]`

```typescript
// Admin suspends user
await prisma.user.update({
  where: { id },
  data: { status: 'SUSPENDED' },
})

// Immediately invalidate all sessions
await invalidateAllSessions(
  userId,
  SessionInvalidationReason.SUSPENSION,
  adminId
)
```

**Result:** User cannot access platform until reactivated

---

## Implementation Details

### 1. Schema Update
```prisma
model User {
  // ... existing fields
  sessionVersion Int @default(1)  // NEW FIELD
}
```

**Migration Command:**
```bash
npx prisma migrate dev --name add_session_versioning
```

---

### 2. JWT Callback Update
**File:** `src/lib/auth/auth.config.ts`

```typescript
async jwt({ token, user }) {
  if (user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        sessionVersion: true,  // Include in JWT
        // ... other fields
      },
    })
    
    if (dbUser) {
      token.sessionVersion = dbUser.sessionVersion
    }
  }
  
  return token
}
```

---

### 3. Middleware Validation
**File:** `src/middleware.ts`

```typescript
async function middleware(req) {
  const token = req.nextauth.token
  
  // Validate session version
  if (token?.userId && token?.sessionVersion !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      select: { sessionVersion: true },
    })
    
    if (user && user.sessionVersion !== token.sessionVersion) {
      // Force logout
      return redirect("/auth/signin?error=SessionExpired")
    }
  }
  
  // ... rest of middleware
}
```

---

### 4. Helper Functions
**File:** `src/lib/session-utils.ts`

```typescript
// Increment session version
export async function incrementSessionVersion(userId: string): Promise<void>

// Invalidate all sessions with audit trail
export async function invalidateAllSessions(
  userId: string,
  reason: SessionInvalidationReason,
  performedBy?: string
): Promise<void>

// Get current session version
export async function getSessionVersion(userId: string): Promise<number | null>

// Reset to version 1 (testing/admin)
export async function resetSessionVersion(userId: string): Promise<void>
```

---

## User Experience

### Scenario 1: Password Reset
```
1. User is actively using the platform (logged in)
2. Admin resets user's password
3. Session version incremented: 1 → 2
4. User clicks anything (triggers middleware)
5. Middleware sees: Token version = 1, DB version = 2
6. User redirected to: /auth/signin?error=SessionExpired
7. Message: "Your session has expired. Please sign in again."
```

### Scenario 2: Role Change
```
1. User has role: ANALYST (sessionVersion: 3)
2. Admin promotes to: ADMIN
3. Session version incremented: 3 → 4
4. User refreshes page
5. Middleware invalidates token
6. User must sign in again with new ADMIN role
```

### Scenario 3: Suspension
```
1. User is active in multiple devices
2. Admin suspends account
3. Session version incremented: 5 → 6
4. All devices check middleware on next request
5. All sessions immediately invalidated
6. User sees: "Your account has been suspended"
```

---

## Testing

### Test 1: Password Change Invalidates Sessions
```bash
# 1. User signs in
curl -X POST http://localhost:3005/api/auth/signin \
  -d '{"email":"user@test.com","password":"old"}' \
  -c cookies.txt

# 2. Admin resets password (increments sessionVersion)
curl -X POST http://localhost:3005/api/admin/users/user-id/reset-password \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. User tries to access protected route with old session
curl http://localhost:3005/dashboard \
  -b cookies.txt

# Expected: 307 Redirect to /auth/signin?error=SessionExpired
```

### Test 2: Role Change Forces Re-auth
```bash
# 1. User has active session with role: ANALYST
# sessionVersion: 2

# 2. Admin changes role to ADMIN
curl -X PATCH http://localhost:3005/api/admin/users/user-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"role":"ADMIN"}'
# This increments sessionVersion to 3

# 3. User tries to access with old token (sessionVersion: 2)
curl http://localhost:3005/dashboard \
  -H "Authorization: Bearer $OLD_TOKEN"

# Expected: Redirect to signin
```

### Test 3: Suspension Immediately Blocks Access
```bash
# 1. User has 3 active sessions (browser, mobile, tablet)
# All have sessionVersion: 4

# 2. Admin suspends user
curl -X PATCH http://localhost:3005/api/admin/users/user-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status":"SUSPENDED"}'
# Increments sessionVersion to 5

# 3. All 3 devices try to access
# Expected: All immediately redirected to error page
```

---

## Advantages

### 1. Immediate Invalidation ✅
- No delay waiting for token expiration
- User is logged out on **next request**
- Works across all devices simultaneously

### 2. Secure by Default ✅
- Password change → logout everywhere
- Role change → re-auth required
- Suspension → instant blocking

### 3. Audit Trail ✅
```typescript
await invalidateAllSessions(
  userId,
  SessionInvalidationReason.PASSWORD_CHANGE,
  performedBy: adminId
)
```

Logs show:
- **What:** Session invalidation
- **Why:** PASSWORD_CHANGE / ROLE_CHANGE / SUSPENSION
- **Who:** Admin who performed the action
- **When:** Timestamp

---

## Performance Considerations

### Database Query on Every Request
**Concern:** Middleware queries database to check sessionVersion

**Mitigation:**
1. **Fast Query:** Single indexed lookup by primary key
   ```sql
   SELECT sessionVersion FROM "User" WHERE id = $1;
   ```
   
2. **Caching (Optional):**
   ```typescript
   // Cache sessionVersion in Redis for 1 minute
   const cached = await redis.get(`session:version:${userId}`)
   if (cached) return parseInt(cached)
   
   const user = await prisma.user.findUnique(...)
   await redis.setex(`session:version:${userId}`, 60, user.sessionVersion)
   ```

3. **Connection Pooling:** Prisma connection pool handles concurrent requests efficiently

---

## Edge Cases

### Case 1: Multiple Admins Change Same User
```
Admin A: Changes role at 10:00:01 → sessionVersion: 5 → 6
Admin B: Changes status at 10:00:02 → sessionVersion: 6 → 7
Result: Both changes trigger invalidation, final version is 7 ✅
```

### Case 2: User Changes Own Password
```
// If user changes their own password
await incrementSessionVersion(session.user.id)
// User is logged out and must sign in with new password ✅
```

### Case 3: Token Refresh During Version Increment
```
Time: 10:00:00 - User's token has sessionVersion: 3
Time: 10:00:01 - Admin resets password → version: 4
Time: 10:00:02 - User's request hits middleware
Middleware sees: token.sessionVersion (3) !== db.sessionVersion (4)
Result: Logout ✅
```

---

## Monitoring

### Metrics to Track
```typescript
// Log session invalidations
console.log(`[Session] Invalidated all sessions for user ${userId}. Reason: ${reason}`)

// Track in metrics
metrics.increment('session.invalidation', {
  reason: 'PASSWORD_CHANGE',
  performedBy: 'ADMIN'
})
```

### Queries
```sql
-- How many users have been logged out today?
SELECT COUNT(DISTINCT "userId") 
FROM "AuditLog" 
WHERE "action" = 'SESSION_INVALIDATED' 
  AND "createdAt" > CURRENT_DATE;

-- What are the most common invalidation reasons?
SELECT "metadata"->>'reason' as reason, COUNT(*) 
FROM "AuditLog" 
WHERE "action" = 'SESSION_INVALIDATED'
GROUP BY reason;
```

---

## Future Enhancements

### Phase 2: Selective Session Invalidation
```typescript
// Instead of invalidating ALL sessions, keep current device
await invalidateOtherSessions(userId, exceptSessionId)
```

### Phase 3: Session Management UI
```
User Dashboard:
- View all active sessions (device, location, last active)
- Manually revoke specific sessions
- "Log out all other devices" button
```

### Phase 4: Suspicious Activity Detection
```typescript
// Auto-invalidate on suspicious patterns
if (loginFromNewCountry && highRiskActivity) {
  await invalidateAllSessions(userId, SessionInvalidationReason.SECURITY_INCIDENT)
  await sendSecurityAlert(userId)
}
```

---

## Comparison with Alternatives

### Alternative 1: Short Token Expiry
**Approach:** Set JWT expiry to 5 minutes  
**Problem:** Frequent re-logins annoy users  
**Session Versioning:** ✅ Long expiry (24h) + invalidate only when needed

### Alternative 2: Token Blacklist
**Approach:** Maintain list of revoked tokens in Redis  
**Problem:** Must store every token, complex cleanup  
**Session Versioning:** ✅ Single integer per user, no cleanup needed

### Alternative 3: Database Session Store
**Approach:** Store all sessions in database, check on every request  
**Problem:** High database load  
**Session Versioning:** ✅ Single int comparison, minimal overhead

---

## Summary

Session versioning provides **immediate, secure, and efficient** session invalidation when security-relevant changes occur. 

**Key Benefits:**
- ✅ Immediate logout across all devices
- ✅ Simple implementation (one integer field)
- ✅ Low performance overhead
- ✅ Audit trail built-in
- ✅ Works with any authentication system

**Use Cases:**
- Password changes
- Role/permission changes
- Account suspension/deactivation
- Security incidents
- Admin force logout

---

**Last Updated:** 2026-09-11  
**Status:** ✅ IMPLEMENTED  
**Task:** #8 - Session Versioning
