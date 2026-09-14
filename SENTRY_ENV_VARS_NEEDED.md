# Sentry Configuration - Environment Variables Needed

**Date:** September 14, 2026  
**Status:** ✅ Code Ready | ⏳ Awaiting Environment Variables

---

## Summary

Sentry is **fully integrated in code** but inactive until environment variables are added to Vercel.

**Impact:** No error tracking, no performance monitoring, no alerts until configured.

---

## Required Environment Variables

Add these in **Vercel Dashboard** → **Settings** → **Environment Variables**:

### 1. NEXT_PUBLIC_SENTRY_DSN (**REQUIRED**)
```
Value: https://<key>@<org>.ingest.sentry.io/<project-id>
Environment: Production, Preview
```

**Where to find:**
1. Go to https://sentry.io
2. Select project: "aip-platform" (or create new)
3. Settings → Client Keys (DSN)
4. Copy "DSN" value

---

### 2. SENTRY_ORG (**REQUIRED**)
```
Value: your-organization-slug
Environment: Production, Preview
```

**Where to find:**
- Sentry Dashboard → Organization Settings → General Settings
- Or from URL: sentry.io/organizations/**your-org-slug**/

**Example:** `africa-infra-partners`

---

### 3. SENTRY_PROJECT (**REQUIRED**)
```
Value: your-project-slug
Environment: Production, Preview
```

**Where to find:**
- Sentry Dashboard → Project Settings → General Settings
- Or from URL: sentry.io/organizations/your-org/projects/**your-project-slug**/

**Example:** `aip-platform`

---

### 4. SENTRY_AUTH_TOKEN (**REQUIRED** for source maps)
```
Value: your-auth-token
Environment: Production, Preview
```

**How to create:**
1. Sentry → User Settings → Auth Tokens
2. Click "Create New Token"
3. **Name:** `aip-platform-vercel-deploy`
4. **Scopes:** 
   - ✅ `project:read`
   - ✅ `project:write`
   - ✅ `project:releases`
5. Copy token (shown only once!)

---

## Optional Environment Variables

### 5. ENVIRONMENT (Optional)
```
Value: production
Environment: Production
```
```
Value: preview
Environment: Preview
```

**Default:** Uses `NODE_ENV` if not set

---

### 6. NEXT_PUBLIC_APP_VERSION (Optional)
```
Value: 1.0.0
Environment: All
```

**Purpose:** Track which version caused errors

---

## Verification Steps

After adding environment variables:

### 1. Trigger a Deployment
```bash
git commit --allow-empty -m "chore: trigger Vercel deploy for Sentry"
git push origin main
```

### 2. Check Sentry Integration
- Vercel build logs should show:
  ```
  ✓ Sentry source maps uploaded
  ✓ Release created: aip-platform@1.0.0
  ```

### 3. Test Error Tracking
```bash
# Visit your app and trigger a test error:
https://app.africa-infra.com/api/sentry-test
```

### 4. Verify in Sentry Dashboard
- Go to https://sentry.io/organizations/your-org/issues/
- Should see test error appear within 30 seconds

---

## What Sentry Will Do (Once Configured)

### ✅ Error Tracking
- JavaScript errors (client-side)
- API errors (server-side)
- Unhandled promise rejections
- Console errors elevated to Sentry

### ✅ Performance Monitoring
- API route latency
- Page load times
- Database query performance
- External API call duration

### ✅ Audit Log Failures
- If audit log write fails, Sentry is notified (HIGH priority)
- Prevents silent security event loss

### ✅ Release Tracking
- Each deployment creates a Sentry release
- Source maps uploaded automatically
- Stack traces show original TypeScript code

---

## Alert Configuration (After Setup)

### Recommended Alerts

**1. High Error Rate**
- Condition: >10 errors/minute
- Action: Email + Slack
- Severity: CRITICAL

**2. New Error Type**
- Condition: Never seen before
- Action: Email
- Severity: HIGH

**3. Performance Degradation**
- Condition: p95 latency >2 seconds
- Action: Slack
- Severity: MEDIUM

**4. Audit Log Failure**
- Condition: Any "audit-log" component error
- Action: Email + Slack (immediate)
- Severity: CRITICAL

---

## Configuration in Vercel Dashboard

### Step-by-Step:

1. **Login to Vercel**
   - https://vercel.com/africa-infra-partners/aip-platform

2. **Go to Settings**
   - Project Settings → Environment Variables

3. **Add Variables**
   - Click "Add New"
   - Paste variable name
   - Paste value
   - Select environments (Production + Preview)
   - Click "Save"

4. **Redeploy**
   - Deployments tab → Three dots on latest → "Redeploy"
   - OR push new commit

---

## Troubleshooting

### Issue: "Sentry DSN not configured"
**Solution:** Verify `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel environment variables

### Issue: "Source maps not uploaded"
**Solution:** 
- Check `SENTRY_AUTH_TOKEN` is valid
- Check token has `project:releases` scope
- Check `SENTRY_ORG` and `SENTRY_PROJECT` match Sentry dashboard

### Issue: "Errors not appearing in Sentry"
**Solution:**
- Check DSN is correct
- Trigger a test error: `/api/sentry-test`
- Check Sentry project is not in "Disabled" state
- Check browser console for Sentry initialization errors

---

## Cost Estimate

**Sentry Pricing (as of 2026):**
- **Team Plan:** $26/month
  - 50,000 errors/month
  - 100,000 performance events/month
  - 30-day data retention

**Expected Usage (AIP Platform):**
- ~5,000 errors/month (estimate)
- ~20,000 performance events/month
- Well within Team Plan limits

---

## Security Notes

- ✅ PII automatically sanitized before sending (20+ fields)
- ✅ Passwords, tokens, secrets redacted
- ✅ IP addresses logged but not linked to users
- ✅ Source maps uploaded but not public
- ✅ GDPR compliant (EU hosting available)

---

## Next Steps

1. **Create Sentry project** (if not exists):
   - https://sentry.io/organizations/new/
   - Project name: `aip-platform`
   - Platform: Next.js

2. **Add environment variables** to Vercel (see above)

3. **Trigger deployment** to activate Sentry

4. **Configure alerts** in Sentry dashboard

5. **Test error tracking** with `/api/sentry-test` endpoint

6. **Update** `SENTRY_ENV_VARS_NEEDED.md` when complete

---

**Estimated Setup Time:** 15 minutes  
**Priority:** HIGH (security monitoring)  
**Blocker:** No (app works without Sentry, just no error tracking)

---

**Questions?**
- Sentry Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- AIP Setup Guide: `SENTRY_SETUP.md` (348 lines, comprehensive)
