# Project State Machine - Examples & Usage

**Date:** 2026-09-11  
**Feature:** Task #6 - Project State Machine for Status Transitions

---

## Overview

The project state machine enforces valid status transitions and role-based permissions to ensure data integrity and proper workflow compliance.

---

## Valid Status Transitions

```
DRAFT
  ↓ submit
SUBMITTED
  ↓ review
UNDER_REVIEW
  ↓ approve              ↓ reject
APPROVED              REJECTED
  ↓ publish              ↓ revise
ACTIVE ←───────────────┘
  ↓ fund       ↓ hold
FUNDED      ON_HOLD
  ↓             ↓
  └─→ CLOSED ←─┘
```

---

## Status Definitions

| Status | Description | Visibility | Who Can Set |
|--------|-------------|------------|-------------|
| DRAFT | Initial creation, not ready for review | Internal only | Owner, Analysts, Admins |
| SUBMITTED | Submitted for review | Internal only | Owner, Analysts, Admins |
| UNDER_REVIEW | Being reviewed by team | Internal only | Admins |
| APPROVED | Approved but not yet published | Internal only | Admins |
| REJECTED | Rejected after review | Internal only | Admins |
| ACTIVE | Published and visible to partners | **Public** | Admins |
| FUNDED | Project has secured funding | **Public** | Admins, Analysts |
| ON_HOLD | Temporarily paused | **Public** | Admins, Analysts |
| CLOSED | Completed or cancelled | **Public** | Admins |

---

## Role Permissions

### SUPER_ADMIN & ADMIN
- ✅ Can perform **all** transitions
- ✅ Can approve/reject projects
- ✅ Can publish/unpublish projects
- ✅ Can close projects

### ANALYST
- ✅ Can submit projects (DRAFT → SUBMITTED)
- ✅ Can update lifecycle (ACTIVE → FUNDED, ACTIVE → ON_HOLD)
- ✅ Can reactivate from hold (ON_HOLD → ACTIVE)
- ❌ Cannot approve/reject
- ❌ Cannot publish (APPROVED → ACTIVE)
- ❌ Cannot close projects

### PROJECT_OWNER (Non-admin roles)
- ✅ Can work on drafts (DRAFT ↔ DRAFT)
- ❌ Cannot change status (enforced by mass assignment protection)

---

## API Examples

### Valid Transitions

#### 1. Submit Draft for Review (Owner/Analyst)
```bash
PATCH /api/projects/abc123
{
  "status": "SUBMITTED"
}

# Response: 200 OK
# Current: DRAFT → New: SUBMITTED
```

#### 2. Approve Project (Admin Only)
```bash
PATCH /api/projects/abc123
{
  "status": "APPROVED"
}

# Response: 200 OK
# Current: UNDER_REVIEW → New: APPROVED
```

#### 3. Publish Project (Admin Only)
```bash
PATCH /api/projects/abc123
{
  "status": "ACTIVE"
}

# Response: 200 OK
# Current: APPROVED → New: ACTIVE
# Note: Now visible to external partners
```

#### 4. Mark as Funded (Admin/Analyst)
```bash
PATCH /api/projects/abc123
{
  "status": "FUNDED"
}

# Response: 200 OK
# Current: ACTIVE → New: FUNDED
```

---

### Invalid Transitions (Will Fail)

#### 1. Skip Review Process
```bash
PATCH /api/projects/abc123
{
  "status": "ACTIVE"
}

# Response: 422 Validation Failed
# Error: "Invalid status transition: DRAFT → ACTIVE. 
#         Allowed transitions from DRAFT: SUBMITTED, DRAFT"
```

#### 2. Analyst Tries to Approve
```bash
PATCH /api/projects/abc123
{
  "status": "APPROVED"
}

# User Role: ANALYST
# Response: 422 Validation Failed
# Error: "Insufficient permissions: ANALYST cannot perform 
#         UNDER_REVIEW → APPROVED. Required roles: SUPER_ADMIN, ADMIN"
```

