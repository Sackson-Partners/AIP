# Secret Rotation Strategy - AIP Platform

**Purpose:** Proactive security through regular credential rotation  
**Owner:** DevOps / Security Team  
**Last Updated:** 2026-09-13

---

## Why Rotate Secrets?

**Security Benefits:**
- Limits exposure window if secret compromised
- Reduces impact of leaked credentials
- Meets compliance requirements (SOC 2, ISO 27001)
- Forces attackers to re-compromise systems

**Best Practice:** Assume breach mentality - rotate before compromise, not after

---

## Rotation Schedule

| Secret Type | Rotation Frequency | Auto-Rotate | Priority |
|-------------|-------------------|-------------|----------|
| **NEXTAUTH_SECRET** | Quarterly (90 days) | No | 🔴 CRITICAL |
| **Database Password** | Bi-annual (180 days) | No | 🔴 CRITICAL |
| **API Keys (Anthropic, OpenAI)** | Quarterly (90 days) | No | 🟠 HIGH |
| **Azure AD Client Secret** | Annual (365 days) | No | 🟠 HIGH |
| **Resend API Key** | Quarterly (90 days) | No | 🟡 MEDIUM |
| **Upstash Redis Token** | Bi-annual (180 days) | No | 🟡 MEDIUM |
| **CRON_SECRET** | Bi-annual (180 days) | No | 🟡 MEDIUM |
| **Sentry Auth Token** | Annual (365 days) | No | 🟢 LOW |
| **Vercel Tokens** | Annual (365 days) | No | 🟢 LOW |

---

## Rotation Procedures

### 1. NEXTAUTH_SECRET (Quarterly)

**Impact:** 🔴 HIGH - Forces all users to re-login  
**Downtime:** None (rolling change)  
**Time Required:** 15 minutes

**Steps:**

1. **Generate New Secret**
   ```bash
   openssl rand -base64 32
   ```

2. **Update Vercel Environment**
   ```bash
   vercel env rm NEXTAUTH_SECRET production
   vercel env add NEXTAUTH_SECRET production
   # Paste new secret when prompted
   ```

3. **Redeploy Application**
   ```bash
   git commit --allow-empty -m "chore: trigger redeploy for NEXTAUTH_SECRET rotation"
   git push origin main
   ```

4. **Verify Deployment**
   ```bash
   curl -I https://app.africa-infra.com/api/health
   # Should return 200 OK
   ```

5. **Document Rotation**
   - Update password manager
   - Log rotation in audit trail
   - Set reminder for next rotation (90 days)

**User Impact:** All active sessions invalidated - users must sign in again

**Rollback:** Keep old secret for 24 hours in case rollback needed

---

### 2. Database Password (Bi-Annual)

**Impact:** 🔴 CRITICAL - Requires application restart  
**Downtime:** 5-10 minutes  
**Time Required:** 30 minutes

**Steps:**

1. **Generate New Password**
   ```bash
   openssl rand -base64 32 | tr -d '=' | cut -c1-32
   ```

2. **Update Azure PostgreSQL**
   ```bash
   # Via Azure Portal or CLI
   az postgres flexible-server update \
     --resource-group aip-production \
     --name aip-db \
     --admin-password <NEW_PASSWORD>
   ```

3. **Update Vercel Environment**
   ```bash
   # Update DATABASE_URL with new password
   vercel env rm DATABASE_URL production
   vercel env add DATABASE_URL production
   # Paste: postgresql://user:<NEW_PASSWORD>@host:5432/db?connection_limit=20&pool_timeout=30
   ```

4. **Redeploy Application**
   ```bash
   git commit --allow-empty -m "chore: trigger redeploy for DB password rotation"
   git push origin main
   ```

5. **Verify Connectivity**
   ```bash
   curl https://app.africa-infra.com/api/health | jq '.checks[] | select(.service=="database")'
   # Should show: "status": "healthy"
   ```

**Downtime Window:** Schedule during low-traffic period (2-4 AM UTC)

**Rollback:** Keep old password accessible for 48 hours

---

### 3. API Keys (Anthropic/OpenAI) (Quarterly)

**Impact:** 🟡 MEDIUM - AI features temporarily unavailable  
**Downtime:** < 1 minute  
**Time Required:** 10 minutes per key

**Steps:**

1. **Generate New Key (Anthropic)**
   - Visit: https://console.anthropic.com/settings/keys
   - Click "Create Key"
   - Name: `aip-production-<YYYY-MM>`
   - Copy new key

