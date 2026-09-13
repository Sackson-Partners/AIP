# AIP Platform Secrets Rotation Policy

**Last Updated:** 2026-09-13  
**Policy Version:** 1.0  
**Compliance:** SOC 2, ISO 27001, GDPR

---

## Rotation Schedule

| Secret | Rotation Frequency | Last Rotated | Next Due | Risk if Exposed |
|--------|-------------------|--------------|----------|-----------------|
| `NEXTAUTH_SECRET` | Every 90 days | 2026-09-13 | 2026-12-13 | Session hijacking, authentication bypass |
| `AZURE_AD_CLIENT_SECRET` | Every 180 days | 2026-09-13 | 2027-03-13 | OAuth bypass, identity theft |
| `DATABASE_URL` password | Every 90 days | 2026-09-13 | 2026-12-13 | Complete data breach |
| `ANTHROPIC_API_KEY` | If compromised | 2026-09-13 | On demand | Financial loss ($1000s/day) |
| `UPSTASH_REDIS_REST_TOKEN` | Every 180 days | 2026-09-13 | 2027-03-13 | Cache poisoning, DoS |
| `RESEND_API_KEY` | Every 180 days | 2026-09-13 | 2027-03-13 | Spam, phishing campaigns |
| `AZURE_STORAGE_CONNECTION` | Every 180 days | 2026-09-13 | 2027-03-13 | Document access, data exfiltration |

---

## Rotation Procedures

### 1. NEXTAUTH_SECRET Rotation

**Impact:** ⚠️ **All users forced to re-login**  
**Downtime:** None  
**Duration:** 5 minutes

```bash
# Generate new secret (32+ characters required)
NEW_SECRET=$(openssl rand -base64 32)

# Show the new secret (save this securely)
echo "New NEXTAUTH_SECRET: $NEW_SECRET"

# Update in Vercel (requires Vercel CLI)
vercel env rm NEXTAUTH_SECRET production --yes
echo $NEW_SECRET | vercel env add NEXTAUTH_SECRET production

# Verify
vercel env ls production | grep NEXTAUTH_SECRET

# Redeploy to pick up new secret
vercel --prod

# Test
# 1. Try to login → Should work
# 2. Old session tokens → Should be invalidated
```

**When to Rotate:**
- Every 90 days (scheduled)
- Immediately if secret exposed in logs/code
- After security breach
- When employee with access leaves

**Post-Rotation:**
- [ ] Update rotation schedule above
- [ ] Test login flow
- [ ] Monitor Sentry for auth errors
- [ ] Document in CHANGELOG.md

---

### 2. Azure AD Client Secret Rotation

**Impact:** ⚠️ OAuth login broken until deployed  
**Downtime:** < 2 minutes during deployment  
**Duration:** 10 minutes

**Prerequisites:**
- Azure Portal access
- Vercel access

**Steps:**

1. **Create New Secret in Azure Portal:**
   ```
   1. Go to portal.azure.com
   2. Azure Active Directory → App Registrations
   3. Select "AIP Platform"
   4. Certificates & Secrets → New client secret
   5. Description: "Secret-2026-09-13"
   6. Expires: 180 days
   7. Click "Add"
   8. **COPY THE SECRET VALUE IMMEDIATELY** (only shown once)
   ```

2. **Update Vercel Environment:**
   ```bash
   # Update secret in Vercel
   vercel env rm AZURE_AD_CLIENT_SECRET production --yes
   echo "[NEW_SECRET]" | vercel env add AZURE_AD_CLIENT_SECRET production
   
   # Redeploy
   vercel --prod
   ```

3. **Test:**
   ```bash
   # Try Azure AD login
   # 1. Go to https://app.africa-infra.com
   # 2. Click "Sign in with Microsoft"
   # 3. Should complete successfully
   ```

4. **Delete Old Secret (After 24 hours):**
   ```
   1. Azure Portal → App Registrations → AIP Platform
   2. Certificates & Secrets
   3. Find old secret (previous description/date)
   4. Click "Delete"
   5. Confirm deletion
   ```

**When to Rotate:**
- Every 180 days (scheduled)
- When Azure security alert received
- After employee with access leaves

---

### 3. Database Password Rotation

**Impact:** 🔴 **Platform downtime during rotation**  
**Downtime:** 5-10 minutes  
**Duration:** 20 minutes  
**Timing:** Off-peak hours (2am-4am UTC)

