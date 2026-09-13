# Financial Field Validation

**Date:** 2026-09-11  
**Feature:** Task #13 - Financial Field Validation  
**Impact:** 💰 Data integrity, prevent invalid financial structures

---

## Overview

Financial field validation ensures data integrity for project financial data through:
- **Zod schema validation** at the API layer (application-level)
- **Database check constraints** at the PostgreSQL layer (database-level)
- **Custom business rules** for complex validations

This two-layer approach provides defense-in-depth: API layer catches errors early with helpful messages, database layer prevents corrupt data even if application validation is bypassed.

---

## Validation Rules

### 1. Financial Structure Validation (PRIMARY RULE)

**Rule:** Total financing (equity + debt + grant) cannot exceed total cost

**Formula:**
```
equityRequired + debtRequired + grantRequired ≤ totalCost
```

**Why:** A project cannot be funded beyond its total cost. This prevents data entry errors and ensures financial logic.

**Example (Valid):**
```json
{
  "totalCost": 1000000,
  "equityRequired": 300000,
  "debtRequired": 500000,
  "grantRequired": 200000
}
// Total financing: 1,000,000 ≤ 1,000,000 ✅
```

**Example (Invalid):**
```json
{
  "totalCost": 1000000,
  "equityRequired": 400000,
  "debtRequired": 500000,
  "grantRequired": 300000
}
// Total financing: 1,200,000 > 1,000,000 ❌
// Error: "Total financing (equity + debt + grant) cannot exceed total cost"
```

---

### 2. Non-Negative Financial Fields

**Rule:** Equity, debt, and grant cannot be negative

**Validation:**
```typescript
equityRequired >= 0
debtRequired >= 0
grantRequired >= 0
```

**Why:** Negative financing amounts don't make business sense.

**Example (Invalid):**
```json
{
  "totalCost": 1000000,
  "equityRequired": -50000,  // ❌ Cannot be negative
  "debtRequired": 500000
}
```

---

### 3. Total Cost Validation

**Rule:** Total cost must be positive

**Validation:**
```typescript
totalCost > 0
```

**Why:** Projects must have a cost greater than zero.

**Range:** $1 to $100 billion (soft limit in Zod schema)

---

### 4. Concession Period Validation

**Rule:** Concession period must be positive (in years)

**Validation:**
```typescript
concessionPeriod > 0
```

**Example:** 25 years (typical for infrastructure PPP projects)

---

### 5. Score Validation (PETFEL, EIN)

**Rule:** Scores must be between 0 and 100

**Validation:**
```typescript
petfelScore >= 0 && petfelScore <= 100
einScore >= 0 && einScore <= 100
```

**Why:** Scores are percentages (0-100 scale)

---

### 6. View Count Validation

**Rule:** View count cannot be negative

**Validation:**
```typescript
viewCount >= 0
```

---

### 7. Date Validation (Zod Schema Only)

**Rule:** Start date must be before estimated completion date

**Validation:**
```typescript
startDate < estimatedCompletionDate
```

**Example (Invalid):**
```json
{
  "startDate": "2026-12-01",
  "estimatedCompletionDate": "2026-06-01"  // ❌ Before start date
}
```

---

### 8. Coordinate Validation (Zod Schema Only)

**Rule:** Latitude and longitude must be in valid ranges

**Validation:**
```typescript
latitude >= -90 && latitude <= 90
longitude >= -180 && longitude <= 180
```

---

### 9. IRR Validation (Zod Schema Only)

**Rule:** IRR must be between -100% and 100%

**Validation:**
```typescript
irr >= -100 && irr <= 100
```

**Why:** IRR typically ranges from -100% (total loss) to 100% (doubling investment). Values above 100% are rare but possible for high-growth projects.

---

### 10. Payback Period Validation (Zod Schema Only)

**Rule:** Payback period must be positive (in years)

**Validation:**
```typescript
paybackPeriod > 0
```

**Typical Range:** 1-30 years for infrastructure projects

---

## Implementation Layers

### Layer 1: Zod Schema Validation (API Layer)

**File:** `src/lib/schemas/project.ts`

**Features:**
- Type-safe validation
- Helpful error messages
- Complex multi-field rules
- Custom refinements