2. **Update Vercel Environment**
   ```bash
   vercel env rm ANTHROPIC_API_KEY production
   vercel env add ANTHROPIC_API_KEY production
   # Paste new key: sk-ant-...
   ```

3. **Redeploy Application**
   ```bash
   git commit --allow-empty -m "chore: rotate ANTHROPIC_API_KEY"
   git push origin main
   ```

4. **Verify AI Endpoints**
   ```bash
   curl -X POST https://app.africa-infra.com/api/ai/generate \
     -H "Authorization: Bearer <USER_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "test"}'
   # Should generate response
   ```

5. **Delete Old Key**
   - Wait 24 hours to ensure no issues
   - Delete old key from Anthropic console
   - Document rotation date

**Repeat for OpenAI** with similar process at https://platform.openai.com/api-keys

---

### 4. Azure AD Client Secret (Annual)

**Impact:** 🟠 HIGH - Breaks Azure AD SSO login  
**Downtime:** None (rolling change)  
**Time Required:** 20 minutes

**Steps:**

1. **Generate New Secret (Azure Portal)**
   - Go to: Azure AD → App Registrations → AIP Platform
   - Click "Certificates & secrets"
   - Click "New client secret"
   - Description: `aip-production-<YYYY>`
   - Expires: 12 months
   - Copy secret value (shown once!)

2. **Update Vercel Environment**
   ```bash
   vercel env rm AZURE_AD_CLIENT_SECRET production
   vercel env add AZURE_AD_CLIENT_SECRET production
   # Paste new secret
   ```

3. **Redeploy Application**
   ```bash
   git commit --allow-empty -m "chore: rotate Azure AD client secret"
   git push origin main
   ```

4. **Test Azure AD Login**
   - Visit https://app.africa-infra.com/auth/signin
   - Click "Sign in with Microsoft"
   - Complete authentication flow
   - Verify successful login

5. **Delete Old Secret**
   - Wait 48 hours to confirm no issues
   - Delete old secret from Azure Portal
   - Document rotation

**Important:** Keep old secret active for 48 hours as overlap period

---

### 5. Resend API Key (Quarterly)

**Impact:** 🟡 MEDIUM - Email sending fails  
**Downtime:** < 1 minute  
**Time Required:** 10 minutes

**Steps:**

1. **Generate New Key (Resend Dashboard)**
   - Visit: https://resend.com/api-keys
   - Click "Create API Key"
   - Name: `aip-production-<YYYY-MM>`
   - Permissions: Full access
   - Copy key: `re_...`

2. **Update Vercel Environment**
   ```bash
   vercel env rm RESEND_API_KEY production
   vercel env add RESEND_API_KEY production
   # Paste new key
   ```

3. **Redeploy Application**
   ```bash
   git commit --allow-empty -m "chore: rotate Resend API key"
   git push origin main
   ```

4. **Send Test Email**
   ```bash
   # Via admin panel or API
   curl -X POST https://app.africa-infra.com/api/email/send \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"to": "test@africa-infra.com", "subject": "Test", "body": "Test"}'
   ```

5. **Delete Old Key**
   - Wait 24 hours
   - Delete from Resend dashboard
   - Log rotation

---

## Automation (Future Enhancement)

### Automated Rotation Script

**Goal:** Reduce manual work and human error

**Approach:**
```bash
#!/bin/bash
# scripts/rotate-secrets.sh

SECRETS=(
  "NEXTAUTH_SECRET"
  "ANTHROPIC_API_KEY"
  "RESEND_API_KEY"
)

for SECRET in "${SECRETS[@]}"; do
  # Generate new secret
  NEW_VALUE=$(openssl rand -base64 32)
  
  # Update Vercel
  vercel env rm $SECRET production --yes
  echo $NEW_VALUE | vercel env add $SECRET production
  
  # Log rotation
  echo "$(date): Rotated $SECRET" >> /var/log/secret-rotation.log
done

# Trigger deployment
git commit --allow-empty -m "chore: automated secret rotation"
git push origin main
```

**Status:** Not yet implemented (requires careful testing)

---

## Rotation Calendar

### 2026 Q4 (October - December)

| Date | Secret | Action | Owner |
|------|--------|--------|-------|
| **2026-10-15** | NEXTAUTH_SECRET | Rotate | DevOps |
| **2026-10-15** | Anthropic API Key | Rotate | DevOps |
| **2026-10-15** | OpenAI API Key | Rotate | DevOps |
| **2026-10-15** | Resend API Key | Rotate | DevOps |
| **2026-11-01** | Review calendar | Plan Q1 2027 | Security Team |

