# Console.log() to Structured Logger Migration

**Date:** September 14, 2026  
**Status:** IN PROGRESS  
**Total Statements:** 209  

## Migration Strategy

### Phase 1: Critical API Routes (Priority 1 - 2 hours)
Replace console statements in authentication, authorization, and security-critical routes.

**Files:**
- src/app/api/access-requests/**/*.ts
- src/app/api/admin/**/*.ts  
- src/app/api/auth/**/*.ts
- src/lib/auth/*.ts
- src/lib/session-utils.ts
- src/lib/audit.ts

### Phase 2: Business Logic Routes (Priority 2 - 1 hour)
Replace in project, investor, deal-room APIs.

**Files:**
- src/app/api/projects/**/*.ts
- src/app/api/investors/**/*.ts
- src/app/api/deal-rooms/**/*.ts

### Phase 3: Utility & UI (Priority 3 - 30 minutes)
Replace in components and utilities (non-blocking).

## Replacement Patterns

### Error Logging
```typescript
// BEFORE
console.error('[API] Error:', error)

// AFTER
import { logger } from '@/lib/logger'
logger.error('Error occurred', error, { context: 'API' })
```

### Info Logging
```typescript
// BEFORE
console.log('[PIS] Generated successfully')

// AFTER
logger.info('PIS generated successfully', { pisId: id })
```

### Warning Logging
```typescript
// BEFORE
console.warn('[Session] Version mismatch')

// AFTER
logger.warn('Session version mismatch', { userId, tokenVersion, dbVersion })
```

### Intentional Dev-Only Logs
```typescript
// Keep if truly dev-only debugging
if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG] ...') // OK to keep
}
```

## Progress Tracking

### Completed Files
- [ ] src/app/api/access-requests/[id]/route.ts
- [ ] src/app/api/access-requests/bulk/route.ts
- [ ] src/app/api/access-requests/route.ts
- [ ] src/lib/session-utils.ts
- [ ] src/lib/audit.ts (partially done - has logger.error already)

### In Progress
- Starting with access-requests API routes...

## Notes
- Logger already imported in many files via `import { logger } from '@/lib/logger'`
- PII sanitization automatic in logger (20+ fields)
- Production logs output as JSON for aggregation
- Request context (correlation IDs) persists automatically
