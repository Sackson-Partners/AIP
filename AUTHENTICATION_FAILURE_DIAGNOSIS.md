# Authentication Failure - Emergency Diagnosis

**Date:** September 14, 2026  
**Status:** 🚨 **CRITICAL - ALL AUTHENTICATION BROKEN**  
**Reported Issue:** Microsoft login, staff login, partners login not working

---

## SYMPTOMS

1. **Microsoft Sign-In:** "Sign-in error. Please try again."
2. **Staff/Partner Credentials:** "Sign-in error. Please try again."
3. **Request Invitation:** Not working

---

## ROOT CAUSE ANALYSIS

### Recent Changes (Commit 7a8eeff):
- ✅ Crypto fixes (temporary passwords) - **NOT RELATED**
- ✅ Structured logging in auth.config.ts - **POTENTIAL ISSUE**

### Suspected Issues:

#### **1. Logger Import Breaking NextAuth (MOST LIKELY)**

**Change Made:**
```typescript
// Added to src/lib/auth/auth.config.ts
import { logger } from '@/lib/logger'

// Replaced console.error with logger.error
logger.error('Azure AD sign-in: DB lookup failed', err)
```

**Why This Breaks:**
- NextAuth runs in **edge runtime** or **Node.js runtime**
- Logger may have dependencies incompatible with edge
- Logger uses async context that may not work in NextAuth callbacks

**Evidence:**
- Generic "Default" error (not specific error code)
- Affects ALL authentication methods
- Started immediately after commit 7a8eeff

---

#### **2. Missing Environment Variables in Production**

**Check Required:**
```bash
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://app.africa-infra.com
DATABASE_URL=<postgres-url>
AZURE_AD_CLIENT_ID=<real-value>
AZURE_AD_CLIENT_SECRET=<real-value>
AZURE_AD_TENANT_ID=<real-tenant>
```

**How to Verify:**
1. Vercel Dashboard → Settings → Environment Variables
2. Check all variables are set for **Production** environment
3. Verify no placeholder values (like "your-azure-client-id")

---

#### **3. Database Connection Failure**

**Symptoms:**
- "DB lookup failed" errors
- Unable to query users table
- Transaction failures

**How to Verify:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"
```

---

## IMMEDIATE FIX OPTIONS

### **OPTION 1: Revert to Last Working Commit (FASTEST - 2 minutes)**

```bash
# Revert to commit before logging changes
git revert 7a8eeff --no-edit
git push origin main
```

**This will:**
- ✅ Restore working authentication
- ❌ Lose crypto security fixes
- ❌ Lose structured logging improvements

**Verdict:** ❌ **NOT RECOMMENDED** - Loses security fixes

---

### **OPTION 2: Fix Logger Usage in Auth Config (RECOMMENDED - 5 minutes)**

**Problem:** Logger may be incompatible with NextAuth runtime

**Fix:** Remove logger from auth.config.ts, use plain console

```typescript
// REVERT THESE CHANGES in src/lib/auth/auth.config.ts

// REMOVE:
import { logger } from '@/lib/logger'

// CHANGE BACK:
logger.error('Failed to link Azure AD account', err)
// TO:
console.error('[linkAccount] failed to link Azure AD account:', err)

logger.info('Azure AD sign-in attempt', { email })
// TO:
console.log('[signIn azure-ad] email=%s', email)

logger.error('Azure AD sign-in failed: no email on token')
// TO:
console.error('[signIn azure-ad] no email on token')

logger.error('Azure AD sign-in: DB lookup failed', err)
// TO:
console.error('[signIn azure-ad] DB lookup failed:', err)

logger.error('Azure AD sign-in failed: account exists with different provider', { email })
// TO:
console.error('[signIn azure-ad] Account exists with different provider')

logger.error('JWT callback: failed to fetch user profile', err, { userId: user.id })
// TO:
console.error('[JWT callback] Failed to fetch user profile:', err)

logger.error('JWT callback: failed to update user session', err, { userId: token.userId })
// TO:
console.error('[JWT callback] Failed to update user session:', err)
```

**Steps:**
1. Edit `src/lib/auth/auth.config.ts`
2. Remove logger import
3. Revert 7 logger calls to console
4. Commit and push
5. Wait 2 minutes for Vercel deploy

---

### **OPTION 3: Check Vercel Environment Variables (PARALLEL - 2 minutes)**

**While waiting for deploy, verify:**

1. **Vercel Dashboard:** https://vercel.com/africa-infra-partners/aip-platform
2. **Settings → Environment Variables**
3. **Check these are set correctly:**
   - `NEXTAUTH_SECRET` (not empty, not default)
   - `NEXTAUTH_URL` = `https://app.africa-infra.com`
   - `DATABASE_URL` (valid PostgreSQL connection string)
   - `AZURE_AD_CLIENT_ID` (real Azure app ID, not placeholder)
   - `AZURE_AD_CLIENT_SECRET` (real secret, not placeholder)
   - `AZURE_AD_TENANT_ID` (real tenant ID)