#### 3. Direct Publish from Draft
```bash
PATCH /api/projects/abc123
{
  "status": "ACTIVE"
}

# Current: DRAFT
# Response: 422 Validation Failed
# Error: "Invalid status transition: DRAFT → ACTIVE. 
#         Allowed transitions from DRAFT: SUBMITTED, DRAFT"
```

#### 4. Close Funded Project (Non-Admin)
```bash
PATCH /api/projects/abc123
{
  "status": "CLOSED"
}

# User Role: ANALYST
# Response: 422 Validation Failed
# Error: "Insufficient permissions: ANALYST cannot perform 
#         FUNDED → CLOSED. Required roles: SUPER_ADMIN, ADMIN"
```

---

## Common Workflows

### Workflow 1: New Project to Publication
```
1. Owner creates project
   Status: DRAFT

2. Owner/Analyst submits for review
   DRAFT → SUBMITTED

3. Admin moves to review queue
   SUBMITTED → UNDER_REVIEW

4. Admin approves project
   UNDER_REVIEW → APPROVED

5. Admin publishes project
   APPROVED → ACTIVE
   ✅ Now visible to external partners
```

### Workflow 2: Project Lifecycle
```
1. Published project
   Status: ACTIVE

2. Analyst confirms funding secured
   ACTIVE → FUNDED

3. Project encounters issue
   FUNDED → ON_HOLD

4. Issue resolved, reactivate
   ON_HOLD → ACTIVE

5. Project completes
   ACTIVE → CLOSED
```

### Workflow 3: Rejection & Revision
```
1. Project under review
   Status: UNDER_REVIEW

2. Admin rejects (needs more info)
   UNDER_REVIEW → REJECTED

3. Admin allows revision
   REJECTED → DRAFT

4. Owner updates information
   DRAFT → DRAFT (updates)

5. Resubmit for review
   DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ACTIVE
```

---

## Testing the State Machine

### Test 1: Valid Transition Path
```bash
# Start with draft
curl -X PATCH http://localhost:3005/api/projects/test-id \
  -H "Authorization: Bearer $ANALYST_TOKEN" \
  -d '{"status": "SUBMITTED"}'
# Expected: 200 OK

# Admin reviews
curl -X PATCH http://localhost:3005/api/projects/test-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status": "UNDER_REVIEW"}'
# Expected: 200 OK

# Admin approves
curl -X PATCH http://localhost:3005/api/projects/test-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status": "APPROVED"}'
# Expected: 200 OK

# Admin publishes
curl -X PATCH http://localhost:3005/api/projects/test-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status": "ACTIVE"}'
# Expected: 200 OK
```

### Test 2: Invalid Transitions
```bash
# Try to skip review (DRAFT → ACTIVE)
curl -X PATCH http://localhost:3005/api/projects/test-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status": "ACTIVE"}'
# Expected: 422 Validation Failed

# Analyst tries to approve
curl -X PATCH http://localhost:3005/api/projects/test-id \
  -H "Authorization: Bearer $ANALYST_TOKEN" \
  -d '{"status": "APPROVED"}'
# Expected: 422 Validation Failed
```

### Test 3: Role Permissions
```bash
# Regular user tries to change status (blocked by mass assignment)
curl -X PATCH http://localhost:3005/api/projects/test-id \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"status": "ACTIVE"}'
# Expected: 422 Validation Failed (status not allowed in schema)

# Admin can change status
curl -X PATCH http://localhost:3005/api/projects/test-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status": "ACTIVE"}'
# Expected: 200 OK (if transition is valid)
```

---

## Helper Functions

### Get Valid Next States
```typescript
import { getNextStates } from '@/lib/project-state-machine'

// For any user
const allStates = getNextStates('DRAFT')
// Returns: ['SUBMITTED', 'DRAFT']

// For specific role
const analystStates = getNextStates('UNDER_REVIEW', 'ANALYST')
// Returns: ['UNDER_REVIEW'] (can only keep same state)

const adminStates = getNextStates('UNDER_REVIEW', 'ADMIN')
// Returns: ['APPROVED', 'REJECTED', 'UNDER_REVIEW']
```

