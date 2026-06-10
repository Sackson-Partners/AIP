# AIP Platform — Verification Checklist
## How to Verify Your Changes Are Live

---

## 🔍 QUICK VERIFICATION STEPS

### 1. Check Deployment Status
**Go to:** https://vercel.com/sackson/aip/deployments

**What to verify:**
- Latest deployment shows commit `34fa67d` (or later)
- Status shows "Ready" with green checkmark ✅
- Deployment time is recent (within last 10 minutes)
- **If status shows "Building" or "Failed":** Wait for it to complete or check error logs

---

### 2. Verify PESTEL → PETFEL Rename

**Test Navigation Label:**
1. Sign in to: https://aip-plum.vercel.app
2. Look at left sidebar navigation
3. **Expected:** Label should say "PETFEL" (not "PESTEL")
4. Click on PETFEL link
5. **Expected:** Page title should show "PETFEL Assessment"

**Test API Response:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to PETFEL page
4. Look at API responses
5. **Expected:** Should see `/api/petfel/` endpoints (not `/api/pestel/`)

---

### 3. Verify EIN AI Generation

**Test EIN Generate Button:**
1. Navigate to EIN page
2. Select a project
3. Click "Generate with AI" button
4. **Expected:**
   - Button shows loading state (30-60 seconds)
   - Success message appears
   - Generated content populates 6 sections:
     * Project Summary
     * Strategic Objectives
     * Sector Context
     * Financial Structure
     * Risk Profile
     * Investment Rationale
5. Check database: `status` should change from "DRAFT" to "COMPLETE"

**Test External Partner Block:**
1. Sign in as External Partner role (if available)
2. Navigate to EIN page
3. **Expected:** AI Generate button should be hidden/disabled

---

### 4. Verify Add User Endpoint

**Test User Creation:**
1. Go to Admin → Users
2. Click "Add New User"
3. Fill in form:
   - Email: test@example.com
   - First Name: Test
   - Last Name: User
   - Role: ANALYST (or ADMIN)
   - Password: test1234 (8 chars minimum now, not 12)
4. Submit
5. **Expected:**
   - Success message appears
   - New user appears in user list
   - If error: Check error message is descriptive (not generic "Validation failed")

---

### 5. Verify PETFEL Score/Rating/Calculate

**Test Manual Score Input:**
1. Go to PETFEL page
2. Select a project with existing assessment
3. Toggle "Manual" mode
4. Edit a pillar score (e.g., Political: change to 3.5)
5. Click "Save Scores"
6. **Expected:** Success toast appears, score persists

**Test Calculate Final:**
1. After editing scores, click "Calculate Final" button
2. **Expected:**
   - Loading spinner appears
   - Overall Score updates
   - Rating (A/B/C/D) appears
   - Page does NOT reload

---

### 6. Verify Dashboard Map Fix

**Test Map Displays:**
1. Navigate to Dashboard page
2. Scroll to "Project Discovery Map" section
3. **Expected:**
   - If `NEXT_PUBLIC_MAPBOX_TOKEN` is set: Map loads with project markers
   - If token missing: Error message displays with instructions
4. If map loads:
   - **Expected:** Markers appear for projects with valid countries
   - Click on a marker: Popup shows project name, country, sector, stage
   - Click on cluster: Map zooms in to show individual projects
5. Only non-archived projects should appear on map

**Test Environment Variable:**
1. Go to Vercel → Project → Settings → Environment Variables
2. Check if `NEXT_PUBLIC_MAPBOX_TOKEN` exists
3. **If missing:**
   - Copy token from `.env.local` file (starts with `pk.`)
   - Add to all environments (Production, Preview, Development)
   - Redeploy the application
4. **Expected:** After redeploy, map loads successfully

---

## 🚨 COMMON ISSUES & SOLUTIONS

### Issue: "Changes not visible"
**Solution:**
1. **Hard refresh browser:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear cache:** 
   - Chrome: DevTools → Network → Disable cache (checkbox)
   - Or: Settings → Privacy → Clear browsing data
3. **Check Vercel deployment:** Ensure it shows "Ready" status
4. **Verify correct URL:** Should be `https://aip-plum.vercel.app` (not localhost)

### Issue: "Still seeing PESTEL label"
**Possible causes:**
- Browser cache (clear cache)
- Vercel deployment still building (wait 3-5 minutes)
- You're on localhost instead of production (check URL)

### Issue: "EIN Generate button does nothing"
**Check:**
1. Open browser console (F12)
2. Look for errors
3. Check Network tab → XHR requests
4. **Expected:** Should see `POST /api/ein/[id]/generate` with 200 response
5. If 500 error: Check that `ANTHROPIC_API_KEY` is set in Vercel environment variables

### Issue: "Add User fails with validation error"
**Common causes:**
- Password too short (minimum 8 characters)
- Email format invalid
- Role not one of: ANALYST, ADMIN, SUPER_ADMIN
- User with that email already exists (409 error)

---

## 📋 DATABASE MIGRATIONS STILL PENDING

**CRITICAL:** These migrations have NOT been run yet. New features won't fully work until you apply them.

### Migration 1: Archive & Publish Fields
```sql
-- File: prisma/migrations/20260609_add_archive_and_publish.sql
-- Run this on Azure PostgreSQL database
```

### Migration 2: EIN AI Fields
```sql
-- File: prisma/migrations/20260610_ein_ai_fields.sql
-- Run this on Azure PostgreSQL database
```

**How to apply:**
```bash
# Option 1: Direct SQL on Azure
psql -h aip-db.postgres.database.azure.com \
     -U sackson \
     -d aip_frontend \
     -p 5432 \
     -f prisma/migrations/20260610_ein_ai_fields.sql

# Option 2: Copy SQL and run in Azure Portal Query Editor
```

**What happens if migrations not run:**
- ❌ EIN AI generation will fail (missing `status`, `lastGeneratedAt` columns)
- ❌ Archive functionality will fail (missing `archived`, `archivedAt` columns)
- ❌ Document publish control will fail (missing `published` column)

---

## ✅ VERIFICATION COMPLETE CHECKLIST

After going through all tests above, confirm:

- [ ] Vercel deployment shows "Ready" status
- [ ] Browser cache cleared / hard refresh done
- [ ] Navigation shows "PETFEL" (not "PESTEL")
- [ ] PETFEL page title correct
- [ ] EIN AI Generate button works (or shows proper loading state)
- [ ] Add User form accepts 8-character passwords
- [ ] PETFEL manual score input saves correctly
- [ ] PETFEL Calculate Final updates rating
- [ ] Dashboard map displays (or shows config error if token missing)
- [ ] Map markers only show non-archived projects
- [ ] Database migrations applied (if testing new features)

---

## 🆘 STILL NOT WORKING?

**Collect this information:**
1. Screenshot of Vercel deployment page
2. Screenshot of browser console errors (F12 → Console tab)
3. Screenshot of Network tab showing failed API request (if any)
4. Exact URL you're accessing
5. Which specific feature is not working

**Then:**
- Check `IMPLEMENTATION-STATUS.md` to see which features are complete vs pending
- Verify you're testing a completed feature (Steps 1-4) not a pending one (Steps 5-21)
- Double-check environment variables in Vercel (especially `ANTHROPIC_API_KEY`)

---

**Last Updated:** 2026-06-10  
**Latest Commit:** (pending deployment)  
**Vercel URL:** https://aip-plum.vercel.app

**New Features in This Deployment:**
- Dashboard Map Fix with proper error handling
- Map data API endpoint with Redis caching
- Filter archived projects from map display