### 2027 Q1 (January - March)

| Date | Secret | Action | Owner |
|------|--------|--------|-------|
| **2027-01-15** | NEXTAUTH_SECRET | Rotate | DevOps |
| **2027-01-15** | Anthropic API Key | Rotate | DevOps |
| **2027-01-15** | Database Password | Rotate | DevOps |
| **2027-01-15** | Upstash Redis Token | Rotate | DevOps |
| **2027-01-15** | CRON_SECRET | Rotate | DevOps |

**Automated Reminders:** GitHub Issues created 7 days before rotation due

---

## Emergency Rotation

**Trigger:** Suspected or confirmed secret compromise

**Immediate Actions (< 15 minutes):**

1. **Rotate Compromised Secret**
   - Follow standard procedure for that secret
   - Skip waiting periods - rotate immediately

2. **Force User Logouts** (if NEXTAUTH_SECRET)
   ```sql
   UPDATE "User" SET "sessionVersion" = "sessionVersion" + 1;
   ```

3. **Monitor for Abuse**
   - Check Sentry for unusual errors
   - Review API rate limits (429 responses)
   - Check database for unauthorized changes

4. **Incident Report**
   - Document what was compromised
   - How compromise was detected
   - Timeline of rotation
   - Impact assessment

5. **Post-Mortem**
   - Root cause analysis
   - Update security procedures
   - Implement additional safeguards

---

## Secret Storage Best Practices

### ✅ DO

- Store in Vercel environment variables (encrypted at rest)
- Use password manager for team access (1Password, LastPass)
- Document rotation dates in calendar
- Set expiration reminders
- Use separate secrets for dev/staging/production
- Rotate immediately if suspected compromise

### ❌ DON'T

- Commit secrets to git (even in .env files)
- Share secrets via email/Slack
- Store in plaintext documents
- Use same secret across environments
- Delay rotation when compromise suspected
- Store secrets in browser localStorage

---

## Compliance Requirements

### SOC 2

**Control:** Access to secrets restricted to authorized personnel  
**Evidence:** Vercel access logs, password manager audit logs

**Control:** Secrets rotated regularly per policy  
**Evidence:** This document + rotation log

### ISO 27001

**A.9.4.3 Password Management System:**
- Secrets stored securely (encrypted)
- Regular rotation enforced
- Access logged and monitored

**Compliance:** ✅ Met via Vercel + password manager

---

## Monitoring & Alerts

### Secret Expiration Alerts

**Method:** GitHub Issues created automatically

**Schedule:**
- 7 days before rotation: Create issue
- 1 day before rotation: Urgent notification
- Day of rotation: Critical alert

**Configuration:**
```yaml
# .github/workflows/secret-rotation-reminder.yml
name: Secret Rotation Reminder

on:
  schedule:
    - cron: '0 9 * * MON'  # Every Monday 9 AM

jobs:
  check-rotations:
    runs-on: ubuntu-latest
    steps:
      - name: Check rotation calendar
        run: |
          # Check if any secrets due for rotation
          # Create GitHub issue if found
```

**Status:** Not yet implemented

---

## Audit Trail

### Rotation Log Format

**Location:** `docs/secret-rotation-log.md`

**Entry Template:**
```markdown
## NEXTAUTH_SECRET Rotation

**Date:** 2026-09-13 14:30 UTC
**Performed By:** DevOps Team (user@africa-infra.com)
**Reason:** Quarterly rotation (scheduled)
**Old Secret (last 4 chars):** ...XYZ7
**New Secret (last 4 chars):** ...ABC9
**Deployment:** https://vercel.com/...
**Verification:** ✅ Health check passed
**User Impact:** All sessions invalidated (expected)
**Issues:** None
```

---

## Training & Documentation

**Team Training:**
- Onboarding: Show rotation procedures
- Quarterly: Rotation drill
- Annually: Review and update procedures

**Documentation Updates:**
- After each rotation: Log details
- Quarterly: Review calendar
- Annually: Update this document

---

## Contact

**Security Team:** security@africa-infra.com  
**DevOps Oncall:** devops@africa-infra.com  
**Emergency Hotline:** [Phone Number]

---

**Document Version:** 1.0  
**Next Review:** 2026-12-13  
**Approved By:** Security Team Lead
