# Rollback Procedure - AIP Platform

**Purpose:** Step-by-step instructions for rolling back deployments and database changes in production.

**Last Updated:** 2026-09-13  
**Platform:** Vercel + Azure PostgreSQL

---

## 🚨 When to Rollback

Execute rollback if:
- **Critical bug** causes data loss or corruption
- **Service outage** affecting 50%+ of users
- **Security vulnerability** exploited in production
- **Database migration** fails or corrupts data
- **Performance degradation** >10x slower than baseline

**Do NOT rollback for:**
- Minor UI bugs (fix forward instead)
- Single user issues (investigate first)
- Known issues with workarounds
- Non-critical feature bugs

---

## ⚡ Quick Rollback (< 5 minutes)

### Step 1: Identify Last Working Deployment

```bash
# List recent deployments
vercel ls --limit 10

# Find the last "● Ready" deployment before the broken one
# Example output:
#   Age     Status      URL
#   2m      ● Error     https://aip-abc123.vercel.app
#   15m     ● Ready     https://aip-def456.vercel.app  ← ROLLBACK TO THIS
```

### Step 2: Promote Previous Deployment

```bash
# Option A: Via Vercel CLI (fastest)
vercel promote https://aip-def456.vercel.app --yes

# Option B: Via Vercel Dashboard
# 1. Go to https://vercel.com/sacksons-projects/aip/deployments
# 2. Find the working deployment
# 3. Click "..." → "Promote to Production"
```

### Step 3: Verify Rollback

```bash
# Check production is serving rolled-back version
curl -I https://app.africa-infra.com

# Test health endpoint
curl https://app.africa-infra.com/api/health

# Expected: 200 OK with status: "healthy"
```

**⏱️ Total Time:** 2-5 minutes

---

## 🗄️ Database Migration Rollback

### Prerequisites

```bash
# Requires production DATABASE_URL with write access
export DATABASE_URL="postgresql://user:pass@host:5432/aip_production"

# Backup first (CRITICAL)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 1: Identify Migration to Revert

```bash
# List applied migrations
npx prisma migrate status

# Example output:
# ✓ 20260911_add_financial_check_constraints
# ✓ 20260913_add_milestone_archive_fields
# ✓ 20260913_add_idempotency_records  ← REVERT THIS
```

### Step 2: Mark Migration as Rolled Back

```bash
# Tell Prisma the migration is rolled back (doesn't actually revert DB)
npx prisma migrate resolve --rolled-back 20260913_add_idempotency_records
```

### Step 3: Manually Revert Database Changes

```sql
-- Connect to production database
psql $DATABASE_URL

-- For Idempotency Records migration:
DROP TABLE IF EXISTS "IdempotencyRecord";

-- For Milestone Archive Fields migration:
ALTER TABLE "Milestone" 
  DROP COLUMN IF EXISTS "archived",
  DROP COLUMN IF EXISTS "archivedAt";

-- For Financial Check Constraints:
-- (Check constraint names first)
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'Investor' AND constraint_type = 'CHECK';

-- Then drop them
ALTER TABLE "Investor" DROP CONSTRAINT IF EXISTS "Investor_minTicket_check";
-- Repeat for all financial constraints
```

### Step 4: Verify Revert

```bash
# Check Prisma sees correct state
npx prisma migrate status

# Should show rolled-back migration as pending
```

**⚠️ WARNING:** Always test rollback in staging first if time permits.

---

## 🔄 Full Stack Rollback (Deployment + Database)

**Scenario:** Both code and database need to revert together.

### Step 1: Create Database Backup

```bash
# CRITICAL: Always backup before rollback
pg_dump $DATABASE_URL > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file size
ls -lh emergency_backup_*.sql
```

### Step 2: Revert Database First

```bash
# Mark migrations as rolled back
npx prisma migrate resolve --rolled-back <migration_name>

# Manually revert SQL changes (see Database Migration Rollback section)
psql $DATABASE_URL < rollback_script.sql
```

### Step 3: Rollback Deployment

```bash
# Find deployment from BEFORE the problematic migrations
vercel ls --limit 20

# Promote stable deployment
vercel promote https://aip-<stable-id>.vercel.app --yes
```

### Step 4: Verify Both Layers

```bash
# Test database schema
npx prisma db pull
git diff prisma/schema.prisma  # Should match expected state

# Test application
curl https://app.africa-infra.com/api/health
curl https://app.africa-infra.com/api/projects?limit=1
```

**⏱️ Total Time:** 15-30 minutes

---

## 💾 Restore from Backup

**Scenario:** Catastrophic data loss requires full database restore.

### Prerequisites

- Recent backup file (`.sql` dump)
- Production DATABASE_URL with SUPERUSER privileges
- Downtime window (application will be unavailable)

### Step 1: Stop Application Traffic

```bash
# Option A: Set maintenance mode (if available)
vercel env add MAINTENANCE_MODE true production

