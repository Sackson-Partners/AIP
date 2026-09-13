# Consistent Soft Delete Pattern

**Date:** 2026-09-11  
**Feature:** Task #18 - Consistent Soft Delete Pattern  
**Impact:** 🗑️ No orphaned data, consistent archiving, audit trail

---

## Overview

Soft delete (archiving) allows "deleting" records without permanently removing them from the database. This provides:
- **Data recovery** - Restore accidentally deleted items
- **Audit trail** - Track when and why items were archived
- **Referential integrity** - No broken foreign key relationships
- **Cascade archiving** - Automatically archive related entities

---

## Database Schema

### Archived Fields Pattern

**Standard Fields:**
```prisma
model Project {
  // ... other fields
  archived   Boolean   @default(false)
  archivedAt DateTime?
  archivedBy String?   // User ID who archived
  
  @@index([archived, status])  // Query performance
}
```

**Models with Soft Delete:**
- `Project` - Main entity with cascade support
- `Investor` - Investment profiles
- `Document` - Project documents
- `DealRoom` - Deal room spaces
- `Milestone` - Project milestones

---

## Core Functions

### archiveProject()

**Purpose:** Archive a project and optionally cascade to related entities

**Signature:**
```typescript
archiveProject(
  projectId: string,
  options: SoftDeleteOptions
): Promise<SoftDeleteResult>
```

**Options:**
```typescript
interface SoftDeleteOptions {
  archivedBy: string        // User ID performing archive
  reason?: string           // Optional reason
  cascade?: boolean         // Cascade to related entities (default: true)
  auditLog?: boolean        // Create audit log entry (default: true)
}
```

**Result:**
```typescript
interface SoftDeleteResult {
  success: boolean
  archivedCount: number
  cascadedEntities?: {
    milestones: number
    documents: number
    dealRooms: number
    verifications: number
  }
  error?: string
}
```

**Example:**
```typescript
import { archiveProject } from '@/lib/soft-delete'

const result = await archiveProject('proj-123', {
  archivedBy: 'user-456',
  reason: 'Project cancelled due to budget constraints',
  cascade: true,
  auditLog: true,
})

// Result:
// {
//   success: true,
//   archivedCount: 1,
//   cascadedEntities: {
//     milestones: 5,
//     documents: 12,
//     dealRooms: 1,
//     verifications: 2
//   }
// }
```

---

### Cascade Behavior

**What gets archived when cascading:**

1. **Milestones** - All non-archived milestones
2. **Documents** - All non-archived documents
3. **Deal Rooms** - All non-archived deal rooms
4. **Verifications** - Cancelled (not archived, status set to CANCELLED)

**What does NOT get archived:**
- Users (owners, reviewers)
- Comments (kept for audit trail)
- Activity logs (kept for audit trail)
- Watchlist entries (users can still track archived projects)

---

### restoreProject()

**Purpose:** Restore an archived project

**Signature:**
```typescript
restoreProject(
  projectId: string,
  restoredBy: string,
  cascade: boolean = true
): Promise<SoftDeleteResult>
```

**Example:**
```typescript
import { restoreProject } from '@/lib/soft-delete'

const result = await restoreProject('proj-123', 'admin-789', true)

// Result:
// {
//   success: true,
//   archivedCount: 1,
//   cascadedEntities: {
//     milestones: 5,
//     documents: 12,
//     dealRooms: 1
//   }
// }
```

**Notes:**
- Only admins can restore archived projects (enforced in API)
- Cascade restore is optional (default: true)
- Creates audit log entry

---

### archiveInvestor()

**Purpose:** Archive an investor profile

**Example:**
```typescript
import { archiveInvestor } from '@/lib/soft-delete'

const result = await archiveInvestor('inv-123', {
  archivedBy: 'admin-456',
  reason: 'Investor no longer active',
  auditLog: true,
})
```

**No cascading:** Investor profiles don't cascade archive (projects remain active)

---

### archiveDocument()

**Purpose:** Archive a single document

**Example:**
```typescript
import { archiveDocument } from '@/lib/soft-delete'

const result = await archiveDocument('doc-123', {
  archivedBy: 'user-456',
  reason: 'Outdated document',
  auditLog: true,
})
```

---

## API Endpoints

### POST /api/projects/[id]/archive

**Archive a project**

**Request:**
```bash
curl -X POST https://app.africa-infra.com/api/projects/proj-123/archive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Project cancelled"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "archived": true,
    "projectId": "proj-123",
    "projectCode": "AIP-2025-089",
    "cascaded": {
      "milestones": 5,
      "documents": 12,
      "dealRooms": 1,
      "verifications": 2
    }
  },
  "message": "Project archived successfully"
}
```

**Authorization:**
- Project owner can archive own projects
- Admins can archive any project

---

### DELETE /api/projects/[id]/archive

**Restore an archived project**

