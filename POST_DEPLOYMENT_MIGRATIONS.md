# Post-Deployment Database Migrations

**Status:** PENDING - Must be applied to production database

## Migrations to Apply

Run these in order after deployment:

```bash
# Connect to production database
npx prisma migrate deploy
```

### 1. Financial Constraints (20260911_add_financial_check_constraints.sql)
- Adds check constraints for financial validation
- Ensures minTicket ≤ maxTicket
- Ensures revenue/cost/funding are non-negative
- Prevents invalid percentage values

### 2. Milestone Archive Fields (20260913_add_milestone_archive_fields)
- Adds `archived` BOOLEAN field (default: false)
- Adds `archivedAt` TIMESTAMP field
- Required for soft delete cascade to work correctly

### 3. Idempotency Records (20260913_add_idempotency_records)
- Creates IdempotencyRecord table
- Prevents duplicate submissions from double-clicks
- Expires records automatically via expiresAt index

## Verification After Applying

```sql
-- Verify milestone fields exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Milestone' 
  AND column_name IN ('archived', 'archivedAt');

-- Verify IdempotencyRecord table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'IdempotencyRecord';

-- Verify financial constraints exist
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public';
```

## Rollback Plan

If issues occur:

```bash
# Revert last migration
npx prisma migrate resolve --rolled-back <migration-name>

# Then fix and reapply
npx prisma migrate deploy
```

## Environment Requirements

- Production DATABASE_URL with write access
- Prisma CLI: `npx prisma@6.19.3`
- Estimated downtime: < 5 seconds
- Backup recommended before applying

## Post-Migration Tasks

1. Monitor application logs for schema errors
2. Test soft delete operations on projects
3. Verify financial validation in project creation
4. Test idempotency on duplicate submissions