# Option B: Temporarily disable deployment
# Go to Vercel dashboard → Settings → "Pause Deployments"
```

### Step 2: Restore Database

```bash
# CRITICAL: This will DROP and recreate the database
# Confirm you have the right backup file

# Drop existing database (DESTRUCTIVE)
dropdb -h <host> -U <user> aip_production

# Create fresh database
createdb -h <host> -U <user> aip_production

# Restore from backup
psql $DATABASE_URL < backup_20260913_120000.sql

# Verify row counts
psql $DATABASE_URL -c "SELECT 'users', COUNT(*) FROM \"User\";"
psql $DATABASE_URL -c "SELECT 'projects', COUNT(*) FROM \"Project\";"
```

### Step 3: Run Migrations (if needed)

```bash
# Apply any migrations that should be present
npx prisma migrate deploy
```

### Step 4: Resume Application

```bash
# Remove maintenance mode
vercel env rm MAINTENANCE_MODE production

# Or re-enable deployments in dashboard

# Verify application works
curl https://app.africa-infra.com/api/health
```

**⏱️ Total Time:** 30-60 minutes (depends on database size)

---

## 📊 Post-Rollback Checklist

After any rollback, verify:

- [ ] Health endpoint returns 200 OK
- [ ] User authentication works (sign in/out)
- [ ] Database queries execute without errors
- [ ] No increase in error rate (check Sentry)
- [ ] Response times normal (check logs)
- [ ] Cron jobs still scheduled
- [ ] External APIs still work (Resend, Azure AD)

**Monitoring Commands:**

```bash
# Watch logs in real-time
vercel logs https://app.africa-infra.com --follow

# Check recent errors
vercel logs https://app.africa-infra.com --since 30m | grep -i error

# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s https://app.africa-infra.com/api/health
```

---

## 🔍 Root Cause Analysis

After rollback, investigate:

1. **What changed?**
   - Compare commits: `git diff <stable> <broken>`
   - Check deployment logs: `vercel inspect <url> --logs`

2. **What broke?**
   - Review error logs in Sentry
   - Check database query logs
   - Analyze user reports

3. **How to prevent?**
   - Add test coverage for failure case
   - Update staging deployment process
   - Add monitoring alert

**Document in:** `postmortem_<YYYY-MM-DD>.md`

---

## 📞 Emergency Contacts

**Production Issues:**
- Primary: [Your Name] - [Email/Phone]
- Secondary: [Backup Contact]
- Vercel Support: https://vercel.com/support

**Database Issues:**
- Azure Support: https://portal.azure.com/
- DBA On-Call: [Contact Info]

**Security Issues:**
- Security Team: security@africa-infra.com
- Sentry Alerts: [Sentry Dashboard URL]

---

## 📝 Rollback Templates

### Git Revert

```bash
# Revert last commit
git revert HEAD

# Revert specific commit
git revert <commit-hash>

# Revert multiple commits
git revert <oldest-hash>..<newest-hash>

# Push revert
git push origin main
```

### Database Rollback Script Template

```sql
-- rollback_<migration_name>.sql
-- Purpose: Revert migration <migration_name>
-- Date: <YYYY-MM-DD>
-- Author: <Your Name>

BEGIN;

-- Revert changes here
-- Example:
-- DROP TABLE IF EXISTS "NewTable";
-- ALTER TABLE "ExistingTable" DROP COLUMN IF EXISTS "new_column";

-- Verify revert
SELECT COUNT(*) AS user_count FROM \"User\";
SELECT COUNT(*) AS project_count FROM \"Project\";

-- If counts look wrong, ROLLBACK instead of COMMIT
COMMIT;
```

---

## 🎯 Best Practices

1. **Always backup before rollback**
   - Automated: pg_dump runs daily at 2AM UTC
   - Manual: `pg_dump $DATABASE_URL > backup.sql`

2. **Test rollback in staging first** (if time permits)
   - Verify rollback script works
   - Check for data loss
   - Measure downtime

3. **Communicate early and often**
   - Notify team before rollback
   - Update status page
   - Post-mortem after resolution

4. **Document everything**
   - What was rolled back
   - Why it was necessary
   - What was learned

5. **Practice rollbacks**
   - Monthly rollback drill in staging
   - Update this document with learnings

---

## 🚀 Recovery Time Objectives

| Scenario | Target RTO | Target RPO |
|----------|------------|------------|
| **Deployment Rollback** | < 5 minutes | 0 (no data loss) |
| **Database Migration Revert** | < 30 minutes | 0 (no data loss) |
| **Full Database Restore** | < 1 hour | < 24 hours (daily backups) |
| **Complete Disaster Recovery** | < 4 hours | < 24 hours |

**RTO:** Recovery Time Objective (how long until restored)  
**RPO:** Recovery Point Objective (how much data loss acceptable)

---

**Last Tested:** 2026-09-13  
**Next Review:** 2026-10-13  
**Owner:** Senior DevOps / Platform Team