**Request:**
```bash
curl -X DELETE https://app.africa-infra.com/api/projects/proj-123/archive \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "archived": false,
    "projectId": "proj-123",
    "projectCode": "AIP-2025-089",
    "cascaded": {
      "milestones": 5,
      "documents": 12,
      "dealRooms": 1
    }
  },
  "message": "Project restored successfully"
}
```

**Authorization:**
- Only SUPER_ADMIN and ADMIN can restore projects

---

## Query Helpers

### Exclude Archived by Default

**Prisma Middleware (Automatic Filtering):**

```typescript
import { addSoftDeleteMiddleware } from '@/lib/soft-delete'

// In src/lib/prisma.ts
addSoftDeleteMiddleware(prisma)

// Now all queries automatically exclude archived
const projects = await prisma.project.findMany()
// WHERE archived = false (automatic)

const project = await prisma.project.findUnique({ where: { id: 'proj-123' } })
// WHERE id = 'proj-123' AND archived = false (automatic)
```

**Benefits:**
- No need to manually add `archived: false` to every query
- Prevents accidentally showing archived items
- Consistent behavior across all queries

---

### Include Archived (Override Middleware)

```typescript
import { includeArchived } from '@/lib/soft-delete'

// Show both archived and non-archived
const allProjects = await prisma.project.findMany(includeArchived())

// Filter by status but include archived
const closedProjects = await prisma.project.findMany(
  includeArchived({ status: 'CLOSED' })
)
```

---

### Only Archived

```typescript
import { onlyArchived } from '@/lib/soft-delete'

// Show only archived projects
const archivedProjects = await prisma.project.findMany(onlyArchived())

// Archived projects in a specific country
const archivedKenya = await prisma.project.findMany(
  onlyArchived({ country: 'Kenya' })
)
```

---

## Cleanup (Hard Delete)

### cleanupArchivedProjects()

**Purpose:** Permanently delete archived projects older than N days

**Example:**
```typescript
import { cleanupArchivedProjects } from '@/lib/soft-delete'

// Delete projects archived more than 365 days ago
const deletedCount = await cleanupArchivedProjects(365, 'system')

// Result: 12 (12 projects permanently deleted)
```

**Use Cases:**
- Compliance (GDPR data retention policies)
- Database cleanup (remove old archived data)
- Storage management

**Warning:** This is a **permanent deletion** (hard delete). Use with caution.

**Recommended Schedule:**
- Run quarterly or annually
- Only delete projects archived > 1 year ago
- Create manual backup before running

---

## Monitoring

### getArchivedCounts()

**Purpose:** Get count of archived entities

**Example:**
```typescript
import { getArchivedCounts } from '@/lib/soft-delete'

const counts = await getArchivedCounts()

// Result:
// {
//   projects: 45,
//   investors: 12,
//   documents: 234,
//   dealRooms: 8,
//   milestones: 156
// }
```

**Dashboard Display:**
```
Archived Items:
- Projects: 45
- Investors: 12
- Documents: 234
- Deal Rooms: 8
- Milestones: 156
```

---

## Audit Trail

### Automatic Audit Logging

**Every archive/restore creates audit log:**

```typescript
await createAuditLog({
  userId: 'user-456',
  action: 'PROJECT_ARCHIVED',
  tableName: 'Project',
  recordId: 'proj-123',
  newValues: {
    archived: true,
    reason: 'Project cancelled',
    cascaded: true,
  },
})
```

**Query Audit Logs:**
```sql
SELECT * FROM "AuditLog"
WHERE action IN ('PROJECT_ARCHIVED', 'PROJECT_RESTORED')
ORDER BY "createdAt" DESC;
```

**Example Audit Trail:**
```
2026-09-11 10:30:00 | user-456 | PROJECT_ARCHIVED  | proj-123 | Reason: Project cancelled
2026-09-12 14:15:00 | admin-789| PROJECT_RESTORED  | proj-123 | Restored by admin
2026-09-15 09:00:00 | user-456 | PROJECT_ARCHIVED  | proj-123 | Reason: Duplicate entry
```

---

## Use Cases

### Use Case 1: Cancel Project Mid-Development

**Scenario:** Client cancels project during feasibility stage.

**Action:**
```typescript
await archiveProject('proj-123', {
  archivedBy: 'user-456',
  reason: 'Client budget constraints',
  cascade: true,
})
```

**Result:**
- Project archived
- All milestones archived
- All documents archived
- Deal room archived
- Verification cancelled
- Users can still view project history if needed

---

### Use Case 2: Duplicate Project Entry

**Scenario:** Team accidentally creates duplicate project.

**Action:**
```typescript
await archiveProject('proj-duplicate', {
  archivedBy: 'admin-789',
  reason: 'Duplicate of proj-123',
  cascade: true,
})
```

**Result:**
- Duplicate archived
- Original project remains active
- No data loss (can restore if mistake)

---

### Use Case 3: Investor Profile Cleanup

**Scenario:** Investor no longer active in platform.

**Action:**
```typescript
await archiveInvestor('inv-456', {
  archivedBy: 'admin-789',
  reason: 'Inactive for > 2 years',
})
```

