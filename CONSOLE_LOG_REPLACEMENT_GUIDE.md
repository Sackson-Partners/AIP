# Console.log Replacement Guide

**Status:** 1/199 console.log calls replaced  
**Priority:** Replace in API routes first, then lib utilities, then components

## Replacement Pattern

### Import
```typescript
import { logger } from '@/lib/logger'
```

### Replacement Rules
```typescript
// BEFORE → AFTER
console.log(message, data)     → logger.info(message, data)
console.error(message, error)  → logger.error(message, { error })
console.warn(message, data)    → logger.warn(message, data)
console.debug(message, data)   → logger.debug(message, data)
```

### For API Routes - Add Context
```typescript
// At start of route handler:
const log = logger.child({ 
  route: '/api/your-route',
  method: req.method,
  userId: session?.user?.id
})

// Then use:
log.info('Processing request', { projectId })
log.error('Operation failed', { error: err.message })
```

## Files Needing Replacement (Priority Order)

### HIGH PRIORITY - API Routes (50+ files)
- [ ] src/app/api/ein/[id]/generate/route.ts (line 112)
- [ ] src/app/api/pis/[id]/generate/route.ts
- [ ] src/app/api/ai/generate-ein/route.ts (line 54)
- [ ] src/app/api/search/route.ts
- [ ] src/app/api/contact-requests/route.ts
- [ ] src/app/api/access-requests/route.ts
- [ ] src/app/api/ic-committees/route.ts
- [ ] src/app/api/project-templates/route.ts
- [ ] src/app/api/ai/augment-petfel/route.ts
- [ ] ... (40+ more API routes)

### MEDIUM PRIORITY - Library Utilities (30+ files)
- [ ] src/lib/auth/
- [ ] src/lib/email/
- [ ] src/lib/monitoring.ts
- [ ] ... (rest of lib/)

### LOW PRIORITY - Components (client-side, keep some console.log)
- Keep console.log for client-side debugging
- Only replace server-side components

## Quick Fix Script

Run this to find all console.log in API routes:
```bash
find src/app/api -name "*.ts" -exec grep -l "console\." {} \;
```

## Verification

After replacement, verify with:
```bash
# Should show decreased count
grep -r "console\." src/app/api --include="*.ts" | wc -l

# Check logs are JSON in production
NODE_ENV=production npm run build && npm start
# Logs should be: {"level":"info","message":"...","timestamp":"..."}
```

## Notes
- ✅ src/app/api/chat/route.ts - COMPLETED
- ✅ Import logger from '@/lib/logger'
- ✅ Use logger.child() for request context
- ❌ Do NOT replace console.log in:
  - Test files (*.test.ts)
  - Config files (next.config.ts)
  - Files with // eslint-disable-next-line no-console