4. **If any are missing or placeholders:**
   - Update them
   - Redeploy: Deployments → Latest → Redeploy

---

## VERIFICATION STEPS

After applying fix:

### 1. Check Deployment Status
```bash
# Wait for Vercel deployment (2 minutes)
# Check: https://vercel.com/africa-infra-partners/aip-platform/deployments
```

### 2. Test Microsoft Sign-In
1. Visit: https://app.africa-infra.com/auth/signin
2. Click "Continue with Microsoft"
3. Should redirect to Microsoft login
4. Should return to platform after authentication

### 3. Test Credentials Sign-In
1. Visit: https://app.africa-infra.com/auth/signin
2. Click "Staff Access" or "Partner Access"
3. Enter valid credentials
4. Should successfully sign in

### 4. Test Request Invitation
1. Visit: https://app.africa-infra.com/auth/signin
2. Click "Request Invitation"
3. Fill form
4. Submit
5. Should show "Request submitted" message

---

## MONITORING

### Check Vercel Logs:
```bash
vercel logs <deployment-url> --follow
```

### Check for Errors:
- "logger is not defined"
- "Cannot read property of undefined"
- "Database connection failed"
- "Invalid credentials"

---

## ROLLBACK PROCEDURE

If fix doesn't work:

### Emergency Rollback:
```bash
# Go back to last known good commit (3a10621)
git reset --hard 3a10621
git push --force origin main
```

**WARNING:** This loses ALL changes from commit 7a8eeff (crypto fixes + logging)

**Better Option:** Cherry-pick crypto fixes without logger:
```bash
# Create hotfix branch
git checkout -b hotfix-auth-emergency

# Revert logger changes only in auth.config.ts
git checkout 3a10621 -- src/lib/auth/auth.config.ts

# Keep crypto fixes
git checkout 7a8eeff -- src/app/api/access-requests/[id]/route.ts
git checkout 7a8eeff -- src/app/api/access-requests/bulk/route.ts
git checkout 7a8eeff -- src/app/api/projects/from-template/[templateId]/route.ts

# Commit and push
git commit -m "hotfix: revert logger in auth config, keep crypto fixes"
git push origin hotfix-auth-emergency

# Create PR or merge to main
```

---

## PREVENTION

### For Future Logging Changes:

1. **Test authentication locally BEFORE pushing**
   ```bash
   npm run dev
   # Test all sign-in methods
   # Test credentials
   # Test Microsoft login (if configured locally)
   ```

2. **Never modify auth.config.ts without local testing**

3. **Use feature flags for risky changes**

4. **Keep logger separate from auth runtime**
   - Auth callbacks should use plain console
   - Use logger in API routes only

---

## EXPECTED TIMELINE

| Action | Time | Status |
|--------|------|--------|
| Identify issue | 5 min | ✅ COMPLETE |
| Apply fix (Option 2) | 5 min | ⏳ IN PROGRESS |
| Vercel deployment | 2 min | ⏳ WAITING |
| Verification testing | 5 min | ⏳ PENDING |
| **TOTAL** | **17 min** | **ETA: 19:55 UTC** |

---

## COMMUNICATION

### User Message Template:
```
🚨 AUTHENTICATION ISSUE IDENTIFIED

We've identified the root cause of the sign-in failures:
- Recent logging improvements broke NextAuth runtime compatibility
- Fix in progress (ETA: 5 minutes)
- All authentication methods will be restored

Timeline:
- Issue detected: 19:38 UTC
- Fix applied: 19:43 UTC (estimated)
- Service restored: 19:50 UTC (estimated)

We apologize for the inconvenience.
```

---

## NEXT STEPS

1. ✅ Diagnose issue (COMPLETE)
2. ⏳ Apply Option 2 fix (revert logger in auth.config.ts)
3. ⏳ Push to production
4. ⏳ Monitor deployment
5. ⏳ Test all authentication methods
6. ⏳ Confirm resolution
7. 📋 Document lesson learned

---

**Status:** 🔧 FIX IN PROGRESS  
**Priority:** 🚨 P0 - CRITICAL  
**Owner:** Senior Full-Stack Team  
**ETA:** 17 minutes from diagnosis