**Result:**
- Investor profile archived
- Projects remain active (no cascade)
- Can restore if investor returns

---

### Use Case 4: Accidental Archive (Restore)

**Scenario:** User accidentally archives active project.

**Action:**
```typescript
await restoreProject('proj-123', 'admin-789', true)
```

**Result:**
- Project restored
- All related entities restored
- Audit log shows archive + restore history

---

## Benefits

### 1. Data Recovery ✅

**Problem:** User accidentally deletes important project.

**Solution:** Restore from archive instead of database backup.

```typescript
// Instant restore (no database backup needed)
await restoreProject('proj-123', 'admin-789', true)
```

---

### 2. Referential Integrity ✅

**Problem:** Hard delete causes foreign key errors.

**Before (Hard Delete):**
```sql
DELETE FROM "Project" WHERE id = 'proj-123';
-- ERROR: violates foreign key constraint "Milestone_projectId_fkey"
```

**After (Soft Delete):**
```typescript
// No foreign key errors - data still exists
await archiveProject('proj-123', { archivedBy: 'user-456' })
```

---

### 3. Cascade Archiving ✅

**Problem:** Orphaned related entities after project archive.

**Solution:** Automatic cascade to milestones, documents, deal rooms.

```typescript
// One call archives everything
await archiveProject('proj-123', {
  archivedBy: 'user-456',
  cascade: true, // Automatic
})
```

---

### 4. Audit Trail ✅

**Problem:** No record of why project was deleted.

**Solution:** Audit log with reason and timestamp.

```
Who: user-456
What: PROJECT_ARCHIVED
When: 2026-09-11 10:30:00
Why: Project cancelled due to budget constraints
```

---

### 5. Query Performance ✅

**Index on archived field:**
```prisma
@@index([archived, status])
```

**Fast queries:**
```sql
-- Efficient query (uses index)
SELECT * FROM "Project"
WHERE archived = false AND status = 'ACTIVE';
```

---

## Testing

### Test 1: Archive Project with Cascade
```bash
curl -X POST https://app.africa-infra.com/api/projects/proj-123/archive \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"reason": "Test archive"}'

# Expected: 200 OK
# {
#   "success": true,
#   "data": {
#     "archived": true,
#     "cascaded": { "milestones": 5, "documents": 12 }
#   }
# }

# Verify: Project queries no longer return this project
curl https://app.africa-infra.com/api/projects
# Project should not appear in list
```

---

### Test 2: Restore Project
```bash
curl -X DELETE https://app.africa-infra.com/api/projects/proj-123/archive \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK
# {
#   "success": true,
#   "data": {
#     "archived": false,
#     "cascaded": { "milestones": 5, "documents": 12 }
#   }
# }

# Verify: Project appears in queries again
curl https://app.africa-infra.com/api/projects
# Project should appear in list
```

---

### Test 3: Non-Owner Cannot Archive
```bash
curl -X POST https://app.africa-infra.com/api/projects/proj-123/archive \
  -H "Authorization: Bearer $OTHER_USER_TOKEN"

# Expected: 403 Forbidden
# {
#   "success": false,
#   "error": {
#     "code": "FORBIDDEN",
#     "message": "Only project owner or admins can archive projects"
#   }
# }
```

---

### Test 4: Non-Admin Cannot Restore
```bash
curl -X DELETE https://app.africa-infra.com/api/projects/proj-123/archive \
  -H "Authorization: Bearer $USER_TOKEN"

# Expected: 403 Forbidden
# {
#   "success": false,
#   "error": {
#     "code": "FORBIDDEN",
#     "message": "Only admins can restore archived projects"
#   }
# }
```

---

## Summary

Consistent soft delete pattern provides **safe, recoverable, auditable** deletion with cascade support.

**Key Features:**
- ✅ Soft delete (archive) instead of hard delete
- ✅ Cascade archiving to related entities
- ✅ Restore functionality
- ✅ Automatic audit trail
- ✅ Query helpers (includeArchived, onlyArchived)
- ✅ Prisma middleware for automatic filtering
- ✅ Cleanup utility for old archived data

**Functions:**
- ✅ `archiveProject()` - Archive with cascade
- ✅ `restoreProject()` - Restore with cascade
- ✅ `archiveInvestor()` - Archive investor profile
- ✅ `archiveDocument()` - Archive document
- ✅ `cleanupArchivedProjects()` - Hard delete old archives
- ✅ `getArchivedCounts()` - Monitoring

**API Endpoints:**
- ✅ `POST /api/projects/[id]/archive` - Archive project
- ✅ `DELETE /api/projects/[id]/archive` - Restore project

**Benefits:**
- 🗑️ Data recovery (undo accidental deletes)
- 🗑️ Referential integrity (no foreign key errors)
- 🗑️ Cascade archiving (no orphaned data)
- 🗑️ Audit trail (who, what, when, why)
- 🗑️ Query performance (indexed)

---

**Last Updated:** 2026-09-11  
**Status:** ✅ COMPLETED  
**Task:** #18 - Consistent Soft Delete Pattern
