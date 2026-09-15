# CRITICAL: Database Migration Required

**Date:** September 15, 2026 16:51 UTC  
**Status:** 🚨 PRODUCTION BLOCKED - DATABASE OUT OF SYNC  
**Severity:** P0 - ALL AUTHENTICATION BROKEN

---

## ROOT CAUSE

**Database schema is out of sync with code:**

Code expects (in schema.prisma):
```prisma
model User {
  sessionVersion Int @default(1)
  // ... other fields
}
```

Database has:
```sql
-- Column `User.sessionVersion` DOES NOT EXIST
```

**Error:**
```
Invalid `prisma.user.findUnique()` invocation:
The column `User.sessionVersion` does not exist in the current database.
```

---

## IMPACT

❌ **All authentication broken:**
- Staff login fails
- Partner login fails
- Microsoft login fails
- Request invitation fails

❌ **Logo not visible:**
- Middleware redirects /aip-logo.jpeg to auth
- Requires authentication to view static file

---

## IMMEDIATE FIX REQUIRED

### Step 1: Generate Migration (Local)

```bash
# Navigate to project directory
cd /Users/sackson/AIP/AIP-1

# Generate migration for sessionVersion
npx prisma migrate dev --name add_session_version_column

# This will:
# 1. Compare schema.prisma with database
# 2. Generate SQL migration
# 3. Apply to local database
```

### Step 2: Deploy Migration to Production

**Option A: Via Vercel (RECOMMENDED)**

Add this to your build command or create a migration endpoint:

```bash
# In production, run:
npx prisma migrate deploy
```

**Option B: Run Migration SQL Directly**

If Prisma migrate isn't working, run this SQL directly:

```sql
-- Add sessionVersion column to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Create index for performance
CREATE INDEX IF NOT EXISTS "User_sessionVersion_idx" 
ON "User"("sessionVersion");
```

**Option C: Use Vercel Admin Migration Endpoint**

```bash
# Call the migration endpoint
curl -X POST https://app.africa-infra.com/api/admin/run-migrations \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## STEP-BY-STEP INSTRUCTIONS

### Method 1: Local Migration + Deploy (SAFEST)

```bash
# 1. Generate migration locally
cd /Users/sackson/AIP/AIP-1
npx prisma migrate dev --name add_session_version

# 2. Review generated migration
cat prisma/migrations/XXXXXX_add_session_version/migration.sql

# 3. Commit migration
git add prisma/migrations/
git commit -m "feat: add sessionVersion column migration"
git push origin main

# 4. Deploy (migrations run automatically on build)
vercel --prod
```

### Method 2: Run SQL Directly (FASTEST)

```bash
# Connect to your PostgreSQL database
psql "$DATABASE_URL"

# Run this SQL:
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

# Verify:
\d "User"

# Should see sessionVersion column
```

### Method 3: Use Prisma Studio (VISUAL)

```bash
# Open Prisma Studio
npx prisma studio

# But this won't add the column - you need migration
```

---

## WHY THIS HAPPENED

**Possible causes:**

1. **Migration not run after schema change**
   - Schema updated with sessionVersion
   - Migration generated but not applied to production

2. **Production database rollback**
   - Database restored from old backup
   - Lost recent schema changes

3. **Migration failed silently**
   - Migration ran but failed
   - Error not caught
   - Code deployed anyway

4. **Wrong database connection**
   - Connecting to old/staging database
   - Not production database

---

## VERIFICATION

After running migration, verify:

```bash
# 1. Check database has column
psql "$DATABASE_URL" -c "\d \"User\"" | grep sessionVersion

# 2. Test authentication
curl https://app.africa-infra.com/api/auth/providers

# 3. Check logs for errors
vercel logs --prod --since 1m | grep -i "sessionVersion"
```

---

## ADDITIONAL FIXES NEEDED

### Fix 1: Logo File Access

**Problem:** `/aip-logo.jpeg` redirecting to auth

**Root cause:** Middleware not excluding static files

**Fix in src/proxy.ts:**

```typescript
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\.jpeg|.*\\.jpg|.*\\.png|.*\\.svg).*)",
  ],
}
```

Or move logo to `/public/images/aip-logo.jpeg` and update references.

### Fix 2: Update Image Paths

If logo moved to `/public/images/`:

```typescript
// In src/app/auth/signin/page.tsx
<Image
  src="/images/aip-logo.jpeg"  // Update path
  alt="Africa Infrastructure Partners"
  width={350}
  height={130}
  priority
/>
```

---

## PRISMA MIGRATE COMMANDS

```bash
# Generate migration (dev)
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (DANGER - dev only)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate
```

---

## PRODUCTION DATABASE ACCESS

**Connect to production database:**

```bash
# Get DATABASE_URL from Vercel
vercel env pull .env.production

# Connect via psql
psql "$(grep DATABASE_URL .env.production | cut -d '=' -f2-)"

# List tables
\dt

# Describe User table
\d "User"

# Check for sessionVersion column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'User' 
AND column_name = 'sessionVersion';
```

---

## ROLLBACK PLAN

If migration fails:

```bash
# Option 1: Revert to code without sessionVersion
git revert <commit-with-sessionVersion>
git push origin main
vercel --prod

# Option 2: Add column manually if migration stuck
psql "$DATABASE_URL"
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;
```

---

## MONITORING AFTER FIX

```bash
# Watch logs for errors
vercel logs --prod --follow

# Test authentication
curl https://app.africa-infra.com/api/auth/providers

# Test login page
curl https://app.africa-infra.com/auth/signin | grep aip-logo

# Check database
psql "$DATABASE_URL" -c "SELECT id, email, sessionVersion FROM \"User\" LIMIT 5;"
```

---

## ESTIMATED TIME TO FIX

| Method | Time | Risk | Complexity |
|--------|------|------|------------|
| Run SQL directly | 2 min | Low | Easy |
| Prisma migrate deploy | 5 min | Medium | Medium |
| Full migration cycle | 15 min | Low | Safe |

**Recommended:** Run SQL directly first for immediate fix, then proper migration later.

---

## IMMEDIATE ACTION

**RIGHT NOW:**

1. Connect to production database:
   ```bash
   psql "$DATABASE_URL"
   ```

2. Run this SQL:
   ```sql
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;
   ```

3. Test authentication:
   ```bash
   curl https://app.africa-infra.com/api/auth/providers
   ```

4. If working, commit proper migration later.

---

**STATUS:** 🚨 BLOCKING - REQUIRES DATABASE ADMIN ACCESS

**PRIORITY:** P0 - Production completely broken

**ETA:** 2-5 minutes (after database access)