**Example:**
```typescript
export const UserProjectPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  totalCost: z.number().positive().optional(),
  equityRequired: z.number().nonnegative().optional(),
  debtRequired: z.number().nonnegative().optional(),
  grantRequired: z.number().nonnegative().optional(),
  // ... other fields
}).refine(
  (data) => {
    // Financial structure validation
    if (!data.totalCost) return true
    const equity = data.equityRequired ?? 0
    const debt = data.debtRequired ?? 0
    const grant = data.grantRequired ?? 0
    const total = equity + debt + grant
    return total <= data.totalCost
  },
  {
    message: 'Total financing (equity + debt + grant) cannot exceed total cost',
    path: ['equityRequired'],
  }
).refine(
  (data) => {
    // Date validation
    if (!data.startDate || !data.estimatedCompletionDate) return true
    return data.startDate < data.estimatedCompletionDate
  },
  {
    message: 'Start date must be before estimated completion date',
    path: ['estimatedCompletionDate'],
  }
)
```

**Error Response Example:**
```json
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "equityRequired": [
        "Total financing (equity + debt + grant) cannot exceed total cost"
      ]
    }
  }
}
```

---

### Layer 2: Database Check Constraints (Database Layer)

**File:** `prisma/migrations/20260911_add_financial_check_constraints.sql`

**Features:**
- Enforced at database level
- Cannot be bypassed
- Protects against direct SQL writes
- ACID transaction safety

**Example:**
```sql
-- Financial structure constraint
ALTER TABLE "Project"
ADD CONSTRAINT "check_financial_structure"
CHECK (
  "totalCost" IS NULL
  OR (
    COALESCE("equityRequired", 0) +
    COALESCE("debtRequired", 0) +
    COALESCE("grantRequired", 0)
  ) <= "totalCost"
);

-- Non-negative equity
ALTER TABLE "Project"
ADD CONSTRAINT "check_equity_nonnegative"
CHECK ("equityRequired" IS NULL OR "equityRequired" >= 0);
```

**Database Error Example:**
```
ERROR: new row for relation "Project" violates check constraint "check_financial_structure"
DETAIL: Failing row contains (totalCost=1000000, equityRequired=600000, debtRequired=500000, grantRequired=100000)
```

---

## API Integration

### Projects PATCH Endpoint

**File:** `src/app/api/projects/[id]/route.ts`

**Implementation:**
```typescript
import { getProjectPatchSchema, validateFinancialStructure } from '@/lib/schemas/project'

export async function PATCH(req: NextRequest, { params }: Ctx) {
  // ... auth checks
  
  const schema = getProjectPatchSchema(session.user.role as UserRole)
  const parsed = schema.safeParse(body)
  
  if (!parsed.success) {
    logger.warn('Project update validation failed', {
      projectId: id,
      userId: session.user.id,
      errors: parsed.error.flatten(),
    })
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }
  
  const d = parsed.data
  
  // Additional validation for partial updates (backward compatibility)
  if (d.totalCost || d.equityRequired || d.debtRequired || d.grantRequired) {
    const validation = validateFinancialStructure({
      totalCost: d.totalCost,
      equityRequired: d.equityRequired,
      debtRequired: d.debtRequired,
      grantRequired: d.grantRequired,
    })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 422 })
    }
  }
  
  // Update project
  const updatedProject = await prisma.project.update({
    where: { id },
    data: d,
  })
  
  // ...
}
```

---

## Testing

### Test 1: Valid Financial Structure
```bash
curl -X PATCH https://app.africa-infra.com/api/projects/proj-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "totalCost": 1000000,
    "equityRequired": 300000,
    "debtRequired": 500000,
    "grantRequired": 200000
  }'

# Expected: 200 OK
# Total: 300k + 500k + 200k = 1,000,000 ≤ 1,000,000 ✅
```

---

### Test 2: Invalid Financial Structure (Exceeds Total Cost)
```bash
curl -X PATCH https://app.africa-infra.com/api/projects/proj-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "totalCost": 1000000,
    "equityRequired": 400000,
    "debtRequired": 500000,
    "grantRequired": 300000
  }'

# Expected: 422 Unprocessable Entity
# {
#   "error": "Validation failed",
#   "details": {
#     "fieldErrors": {
#       "equityRequired": [
#         "Total financing (equity + debt + grant) cannot exceed total cost"
#       ]
#     }
#   }
# }
# Total: 400k + 500k + 300k = 1,200,000 > 1,000,000 ❌
```

---

### Test 3: Negative Equity (Application Layer)
```bash
curl -X PATCH https://app.africa-infra.com/api/projects/proj-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "totalCost": 1000000,
    "equityRequired": -50000
  }'

# Expected: 422 Unprocessable Entity
# {
#   "error": "Validation failed",
#   "details": {
#     "fieldErrors": {
#       "equityRequired": ["Number must be greater than or equal to 0"]
#     }
#   }
# }
```

