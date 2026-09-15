# Emergency Authentication Debug - Staff/Partner Login Failing

**Date:** September 14, 2026  
**Status:** 🚨 CRITICAL - Production authentication completely broken  
**User Report:** Staff and partner login failing, invitation form not working

---

## SYMPTOMS

1. ✅ Hotfix deployed (commit 2b20733)
2. ✅ Auth providers showing correctly in API
3. ❌ Staff login still returns: "Sign-in error. Please try again."
4. ❌ Partner login still returns: "Sign-in error. Please try again."
5. ❌ Request invitation form not working

---

## CRITICAL CHECKS NEEDED

### 1. Vercel Environment Variables

**CHECK IMMEDIATELY in Vercel Dashboard:**

Go to: https://vercel.com/africa-infra-partners/aip-platform/settings/environment-variables

**Required Variables:**
```bash
# NextAuth (CRITICAL)
NEXTAUTH_SECRET=<must-be-set>
NEXTAUTH_URL=https://app.africa-infra.com

# Database (CRITICAL)
DATABASE_URL=<postgresql-connection-string>

# Azure AD (for Microsoft login)
AZURE_AD_CLIENT_ID=<client-id>
AZURE_AD_CLIENT_SECRET=<client-secret>
AZURE_AD_TENANT_ID=<tenant-id>

# Redis (for session cache)
UPSTASH_REDIS_REST_URL=<redis-url>
UPSTASH_REDIS_REST_TOKEN=<redis-token>
```

**Verify:**
- [ ] All variables are set for **Production** environment
- [ ] No placeholder values (like "your-secret-here")
- [ ] NEXTAUTH_URL matches production domain exactly
- [ ] DATABASE_URL is valid and accessible

---

### 2. Database Connectivity

**Test database connection:**

```bash
# From your local machine (requires DATABASE_URL)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"User\";"
```

**Expected:** Should return count of users  
**If fails:** Database is unreachable from production

---

### 3. Check Recent Deployment

**Vercel Deployment Status:**
- Go to: https://vercel.com/africa-infra-partners/aip-platform/deployments
- Check latest deployment status
- Look for build errors or warnings
- Check deployment logs for errors

---

## LIKELY ROOT CAUSES

### Cause 1: NEXTAUTH_SECRET Missing or Invalid (MOST LIKELY)

**Symptom:** Generic "Sign-in error" for all auth methods

**Why:** NextAuth requires NEXTAUTH_SECRET to encrypt session tokens. If missing/invalid:
- Cannot generate session tokens
- All authentication fails
- Returns generic error

**Fix:**
1. Vercel Dashboard → Settings → Environment Variables
2. Check `NEXTAUTH_SECRET` exists and has a value
3. If missing, generate new one:
   ```bash
   openssl rand -base64 32
   ```
4. Add to Vercel as `NEXTAUTH_SECRET`
5. Redeploy

---

### Cause 2: DATABASE_URL Missing/Invalid

**Symptom:** All auth fails, cannot query users

**Why:** Auth needs to query User table, if database unreachable:
- Cannot verify credentials
- Cannot check user status
- Returns generic error

**Fix:**
1. Verify DATABASE_URL is set in Vercel
2. Test connection from production:
   ```bash
   # Add temporary test endpoint
   # /api/test-db/route.ts
   ```
3. If unreachable, check:
   - Azure PostgreSQL firewall rules
   - Connection string format
   - SSL mode requirements

---

### Cause 3: Middleware Blocking Auth Routes

**Symptom:** Auth requests redirected or blocked

**Check in `src/proxy.ts`:**
- Line 63: `if (path.startsWith("/auth/"))`
- Should allow auth pages without restrictions
- Check if `/api/auth/*` is also allowed

**Current code allows `/auth/` but may block `/api/auth/`**

---

## IMMEDIATE DIAGNOSTIC STEPS

### Step 1: Enable Debug Logging

Add to Vercel environment variables:
```bash
NEXTAUTH_DEBUG=true
```

Redeploy and check logs for detailed error messages.

---

### Step 2: Check Vercel Function Logs

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login
vercel login

# View logs
vercel logs https://app.africa-infra.com --follow
```

Look for errors like:
- "NEXTAUTH_SECRET not defined"
- "Database connection failed"
- "Prisma client initialization error"

---

### Step 3: Test Direct API Call

**Test health endpoint (should not require auth):**
```bash
curl https://app.africa-infra.com/api/health
```

**Expected:** JSON with health status  
**If redirects:** Middleware issue  
**If 500 error:** Server/database issue

---

## EMERGENCY ROLLBACK

If cannot fix quickly, rollback to last known working commit:

```bash
# Find last working commit before security fixes
git log --oneline | head -10

# Rollback to commit before 7a8eeff
git reset --hard 3a10621

# Force push (CAREFUL!)
git push --force origin main
```

**WARNING:** This loses ALL security fixes. Only use as last resort.

---

## BETTER FIX: Targeted Revert

Instead of full rollback, revert only problematic changes:

```bash
# Create emergency branch
git checkout -b emergency-auth-fix

# Cherry-pick only crypto fixes (working)
git cherry-pick <crypto-fix-commit-hash>

# Skip all logging changes (problematic)
# Push as hotfix
git push origin emergency-auth-fix
```

---

## VERIFICATION CHECKLIST

After applying fix:

### Production Environment Variables
- [ ] NEXTAUTH_SECRET is set and non-empty
- [ ] NEXTAUTH_URL = https://app.africa-infra.com
- [ ] DATABASE_URL is set and valid
- [ ] All required env vars present

### Database Connection
- [ ] Can connect to database from production
- [ ] User table accessible
- [ ] Queries execute successfully

### Authentication Tests
- [ ] Staff login works
- [ ] Partner login works
- [ ] Request invitation form works
- [ ] Microsoft login works (Azure AD configured)

---

## COMMUNICATION TO USER

**Current Status Message:**
```
🚨 AUTHENTICATION SYSTEM DOWN

We're experiencing a critical authentication issue affecting:
- Staff login
- Partner login
- Invitation requests
- Microsoft sign-in

Timeline:
- Issue detected: 20:29 UTC
- Investigating: In progress
- ETA: 15-30 minutes

We're working urgently to restore service.
```

---

## NEXT STEPS

1. **CHECK VERCEL ENVIRONMENT VARIABLES** (Priority 1)
   - Most likely cause
   - 5 minutes to fix

2. **Enable Debug Logging** (Priority 2)
   - Add NEXTAUTH_DEBUG=true
   - Check Vercel logs

3. **Test Database Connectivity** (Priority 3)
   - Verify DATABASE_URL
   - Check firewall rules

4. **If All Else Fails: Rollback** (Last Resort)
   - Revert to commit 3a10621
   - Restore service first
   - Fix issues in separate branch

---

**Status:** 🔧 DIAGNOSIS IN PROGRESS  
**Priority:** P0 - CRITICAL - PRODUCTION DOWN  
**ETA:** 15-30 minutes
