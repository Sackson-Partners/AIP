# AIP Platform Incident Response Runbook

**Last Updated:** 2026-09-13  
**Version:** 1.0  
**Owner:** Engineering Team

---

## Incident Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Platform down, data breach, auth broken | < 15 minutes | Complete outage, security breach, data loss |
| **P2 - High** | Major feature broken, severe performance degradation | < 1 hour | AI generation failing, payments down, login slow |
| **P3 - Medium** | Minor feature broken, degraded performance | < 4 hours | Document upload failing, search slow, UI glitch |
| **P4 - Low** | Cosmetic issues, non-critical bugs | < 24 hours | Button styling, minor text errors |

---

## P1 - Critical Incident Response

### Immediate Actions (0-15 minutes)

1. **Acknowledge Incident:**
   - [ ] Update status page: "Investigating"
   - [ ] Post in Slack #incidents channel
   - [ ] Assign incident commander

2. **Assess Impact:**
   ```bash
   # Check health endpoint
   curl https://app.africa-infra.com/api/health
   
   # Check how many users affected
   # Look at recent errors in Sentry
   ```
   
   Questions to answer:
   - How many users affected? (All, subset, specific role?)
   - What functionality is broken? (Auth, data access, AI features?)
   - Is data at risk? (Data loss, corruption, security breach?)

3. **Initial Communication:**
   ```
   Template:
   "We're investigating an issue affecting [FUNCTIONALITY]. 
   [X] users impacted. Updates every 15 minutes. 
   ETA for fix: [TIME or "investigating"]"
   ```