**Prerequisites:**
- Azure Portal access
- Database admin rights
- Maintenance window scheduled

**Steps:**

1. **Announce Maintenance:**
   ```
   "Scheduled maintenance: 2026-09-13 2:00-2:30 AM UTC.
   Platform will be unavailable for ~10 minutes.
   Database maintenance."
   ```

2. **Create New Password:**
   ```bash
   # Generate strong password (16 chars, alphanumeric + symbols)
   NEW_DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
   echo "New DB Password: $NEW_DB_PASSWORD"
   ```

3. **Update in Azure:**
   ```
   1. Azure Portal → AIP-RG → aip-db
   2. Settings → Reset password
   3. Enter new password (use generated one)
   4. Save
   ```

4. **Update DATABASE_URL:**
   ```bash
   # Build new connection string
   NEW_URL="postgresql://aip_user:${NEW_DB_PASSWORD}@aip-db.postgres.database.azure.com:5432/aip_frontend?sslmode=require&connection_limit=20"
   
   # Update in Vercel
   vercel env rm DATABASE_URL production --yes
   echo $NEW_URL | vercel env add DATABASE_URL production
   ```

5. **Redeploy & Test:**
   ```bash
   # Deploy
   vercel --prod
   
   # Wait 2 minutes, then test
   curl https://app.africa-infra.com/api/health
   # Should show database: healthy
   ```

6. **Verify Operations:**
   - [ ] Health check passes
   - [ ] Can create project
   - [ ] Can view projects
   - [ ] Can login/logout

**When to Rotate:**
- Every 90 days (scheduled)
- Immediately if password exposed
- After DBA leaves team

---

### 4. Anthropic API Key Rotation

**Impact:** ✅ No user impact  
**Downtime:** None  
**Duration:** 5 minutes

```bash
# 1. Generate new key at console.anthropic.com
#    - Go to Settings → API Keys
#    - Create new key: "AIP-Platform-2026-09-13"
#    - Copy the key (starts with sk-ant-)

# 2. Update Vercel
vercel env rm ANTHROPIC_API_KEY production --yes
echo "[NEW_KEY]" | vercel env add ANTHROPIC_API_KEY production

# 3. Redeploy
vercel --prod

# 4. Test AI generation
curl -X POST https://app.africa-infra.com/api/ai/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'

# 5. Delete old key in Anthropic console (after 24h)
```

**When to Rotate:**
- On demand (no fixed schedule)
- Immediately if key appears in logs
- Immediately if unusual API usage detected
- When employee with access leaves

---

### 5. Emergency Rotation (Compromise Response)

**Use When:** Secret exposed in logs, committed to git, or breach detected

**Immediate Actions (0-15 minutes):**

```bash
# 1. Run emergency rotation script
./scripts/rotate-secrets.sh --emergency

# 2. Revoke compromised secret immediately
#    - Vercel: Delete env var
#    - Azure: Delete secret/reset password
#    - Anthropic: Revoke key

# 3. Deploy new secrets
vercel --prod

# 4. Monitor for abuse
#    - Check Anthropic usage dashboard
#    - Check Azure login attempts
#    - Check database connection attempts
#    - Check Sentry for auth errors

# 5. Notify security team
#    - Email: security@africa-infra.com
#    - Slack: #security
#    - Document incident
```

**Post-Incident (24-48 hours):**
- [ ] Write incident report
- [ ] Review how secret was exposed
- [ ] Update secret scanning rules
- [ ] Update this runbook if needed

---

## Automated Secret Rotation Script

Save as `scripts/rotate-secrets.sh`:

