# Sentry Integration Setup Guide

## Current Status: ✅ Code Ready, ⏳ Environment Variables Needed

The AIP Platform has Sentry fully integrated in code but requires environment variables to activate.

---

## What's Already Configured

**✅ Sentry SDK Installed:**
- `@sentry/nextjs` package
- Server config: `sentry.server.config.ts`
- Client config: `sentry.client.config.ts`

**✅ Error Tracking Integrated:**
- `src/lib/logger.ts` - Automatic Sentry reporting on errors/warnings
- `src/lib/audit.ts` - Audit log failures sent to Sentry
- PII sanitization before sending

**✅ Build Configuration:**
- `next.config.ts` - withSentryConfig wrapper

---

## Required Environment Variables

Add these to Vercel production environment:

```bash
# Required for error tracking
NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>

# Required for source maps and releases
SENTRY_ORG=<your-sentry-org-slug>
SENTRY_PROJECT=<your-sentry-project-slug>
SENTRY_AUTH_TOKEN=<your-auth-token>

# Optional - defaults to NODE_ENV
ENVIRONMENT=production
APP_VERSION=1.0.0
NEXT_PUBLIC_APP_VERSION=1.0.0
```

---

## Step-by-Step Setup

### 1. Create Sentry Account (if needed)

Visit: https://sentry.io/signup/

**Recommended Plan:** Business ($80/month for production)
- 100K errors/month
- 90-day retention
- Release tracking
- Performance monitoring

### 2. Create New Project

1. Go to: https://sentry.io/organizations/[your-org]/projects/new/
2. Select: **Next.js**
3. Name: `aip-platform` (or similar)
4. Create Project

### 3. Get DSN (Data Source Name)

After creating project:
1. Go to **Settings** → **Client Keys (DSN)**
2. Copy the DSN (looks like: `https://[key]@o[org].ingest.sentry.io/[project]`)

### 4. Create Auth Token

For source maps and releases:
1. Go to: https://sentry.io/settings/account/api/auth-tokens/
2. Click **Create New Token**
3. Name: `aip-platform-deploy`
4. Scopes: Select **ALL** of these:
   - `project:read`
   - `project:releases`
   - `org:read`
5. Copy token (starts with `sntrys_...`)

### 5. Add Environment Variables to Vercel

```bash
# Add DSN (public - sent to client)
vercel env add NEXT_PUBLIC_SENTRY_DSN production
# Paste: https://[key]@o[org].ingest.sentry.io/[project]

# Add organization slug
vercel env add SENTRY_ORG production
# Paste: your-org-slug (from Sentry URL)

# Add project slug
vercel env add SENTRY_PROJECT production
# Paste: aip-platform

# Add auth token (secret)
vercel env add SENTRY_AUTH_TOKEN production
# Paste: sntrys_...
```

### 6. Redeploy Application

```bash
# Trigger new deployment to pick up env vars
git commit --allow-empty -m "chore: trigger redeploy for Sentry config"
git push origin main
```

### 7. Verify Integration

After deployment:

```bash
# Check Sentry is initialized
curl https://app.africa-infra.com/api/health

# Trigger test error (in browser console)
# Go to: https://app.africa-infra.com
# Open DevTools → Console
# Run: throw new Error("Sentry test error")

# Check Sentry dashboard
# Go to: https://sentry.io/organizations/[your-org]/issues/
# Should see the test error within 30 seconds
```

---

## What You'll Get

### Error Tracking

**Automatic capture:**
- Unhandled exceptions (client & server)
- API route errors
- Middleware failures
- Audit log write failures

**Error Details:**
- Stack traces with source maps
- User context (sanitized, no PII)
- Request context (URL, method, headers)
- Breadcrumbs (user actions before error)

### Performance Monitoring

**Tracks:**
- API response times
- Database query performance
- Page load times
- External API calls (Anthropic, Resend, Azure)

### Release Tracking

**Automatic:**
- Each deployment creates a Sentry release
- Commit history linked to errors
- Deploy notifications in Sentry
- Regression detection (new errors vs. old)

---

## Alert Configuration (Recommended)

After setup, configure alerts:

1. Go to: **Alerts** → **Create Alert**

### Critical Alert (Immediate)
- **Condition:** Error rate > 10/minute
- **Action:** Email + Slack
- **For:** Production only

### Error Spike Alert
- **Condition:** Error count increased 200% vs. 1 hour ago
- **Action:** Email
- **For:** Production + Staging

### Performance Degradation
- **Condition:** P95 response time > 2 seconds
- **Action:** Email
- **For:** Production only

---

## Testing Sentry Locally

To test before production:

```bash
# Add to .env.local
NEXT_PUBLIC_SENTRY_DSN=https://[key]@o[org].ingest.sentry.io/[project]
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=aip-platform

# Run dev server
npm run dev

# Trigger error in browser
# Go to: http://localhost:3000
# Open console: throw new Error("Local test")

# Check Sentry dashboard
```

---

## Cost Estimate

**Sentry Business Plan:** $80/month

**Breakdown:**
- Base: $80/month
- Errors: 100K/month included
- Estimated usage: ~20K errors/month (well within limit)
- Attachments: 1GB included
- Team: Unlimited members

**Total:** ~$80/month fixed cost

---

## Security Considerations

**✅ PII Protection:**
- Logger sanitizes sensitive fields before sending
- No passwords, tokens, or secrets sent
- User emails truncated (first 3 chars + `***@domain.com`)

**✅ Auth Token Security:**
- Stored as encrypted Vercel env var
- Never committed to git
- Rotated quarterly (recommended)

**✅ Public DSN:**
- `NEXT_PUBLIC_SENTRY_DSN` is public (safe to expose)
- Rate-limited by Sentry
- Can be revoked if abused

---

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN is set:**
   ```bash
   vercel env ls production | grep SENTRY
   ```

2. **Check initialization:**
   - View browser console for "Sentry initialized"
   - Check `sentry.client.config.ts` loaded

3. **Check network tab:**
   - Look for POST to `sentry.io/api/.../envelope/`
   - Status should be 200

### Source Maps Not Uploading

1. **Verify auth token:**
   ```bash
   vercel env ls production | grep SENTRY_AUTH_TOKEN
   ```

2. **Check build logs:**
   ```bash
   vercel logs <deployment-url> | grep -i sentry
   ```

3. **Manual upload:**
   ```bash
   npx @sentry/cli releases files <version> upload-sourcemaps .next
   ```

---

## Maintenance

**Monthly:**
- Review error trends
- Archive resolved issues
- Update alert thresholds

**Quarterly:**
- Rotate SENTRY_AUTH_TOKEN
- Review performance budgets
- Clean up old releases (auto after 90 days)

**Yearly:**
- Review plan vs. usage
- Update team access
- Audit PII sanitization rules

---

## Support

**Sentry Documentation:** https://docs.sentry.io/platforms/javascript/guides/nextjs/

**Sentry Support:** support@sentry.io

**Internal Contact:** Platform team / DevOps

---

**Status:** Ready for activation (just needs env vars)  
**Last Updated:** 2026-09-13  
**Next Review:** After initial setup