4. **Check These First:**
   - [ ] Vercel deployment status: [vercel.com/dashboard](https://vercel.com/dashboard)
   - [ ] Azure database status: Azure Portal → AIP-RG → aip-db
   - [ ] Redis status: Upstash dashboard
   - [ ] Recent code changes: `git log --oneline -10`
   - [ ] Sentry errors: Check spike in error rate

### Decision Tree (15-30 minutes)

```
Is it a recent deployment?
├─ YES → Rollback immediately (see rollback.md)
└─ NO → Continue investigation

Is database accessible?
├─ NO → Check Azure Portal, contact Azure support
└─ YES → Continue

Is authentication working?
├─ NO → Check NEXTAUTH_SECRET, Azure AD config
└─ YES → Continue

Is it affecting all users?
├─ YES → Infrastructure issue, check Vercel/Azure
└─ NO → Specific feature/role issue, investigate code
```

### Mitigation (30-60 minutes)

Based on root cause:

**Deployment Issue:**
```bash
# Rollback (2 minutes)
vercel rollback

# Verify fix
curl https://app.africa-infra.com/api/health
```

**Database Issue:**
- Check Azure Portal diagnostics
- Check connection pool exhaustion: Look for "Too many connections" errors
- Emergency: Scale up database tier temporarily

**External Service Issue (Anthropic, Azure AD):**
- Check service status pages
- Implement graceful degradation if possible
- Communicate timeline based on service status

**Code Bug:**
- Apply hotfix if obvious
- Otherwise, rollback and fix offline

### Communication Updates

**Every 15 minutes:**
```
"Update [TIME]: [STATUS]. [PROGRESS]. Next update in 15 min."
```

**When Resolved:**
```
"Resolved [TIME]: [WHAT WAS FIXED]. All systems operational. 
Post-mortem will be shared within 48 hours."
```

---

## P2 - High Priority Incident Response

### Response Timeline (0-60 minutes)

1. **Acknowledge (< 15 min):**
   - Post in Slack #engineering
   - Create Jira ticket
   - Assign engineer

2. **Investigate (15-30 min):**
   - Reproduce issue
   - Check logs: `vercel logs --prod | grep ERROR`
   - Check Sentry for errors
   - Check recent deployments

3. **Fix (30-60 min):**
   - Rollback if recent deployment caused it
   - OR create hotfix branch
   - Test in preview environment
   - Deploy to production

4. **Verify (60-75 min):**
   - Test affected functionality
   - Monitor for 15 minutes
   - Close ticket

5. **Document:**
   - Update Jira with root cause
   - Add note to CHANGELOG.md
   - No formal post-mortem required (unless impacts SLA)

---

## P3 - Medium Priority Incident Response

### Response Timeline (0-4 hours)

1. **Triage (< 30 min):**
   - Confirm severity (could it be P2?)
   - Check if workaround exists
   - Assign to next available engineer

2. **Investigate & Fix (1-3 hours):**
   - Create fix in normal development flow
   - Add tests to prevent regression
   - Get code review

3. **Deploy:**
   - Ship with next regular deployment
   - No emergency deployment needed

4. **Monitor:**
   - Verify fix in production
   - Close ticket

---

## P4 - Low Priority Incident Response

- Add to backlog
- Fix in normal sprint
- No immediate action required

---

## Incident Classification Examples

### P1 Examples
- ❌ Complete platform outage
- ❌ Users can't login (authentication broken)
- ❌ Database offline or corrupted
- ❌ Data breach or security incident
- ❌ Payment processing completely down
- ❌ Critical data loss

### P2 Examples
- ⚠️ AI generation endpoints failing (all users)
- ⚠️ Project creation broken
- ⚠️ Deal room access returns 500
- ⚠️ Document upload fails for all file types
- ⚠️ API response time > 10 seconds (p95)
- ⚠️ Rate limiting blocking legitimate users

### P3 Examples
- 🟡 Search returns incomplete results
- 🟡 One file type can't be uploaded (others work)
- 🟡 Notification emails delayed by 30 minutes
- 🟡 Admin dashboard slow to load
- 🟡 Pagination broken on one page

### P4 Examples
- 🟢 Button has wrong color
- 🟢 Typo in help text
- 🟢 Icon misaligned
- 🟢 Console.log statement left in code
- 🟢 Tooltip has incorrect wording

---

## Monitoring & Detection

### Automated Alerts (Should Trigger Incident)

- [ ] Health check fails (returns 503)
- [ ] Error rate > 5% for 5 minutes
- [ ] Response time p95 > 5 seconds
- [ ] Database connection pool > 90% full
- [ ] Redis connection failures
- [ ] Sentry error spike (10x normal)

### Manual Checks (Daily)

- [ ] Health endpoint: `curl https://app.africa-infra.com/api/health`
- [ ] Sentry dashboard: Check for new error types
- [ ] Vercel analytics: Check traffic patterns
- [ ] Database performance: Check slow query log

---

## Tools & Resources

### Quick Links
- **Status Page:** [status.africa-infra.com] (if configured)
- **Sentry:** [sentry.io/aip-platform] (error tracking)
- **Vercel Dashboard:** [vercel.com/dashboard] (deployments)
- **Azure Portal:** [portal.azure.com] (database, storage)
- **Upstash:** [console.upstash.com] (Redis)

### Commands
```bash
# Check health
curl https://app.africa-infra.com/api/health | jq .

# Stream production logs
vercel logs --prod --follow

# Check recent deployments
vercel ls --prod

# Rollback
vercel rollback

# Check database
npx prisma studio  # Opens database GUI

# Run tests
npm test

# Check TypeScript
npx tsc --noEmit
```

---

## Post-Incident Actions

### Immediate (Within 1 hour of resolution)
- [ ] Update status page to "Resolved"
- [ ] Send resolution notification
- [ ] Document timeline in Jira
- [ ] Tag related commits/PRs

### Short-term (Within 48 hours)
- [ ] Write post-mortem (P1/P2 only)
- [ ] Identify root cause
- [ ] Create prevention tickets
- [ ] Update runbooks if needed

### Post-Mortem Template (P1/P2 only)
```markdown
# Incident Post-Mortem: [TITLE]

**Date:** [DATE]
**Severity:** [P1/P2]
**Duration:** [START - END] ([X] minutes)
**Impact:** [X] users affected, [Y] requests failed

## Timeline
- [TIME] Incident detected
- [TIME] Team notified
- [TIME] Root cause identified
- [TIME] Fix applied
- [TIME] Incident resolved

## Root Cause
[Detailed explanation]

## What Went Well
- [Item]

## What Went Wrong
- [Item]

## Action Items
1. [ ] [Prevention ticket] - Owner: [NAME] - Due: [DATE]
2. [ ] [Monitoring ticket] - Owner: [NAME] - Due: [DATE]
3. [ ] [Documentation] - Owner: [NAME] - Due: [DATE]
```

---

## On-Call Rotation

| Week | Primary | Secondary |
|------|---------|-----------|
| Week 1 | [Name] | [Name] |
| Week 2 | [Name] | [Name] |
| Week 3 | [Name] | [Name] |
| Week 4 | [Name] | [Name] |

**On-Call Expectations:**
- Response time: < 15 minutes for P1, < 1 hour for P2
- Available: 24/7 during on-call week
- Handoff: Document any ongoing issues before rotation

---

## Escalation Path

1. **Primary On-Call** → 15 min response
2. **Secondary On-Call** → If primary unavailable after 5 min
3. **Engineering Manager** → If issue not resolved in 30 min (P1)
4. **CTO** → If issue not resolved in 1 hour (P1) or data breach

---

## Communication Templates

### P1 Initial Communication
```
🔴 INCIDENT: [TITLE]
Status: Investigating
Severity: P1 - Critical
Impact: [X] users, [FUNCTIONALITY] affected
Started: [TIME]
ETA: Investigating
Updates: Every 15 minutes
```

### P1 Update
```
🔴 UPDATE [TIME]: [PROGRESS]
Root cause: [IDENTIFIED/INVESTIGATING]
Mitigation: [IN PROGRESS/APPLIED]
ETA: [TIME or "ongoing"]
Next update: [TIME]
```

### P1 Resolution
```
✅ RESOLVED: [TITLE]
Duration: [X] minutes
Root cause: [BRIEF DESCRIPTION]
Fix: [WHAT WAS DONE]
All systems operational.
Post-mortem: [LINK] (within 48h)
```

---

**Last Updated:** 2026-09-13  
**Next Review:** 2026-12-13  
**Incident Count This Quarter:** 0