```bash
#!/bin/bash
# AIP Platform Secrets Rotation Script
# Usage: ./scripts/rotate-secrets.sh [--emergency]

set -e

EMERGENCY=false
if [[ "$1" == "--emergency" ]]; then
  EMERGENCY=true
  echo "⚠️  EMERGENCY ROTATION MODE"
fi

echo "🔐 Starting AIP Platform Secrets Rotation"
echo "⚠️  This will invalidate all active user sessions"
echo ""

if [ "$EMERGENCY" = false ]; then
  read -p "Continue? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Rotation cancelled"
    exit 1
  fi
fi

# Check prerequisites
if ! command -v vercel &> /dev/null; then
  echo "❌ Vercel CLI not found. Install: npm i -g vercel"
  exit 1
fi

if ! command -v openssl &> /dev/null; then
  echo "❌ OpenSSL not found"
  exit 1
fi

# Generate new NEXTAUTH_SECRET
NEW_SECRET=$(openssl rand -base64 32)
echo "✅ Generated new NEXTAUTH_SECRET"

# Update in Vercel
echo "📤 Updating Vercel environment..."
vercel env rm NEXTAUTH_SECRET production --yes
echo $NEW_SECRET | vercel env add NEXTAUTH_SECRET production
echo "✅ NEXTAUTH_SECRET rotated in Vercel"

# Redeploy
echo "🚀 Deploying new version..."
vercel --prod --yes

echo ""
echo "✅ Secret rotation complete"
echo "⚠️  All users will need to log in again"
echo "⚠️  Monitor Sentry for authentication errors"
echo ""
echo "📝 Post-rotation checklist:"
echo "  [ ] Update docs/security/secrets-rotation.md with new rotation date"
echo "  [ ] Test login flow"
echo "  [ ] Monitor Sentry dashboard for 30 minutes"
echo "  [ ] Update CHANGELOG.md"
```

Make executable:
```bash
chmod +x scripts/rotate-secrets.sh
```

---

## Secret Storage Best Practices

### ✅ DO:
- Store secrets in Vercel environment variables only
- Use different secrets for development/staging/production
- Document rotation dates in this file
- Use secret scanning tools (TruffleHog)
- Rotate immediately if compromised
- Use strong random generation (openssl, crypto)
- Set appropriate expiration dates

### ❌ DON'T:
- Never commit secrets to git
- Never log secrets (even masked)
- Never share secrets via email/Slack
- Never reuse secrets across services
- Never use weak passwords
- Never skip rotation schedule
- Never store secrets in code comments

---

## Secret Scanning

### Pre-Commit Hook

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Scan for secrets before commit

if git diff --cached --name-only | grep -E '\.(ts|js|tsx|jsx|json|env)$' > /dev/null; then
  echo "🔍 Scanning for secrets..."
  
  # Check for common secret patterns
  if git diff --cached | grep -E '(sk-ant-|AKIA|ghp_|xox[bp]-|-----BEGIN)' > /dev/null; then
    echo "❌ Potential secret detected in staged files!"
    echo "Run: git diff --cached | grep -E '(sk-ant-|AKIA)'"
    exit 1
  fi
  
  echo "✅ No secrets detected"
fi
```

### CI/CD Secret Scanning

Add to `.github/workflows/ci-cd.yml`:
```yaml
- name: Scan for secrets
  run: |
    npm install -g @trufflesecurity/trufflehog
    trufflehog filesystem . --only-verified --fail
```

---

## Compliance Requirements

### SOC 2 Type II
- [ ] Secrets rotated per schedule
- [ ] Rotation documented
- [ ] Access controls in place
- [ ] Audit trail maintained

### ISO 27001
- [ ] Cryptographic key management policy
- [ ] Secret rotation procedure
- [ ] Emergency response plan
- [ ] Annual security review

### GDPR
- [ ] Encryption keys for PII data
- [ ] Key escrow for data recovery
- [ ] Right to erasure compliance

---

## Rotation Checklist

### Quarterly (Every 90 Days)
- [ ] Rotate NEXTAUTH_SECRET
- [ ] Rotate DATABASE_URL password
- [ ] Review access logs
- [ ] Update this document

### Bi-Annually (Every 180 Days)
- [ ] Rotate AZURE_AD_CLIENT_SECRET
- [ ] Rotate UPSTASH_REDIS_REST_TOKEN
- [ ] Rotate RESEND_API_KEY
- [ ] Rotate AZURE_STORAGE_CONNECTION
- [ ] Audit all secrets inventory

### Annually
- [ ] Review rotation policy
- [ ] Update procedures
- [ ] Security team training
- [ ] Compliance audit

---

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Security Lead | [security@africa-infra.com] | 24/7 |
| Database Admin | [dba@africa-infra.com] | Business hours |
| DevOps Lead | [devops@africa-infra.com] | 24/7 |

---

**Next Scheduled Rotation:** 2026-12-13 (NEXTAUTH_SECRET, DATABASE_URL)  
**Last Security Audit:** 2026-09-13  
**Policy Review Due:** 2027-09-13