### Check Status Properties
```typescript
import { 
  isPublishedStatus, 
  isTerminalStatus, 
  getWorkflowStage 
} from '@/lib/project-state-machine'

isPublishedStatus('ACTIVE')   // true (visible to partners)
isPublishedStatus('DRAFT')    // false (internal only)

isTerminalStatus('CLOSED')    // true (end state)
isTerminalStatus('ACTIVE')    // false (can progress)

getWorkflowStage('DRAFT')           // 'draft'
getWorkflowStage('UNDER_REVIEW')    // 'review'
getWorkflowStage('ACTIVE')          // 'published'
getWorkflowStage('CLOSED')          // 'completed'
```

---

## Frontend Integration

### Display Valid Actions
```typescript
import { getNextStates, getStatusLabel } from '@/lib/project-state-machine'

function ProjectActions({ project, userRole }) {
  const validNextStates = getNextStates(project.status, userRole)
  
  return (
    <div>
      <p>Current: {getStatusLabel(project.status)}</p>
      <p>Available actions:</p>
      <ul>
        {validNextStates.map(status => (
          <button key={status} onClick={() => updateStatus(status)}>
            Change to {getStatusLabel(status)}
          </button>
        ))}
      </ul>
    </div>
  )
}
```

### Status Badge with Color
```typescript
import { getStatusColor, getStatusLabel } from '@/lib/project-state-machine'

function StatusBadge({ status }) {
  const color = getStatusColor(status)
  const label = getStatusLabel(status)
  
  return (
    <span className={`badge badge-${color}`}>
      {label}
    </span>
  )
}
```

---

## Audit Trail

All status transitions are logged automatically:

```typescript
await createAuditLog({
  userId: session.user.id,
  email: session.user.email,
  action: 'PROJECT_UPDATED',
  tableName: 'Project',
  recordId: projectId,
  oldValues: { status: 'UNDER_REVIEW' },
  newValues: { status: 'APPROVED' },
})
```

**Query audit logs:**
```sql
SELECT * FROM "AuditLog" 
WHERE "tableName" = 'Project' 
  AND "action" = 'PROJECT_UPDATED'
  AND "oldValues"->>'status' IS NOT NULL
ORDER BY "createdAt" DESC;
```

---

## Error Messages

### Invalid Transition
```json
{
  "error": "Invalid status transition: DRAFT → ACTIVE. Allowed transitions from DRAFT: SUBMITTED, DRAFT"
}
```

### Insufficient Permissions
```json
{
  "error": "Insufficient permissions: ANALYST cannot perform UNDER_REVIEW → APPROVED. Required roles: SUPER_ADMIN, ADMIN"
}
```

### Mass Assignment Protection
```json
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "status": ["Field not allowed for role USER"]
    }
  }
}
```

---

## Benefits

### 1. Data Integrity ✅
- Prevents invalid state changes
- Enforces proper workflow
- No "draft" projects accidentally published

### 2. Audit Compliance ✅
- All transitions logged with who/when
- Clear approval chain
- Traceable decision history

### 3. Role-Based Access ✅
- Separation of duties (create vs approve vs publish)
- Prevents privilege escalation
- Clear permission boundaries

### 4. User Experience ✅
- Clear indication of available actions
- No confusing error messages
- Guided workflow process

---

## Future Enhancements

### Phase 2 (Month 2)
- [ ] Email notifications on status changes
- [ ] Automatic transitions (e.g., auto-publish after 7 days if approved)
- [ ] Bulk status updates with validation
- [ ] Status change comments/reasons

### Phase 3 (Month 3)
- [ ] Visual workflow diagram in UI
- [ ] Status change approval workflow
- [ ] Integration with document requirements (e.g., can't publish without EIA)
- [ ] Conditional transitions based on completeness scores

---

**Last Updated:** 2026-09-11  
**Status:** ✅ IMPLEMENTED  
**Task:** #6 - Project State Machine
