# RUN THIS MIGRATION NOW - 2 MINUTES

**Date:** September 15, 2026  
**Status:** 🔄 DEPLOYMENT IN PROGRESS  
**Action Required:** Run migration after deployment completes

---

## WHAT'S HAPPENING

**Deploying fixes:**
- ✅ Committed to GitHub (a802cb0)
- 🔄 Deploying to Vercel (in progress, ~2 min)
- ⏳ Migration endpoint ready
- ⏳ Logo access fixed

**Deployment includes:**
1. Migration endpoint: `/api/admin/run-migration`
2. Logo file access fix (middleware excludes images)
3. SQL migration file

---

## AFTER DEPLOYMENT COMPLETES

### Step 1: Wait for Deployment (~2 minutes)

Check deployment status:
```bash
vercel ls --prod | head -2
```

Wait for: `● Ready` status

---

### Step 2: Run Migration (1 command)

**Run this command:**
```bash
curl -X POST https://app.africa-infra.com/api/admin/run-migration
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Migration completed successfully",
  "columnAdded": [...],
  "timestamp": "2026-09-15T..."
}
```

**If successful:** ✅ All authentication will work immediately!

---

### Step 3: Test Authentication

**Test immediately:**
```bash
# 1. Test auth providers
curl https://app.africa-infra.com/api/auth/providers

# 2. Test logo file
curl -I https://app.africa-infra.com/aip-logo.jpeg
# Should return: HTTP 200 (not 307 redirect)

# 3. Test login page
open https://app.africa-infra.com/auth/signin
# Logo should be visible
# Staff/Partner/Microsoft login should work
```

---

## WHAT THE MIGRATION DOES

**SQL Executed:**
```sql
-- Adds missing sessionVersion column
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Creates performance index
CREATE INDEX IF NOT EXISTS "User_sessionVersion_idx"
ON "User"("sessionVersion");
```

**Impact:**
- ✅ Fixes database schema mismatch
- ✅ Restores all authentication
- ✅ Safe: uses IF NOT EXISTS (idempotent)
- ✅ Fast: <1 second execution

---

## TROUBLESHOOTING

### If Migration Fails:

**Check endpoint:**
```bash
# See if migration is needed
curl https://app.africa-infra.com/api/admin/run-migration

# Response will show:
# - migrationNeeded: true/false
# - columnExists: true/false
```

**View logs:**
```bash
vercel logs --prod --since 5m | grep -i migration
```

### If Still Broken:

**Alternative: Run SQL directly via Azure Portal**

1. Go to: https://portal.azure.com
2. Find: PostgreSQL server "aip-db"
3. Click: "Query editor"
4. Run:
   ```sql
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;
   ```

---

## EXPECTED TIMELINE

| Step | Time | Status |
|------|------|--------|
| 1. Deployment | 2-3 min | 🔄 In progress |
| 2. Run migration | 10 sec | ⏳ Waiting |
| 3. Test auth | 1 min | ⏳ Waiting |
| **Total** | **3-4 min** | **Then working!** |

---

## VERIFICATION CHECKLIST

After migration:

- [ ] Migration returned success
- [ ] Auth providers API works
- [ ] Logo file accessible (not redirecting)
- [ ] Staff login works
- [ ] Partner login works
- [ ] Microsoft login works
- [ ] Request invitation works
- [ ] No database errors in logs

---

## SIMPLE STEPS

**1. Wait for deployment** (you'll be notified)

**2. Run one command:**
```bash
curl -X POST https://app.africa-infra.com/api/admin/run-migration
```

**3. Test login page:**
```
https://app.africa-infra.com/auth/signin
```

**Done!** Everything should work.

---

**Status:** 🔄 Deployment in progress, then run migration

**ETA:** 3-4 minutes total

**Confidence:** HIGH - This will fix all issues