---

### Test 4: Database Constraint Enforcement (Direct SQL)
```sql
-- Try to insert invalid data directly via SQL
INSERT INTO "Project" (
  "id", "code", "title", "ownerId",
  "totalCost", "equityRequired", "debtRequired", "grantRequired"
) VALUES (
  'test-id', 'TEST-001', 'Test Project', 'user-123',
  1000000, 400000, 500000, 300000
);

-- Expected: ERROR
-- new row for relation "Project" violates check constraint "check_financial_structure"
```

This confirms the database constraint works even when application validation is bypassed.

---

### Test 5: Invalid Date Range
```bash
curl -X PATCH https://app.africa-infra.com/api/projects/proj-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-12-01",
    "estimatedCompletionDate": "2026-06-01"
  }'

# Expected: 422 Unprocessable Entity
# {
#   "error": "Validation failed",
#   "details": {
#     "fieldErrors": {
#       "estimatedCompletionDate": [
#         "Start date must be before estimated completion date"
#       ]
#     }
#   }
# }
```

---

## Benefits

### 1. Data Integrity ✅
- Invalid financial structures cannot be saved
- Database constraints enforce rules even if application is bypassed
- Prevents logical inconsistencies (e.g., financing > cost)

---

### 2. User-Friendly Error Messages ✅
```json
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {
      "equityRequired": [
        "Total financing (1200000.00) exceeds total cost (1000000.00). Breakdown: equity=400000.00, debt=500000.00, grant=300000.00"
      ]
    }
  }
}
```

Clear, actionable feedback for users and developers.

---

### 3. Defense-in-Depth ✅
```
Layer 1: Zod Schema (API) → Helpful error messages
Layer 2: Database Constraints → Ultimate protection
```

Even if API validation is bypassed (e.g., admin console, SQL script), database prevents corrupt data.

---

### 4. Business Logic Enforcement ✅
- Ensures financial soundness
- Prevents impossible scenarios (negative costs, over-funding)
- Maintains trust in financial data for investors and analysts

---

## Helper Functions

### validateFinancialStructure()
```typescript
validateFinancialStructure({
  totalCost: 1000000,
  equityRequired: 400000,
  debtRequired: 500000,
  grantRequired: 300000,
})

// Returns:
// {
//   valid: false,
//   error: "Total financing (1200000.00) exceeds total cost (1000000.00). Breakdown: equity=400000.00, debt=500000.00, grant=300000.00"
// }
```

---

### validateFinancialRanges()
```typescript
validateFinancialRanges({
  totalCost: -1000,  // ❌ Must be positive
  equityRequired: 500000,
  irr: 150,  // ❌ Must be ≤ 100%
})

// Returns:
// {
//   valid: false,
//   errors: [
//     "Total cost must be at least $1",
//     "IRR cannot exceed 1000%"
//   ]
// }
```

---

## Migration Deployment

### Apply Migration
```bash
# When database is accessible
npx prisma migrate deploy

# Or manually apply
psql $DATABASE_URL -f prisma/migrations/20260911_add_financial_check_constraints.sql
```

---

### Rollback (If Needed)
```sql
-- Remove all check constraints
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_financial_structure";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_equity_nonnegative";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_debt_nonnegative";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_grant_nonnegative";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_total_cost_positive";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_concession_period_positive";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_petfel_score_range";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_ein_score_range";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "check_view_count_nonnegative";
```

---

## Summary

Financial field validation provides **multi-layer data integrity** for project financial data.

**Key Features:**
- ✅ Primary rule: Total financing ≤ Total cost
- ✅ Non-negative amounts (equity, debt, grant)
- ✅ Positive total cost
- ✅ Score ranges (0-100)
- ✅ Date logic (start before end)
- ✅ Coordinate validation

**Implementation:**
- ✅ Zod schema validation (API layer)
- ✅ Database check constraints (PostgreSQL layer)
- ✅ Helper functions for backward compatibility
- ✅ Detailed error messages

**Benefits:**
- 💰 Prevents invalid financial structures
- 💰 User-friendly error messages
- 💰 Defense-in-depth (API + database)
- 💰 Business logic enforcement
- 💰 Maintains investor confidence in data

---

**Last Updated:** 2026-09-11  
**Status:** ✅ COMPLETED  
**Task:** #13 - Financial Field Validation
