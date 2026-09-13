# AIP Platform Rollback Procedure

**Last Updated:** 2026-09-13  
**Criticality:** HIGH - Use in production incidents  
**Estimated Time:** 2-5 minutes

---

## Quick Rollback (Vercel)

### Option 1: Vercel Dashboard (Recommended)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → AIP project
2. Click **"Deployments"** tab
3. Find last working deployment (look for ✅ status before incident)
4. Click **"..."** menu → **"Promote to Production"**
5. Confirm promotion
6. **Estimated Time:** 2 minutes

### Option 2: Vercel CLI (For Automation)
```bash
# List recent production deployments
vercel ls --prod

# Example output:
# aip-plum-abc123.vercel.app  2m ago  ✅ Ready
# aip-plum-xyz789.vercel.app  1h ago  ✅ Ready

# Rollback to specific deployment URL
vercel rollback aip-plum-xyz789.vercel.app

# Or rollback to previous deployment
vercel rollback
```

**Estimated Time:** 1 minute

---

## Database Migration Rollback

### Prisma Migration Rollback

**⚠️ WARNING:** Only use if deployment issue is database-related

```bash
# 1. View migration history
npx prisma migrate status

# Example output:
# Following migrations have been applied:
# 20260913_add_milestone_archive_fields
# 20260912_add_idempotency_records
# 20260911_add_financial_check_constraints

# 2. Mark last migration as rolled back (doesn't modify data)
npx prisma migrate resolve --rolled-back 20260913_add_milestone_archive_fields

# 3. Apply fix migration
npx prisma migrate dev --name fix_rollback_issue

# 4. Deploy fix
vercel --prod
```

**Estimated Time:** 5-10 minutes

---

## Health Check Verification

After rollback, verify system health:

```bash
# Check health endpoint
curl https://app.africa-infra.com/api/health

# Expected output (healthy):
{
  "status": "healthy",
  "timestamp": "2026-09-13T...",
  "checks": [
    {"service": "database", "status": "healthy"},
    {"service": "redis", "status": "healthy"},
    ...
  ]
}

# If unhealthy, check specific service:
# Database: Check Azure Portal → AIP-RG → aip-db
# Redis: Check Upstash dashboard
# API: Check Vercel deployment logs
```

---

## Common Rollback Scenarios

### Scenario 1: Broken API Endpoint
**Symptoms:** 500 errors on specific route, other routes working  
**Action:** Rollback deployment (Option 1 or 2 above)  
**Time:** 2 minutes

### Scenario 2: Database Connection Issues
**Symptoms:** All routes return 503, health check shows DB unhealthy  
**Action:** 
1. Check Azure database status (may be Azure issue, not deployment)
2. If database is up, rollback deployment
3. Check DATABASE_URL environment variable in Vercel  
**Time:** 5 minutes

### Scenario 3: Authentication Broken
**Symptoms:** Users can't log in, 401 errors  
**Action:**
1. Check NEXTAUTH_SECRET hasn't changed
2. Check Azure AD configuration
3. If recent deployment, rollback
**Time:** 3 minutes

### Scenario 4: Migration Applied Incorrectly
**Symptoms:** Database errors, schema mismatch  
**Action:**
1. Rollback deployment first (contains old schema)
2. Mark migration as rolled back (Step 2 in Database section)
3. Create fix migration
4. Re-deploy  
**Time:** 10 minutes

---

## Post-Rollback Actions

1. **Notify Team:**
   ```
   - Slack: #engineering
   - Email: dev@africa-infra.com
   - Status Page: Update incident
   ```

2. **Investigate Root Cause:**
   - Check Vercel deployment logs: `vercel logs --prod`
   - Check Sentry errors: [sentry.io/aip-platform]
   - Check database logs: Azure Portal → Diagnostic Settings

3. **Document Incident:**
   - Create post-mortem document
   - Update this runbook if new scenario discovered
   - Schedule retrospective meeting

4. **Create Fix:**
   - Create hotfix branch: `git checkout -b hotfix/issue-description`
   - Apply fix
   - Test thoroughly in preview deployment
   - Get review before merging to main

---

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Primary On-Call | [Your name] | [Contact] |
| Database Admin | Azure Portal Support | 24/7 |
| Vercel Support | support@vercel.com | 24/7 (Pro plan) |
| Security Lead | [Security contact] | [Contact] |

---

## Rollback Decision Matrix

| Issue Severity | Symptoms | Action | Response Time |
|----------------|----------|--------|---------------|
| **P1 - Critical** | Platform down, no users can access | Immediate rollback | < 5 min |
| **P2 - High** | Major feature broken, data integrity risk | Rollback within 15 min | < 15 min |
| **P3 - Medium** | Minor feature broken, workaround exists | Evaluate, may rollback | < 1 hour |
| **P4 - Low** | Cosmetic issue, no user impact | Fix forward, no rollback | Next sprint |

---

## Pre-Deployment Checklist (Prevent Rollbacks)

Before deploying to production:

- [ ] All tests passing (138 Jest tests)
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Preview deployment tested manually
- [ ] Health check passing on preview
- [ ] Database migration tested in staging
- [ ] Rollback plan prepared (know last good deployment)
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment window

---

## Additional Resources

- **Vercel Docs:** [vercel.com/docs/deployments/rollback](https://vercel.com/docs/deployments/rollback)
- **Prisma Migrations:** [prisma.io/docs/guides/migrate/production](https://prisma.io/docs/guides/migrate/production)
- **Health Check Guide:** `/HEALTH_CHECK_GUIDE.md`
- **Incident Response:** `/docs/runbooks/incident-response.md`

---

**Last Rollback:** Never (platform launched 2026-09-13)  
**Total Rollbacks This Year:** 0  
**Average Rollback Time:** N/A
