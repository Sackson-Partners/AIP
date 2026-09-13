# Enhanced Structured Logging with PII Sanitization

**Date:** 2026-09-11  
**Feature:** Task #10 - Enhanced Structured Logging with PII Sanitization  
**Impact:** 🔍 Better debugging, GDPR compliance, Sentry integration

---

## Overview

Enhanced structured logging replaces ad-hoc `console.log` calls with a centralized logger that provides:
- **Structured logging** with context metadata
- **PII field masking** for GDPR compliance
- **Sentry integration** for error tracking
- **Environment-aware** logging (dev vs. production)
- **Request context** support (userId, requestId, etc.)

---

## Security Problem

### Before: Unstructured Logging with PII Leaks ❌
```typescript
// Dangerous - logs sensitive data
console.log('User login:', { email: 'user@example.com', password: 'secret123' })
console.error('Auth failed:', error, { token: 'abc123', resetToken: 'xyz789' })
```

**Problems:**
- ❌ Passwords and tokens logged in plain text
- ❌ No structured format (hard to search/filter)
- ❌ Dev-only logging (no production logs)
- ❌ No error tracking in Sentry
- ❌ GDPR violation (PII in logs)

---

## Solution: Enhanced Logger with PII Sanitization

### Basic Usage
```typescript
import { logger } from '@/lib/logger'

// Info logging with context
logger.info('User logged in', {
  userId: 'user-123',
  email: 'user@example.com',  // Will be masked: u***@example.com
  ipAddress: '192.168.1.100',  // Will be masked: ***1100
})

// Warning logging
logger.warn('Rate limit approaching', {
  userId: 'user-456',
  requestCount: 95,
})

// Error logging with Sentry integration
logger.error('Database query failed', error, {
  userId: 'user-789',
  query: 'SELECT * FROM projects',
})
```

---

## PII Sanitization

### Fully Masked Fields (PII)
```typescript
const PII_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'resetToken',
  'verificationToken',
  'twoFactorSecret',
  'apiKey',
  'secretKey',
  'privateKey',
  'ssn',
  'socialSecurityNumber',
  'creditCard',
  'cardNumber',
  'cvv',
  'pin',
]
```

**Result:** `[REDACTED]`

---

### Partially Masked Fields (Sensitive)
```typescript
const SENSITIVE_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'ipAddress',
  'ip',
]
```

**Examples:**
- Email: `john@example.com` → `j***@example.com`
- Phone: `+1234567890` → `***7890`
- IP: `192.168.1.100` → `***1100`

---

### Automatic Sanitization Example
```typescript
logger.info('User created', {
  email: 'john.doe@example.com',
  password: 'secret123',
  phone: '+1234567890',
  apiKey: 'sk_live_abc123xyz',
  name: 'John Doe',  // Safe field
})

// Logged as:
{
  "timestamp": "2026-09-11T10:30:00.000Z",
  "level": "INFO",
  "message": "User created",
  "email": "j***@example.com",
  "password": "[REDACTED]",
  "phone": "***7890",
  "apiKey": "[REDACTED]",
  "name": "John Doe"
}
```

---

## Logger API

### Core Methods

#### logger.info()
```typescript
logger.info(message: string, context?: Record<string, unknown>): void
```

**Usage:**
- Informational logs (user actions, successful operations)
- Logged in dev and production
- Not sent to Sentry

**Example:**
```typescript
logger.info('Project created', {
  projectId: 'proj-123',
  userId: 'user-456',
  projectTitle: 'New Infrastructure Project',
})
```

---

#### logger.warn()
```typescript
logger.warn(message: string, context?: Record<string, unknown>): void
```

**Usage:**
- Warning conditions (rate limits, deprecated features, failed non-critical operations)
- Logged in dev and production
- **Sent to Sentry in production** for monitoring

**Example:**
```typescript
logger.warn('Rate limit approaching', {
  userId: 'user-789',
  requestCount: 95,
  limit: 100,
})
```

---

#### logger.error()
```typescript
logger.error(message: string, error?: unknown, context?: Record<string, unknown>): void
```

**Usage:**
- Error conditions (exceptions, failed operations, database errors)
- Logged in dev and production
- **Always sent to Sentry** with full stack trace

**Example:**
```typescript
try {
  await prisma.project.create({ data })
} catch (error) {
  logger.error('Project creation failed', error, {
    userId: session.user.id,
    projectData: data,
  })
  throw error
}
```

---

#### logger.log()
```typescript
logger.log(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context?: Record<string, unknown>
): void
```

**Usage:**
- Custom level logging
- Debug level only logs in development

**Example:**
```typescript
logger.log('debug', 'Query executed', {
  sql: 'SELECT * FROM projects',
  duration: 45,  // ms
})
```

---

### Request-Scoped Logger

#### logger.withContext()
```typescript
logger.withContext(persistentContext: Record<string, unknown>)
```

**Usage:** Create a logger with persistent context (userId, requestId, etc.)

**Example:**
```typescript
const userLogger = logger.withContext({
  userId: 'user-123',
  userRole: 'ADMIN',
})

userLogger.info('Action performed')
// Logs: { userId: 'user-123', userRole: 'ADMIN', message: 'Action performed' }

userLogger.error('Action failed', error)
// Logs: { userId: 'user-123', userRole: 'ADMIN', message: 'Action failed', error }
```

---

#### createRequestLogger()
```typescript
createRequestLogger(
  req: { headers: Headers; url?: string },
  session?: { user?: { id?: string; email?: string } }
)
```

**Usage:** Create a request-scoped logger for API routes

**Example:**
```typescript
import { createRequestLogger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const reqLogger = createRequestLogger(req, session)

  reqLogger.info('Processing request')
  
  try {
    const data = await fetchData()
    reqLogger.info('Request successful', { recordCount: data.length })
    return NextResponse.json({ data })
  } catch (error) {
    reqLogger.error('Request failed', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

**Logged Context:**
```json
{
  "requestId": "req_1694567890123",
  "userId": "user-123",
  "userEmail": "u***@example.com",
  "path": "/api/projects",
  "message": "Processing request"
}
```

---

## Applied to Endpoints

### Middleware (Authentication & Authorization)
```typescript
// Before
console.log('[Middleware] Session version mismatch')
console.error('[Middleware] Failed to validate session')

// After
logger.warn('Session version mismatch - forcing logout', {
  userId: token.userId,
  tokenVersion: token.sessionVersion,
  dbVersion: user.sessionVersion,
})

logger.error('Failed to validate session version', error)
```

---

### Projects API
```typescript
// GET /api/projects
logger.info('Fetching projects list', {
  userId: session.user.id,
  userEmail: session.user.email,
  userRole,
  isInternal,
  page,
  limit,
  status,
  search,
})

// POST /api/projects
logger.info('Project created - cache invalidated', {
  projectId: project.id,
  projectTitle: resolvedName,
  userId: session.user.id,
})

// PATCH /api/projects/[id]
logger.info('Project update request', {
  projectId: id,
  userId: session.user.id,
  userEmail: session.user.email,
  userRole: session.user.role,
  isOwner,
})

logger.warn('Project update validation failed', {
  projectId: id,
  userId: session.user.id,
  errors: parsed.error.flatten(),
})

logger.info('Valid project status transition', {
  projectId: id,
  userId: session.user.id,
  fromStatus: project.status,
  toStatus: d.status,
  userRole: session.user.role,
})

logger.error('Project update failed', error, {
  projectId: id,
  userId: session.user.id,
})
```

---

### Users API
```typescript
// POST /api/admin/users
logger.error('Failed to generate password hash or employee ID', err, {
  adminId: session.user.id,
  targetEmail: email,  // Will be masked: t***@example.com
})

logger.info('Internal user created successfully', {
  adminId: session.user.id,
  newUserId: user.id,
  newUserEmail: email,  // Will be masked
  newUserRole: role,
  employeeId,
})

logger.error('User creation transaction failed', err, {
  adminId: session.user.id,
  targetEmail: email,
  targetRole: role,
})
```

---

## Log Output Formats

### Development (Human-Readable)
```
[INFO] User logged in { userId: 'user-123', email: 'u***@example.com' }
[WARN] Rate limit approaching { userId: 'user-456', requestCount: 95 }
[ERROR] Database query failed Error: Connection timeout
  at ...stack trace...
  { userId: 'user-789', query: 'SELECT * FROM projects' }
```

---

### Production (Structured JSON)
```json
{
  "timestamp": "2026-09-11T10:30:00.000Z",
  "level": "INFO",
  "message": "User logged in",
  "userId": "user-123",
  "email": "u***@example.com"
}
```

**Benefits:**
- ✅ Easy to parse with log aggregation tools (Datadog, CloudWatch, etc.)
- ✅ Searchable and filterable
- ✅ Machine-readable

---

## Sentry Integration

### Automatic Error Tracking
```typescript
// Errors are automatically sent to Sentry
logger.error('Payment processing failed', error, {
  userId: 'user-123',
  amount: 1000,
  currency: 'USD',
})
```

**Sentry Dashboard Shows:**
- Error message: "Payment processing failed"
- Stack trace from error object
- Context: `{ userId: 'user-123', amount: 1000, currency: 'USD' }`
- PII automatically sanitized

---

### Warning Tracking (Production Only)
```typescript
// Warnings sent to Sentry in production for monitoring
logger.warn('Unusual login pattern detected', {
  userId: 'user-456',
  loginCount: 10,
  duration: '5 minutes',
})
```

**Use Case:** Monitor for security incidents, performance issues

---

## GDPR Compliance

### Automatic PII Masking
```typescript
// Input
logger.info('User registered', {
  email: 'john.doe@example.com',
  password: 'secret123',
  ssn: '123-45-6789',
  creditCard: '4111-1111-1111-1111',
  name: 'John Doe',
})

// Logged (PII masked)
{
  "email": "j***@example.com",
  "password": "[REDACTED]",
  "ssn": "[REDACTED]",
  "creditCard": "[REDACTED]",
  "name": "John Doe"
}
```

---

### Manual Sanitization
```typescript
import { sanitizePII } from '@/lib/logger'

const userData = {
  email: 'user@example.com',
  password: 'secret',
  name: 'John Doe',
}

const sanitized = sanitizePII(userData)
// { email: 'u***@example.com', password: '[REDACTED]', name: 'John Doe' }

console.log('User data:', sanitized)  // Safe to log
```

---

## Testing

### Test 1: PII Masking
```typescript
import { sanitizePII } from '@/lib/logger'

const data = {
  email: 'test@example.com',
  password: 'secret123',
  apiKey: 'sk_live_abc',
  name: 'Test User',
}

const sanitized = sanitizePII(data)

console.log(sanitized)
// {
//   email: 't***@example.com',
//   password: '[REDACTED]',
//   apiKey: '[REDACTED]',
//   name: 'Test User'
// }
```

---

### Test 2: Nested Object Sanitization
```typescript
const data = {
  user: {
    email: 'user@example.com',
    profile: {
      ssn: '123-45-6789',
      phone: '+1234567890',
    },
  },
  token: 'secret-token',
}

const sanitized = sanitizePII(data)
// {
//   user: {
//     email: 'u***@example.com',
//     profile: {
//       ssn: '[REDACTED]',
//       phone: '***7890'
//     }
//   },
//   token: '[REDACTED]'
// }
```

---

### Test 3: Array Sanitization
```typescript
const data = {
  users: [
    { email: 'user1@example.com', password: 'pass1' },
    { email: 'user2@example.com', password: 'pass2' },
  ],
}

const sanitized = sanitizePII(data)
// {
//   users: [
//     { email: 'u***@example.com', password: '[REDACTED]' },
//     { email: 'u***@example.com', password: '[REDACTED]' }
//   ]
// }
```

---

### Test 4: Request Logger Context
```typescript
const mockReq = {
  headers: new Headers({ 'x-request-id': 'req-123' }),
  url: '/api/projects',
}

const mockSession = {
  user: { id: 'user-456', email: 'admin@example.com' },
}

const reqLogger = createRequestLogger(mockReq, mockSession)
reqLogger.info('Test log')

// Logs:
// {
//   requestId: 'req-123',
//   userId: 'user-456',
//   userEmail: 'a***@example.com',
//   path: '/api/projects',
//   message: 'Test log'
// }
```

---

## Benefits

### 1. GDPR Compliance ✅
- Automatic PII masking in all logs
- No plain-text passwords, tokens, or sensitive data
- Email/phone partially masked (still useful for debugging)

---

### 2. Better Debugging ✅
- Structured logs with context
- Easy to search and filter
- Request-scoped logging with userId, requestId

---

### 3. Production Monitoring ✅
- Structured JSON logs for log aggregation tools
- Sentry integration for error tracking
- Warning-level alerts for unusual patterns

---

### 4. Security Audit Trail ✅
```typescript
// Example: Track suspicious activity
logger.warn('Multiple failed login attempts', {
  userId: 'user-123',
  email: 'u***@example.com',
  ipAddress: '***1234',
  attemptCount: 5,
  timeWindow: '5 minutes',
})
```

---

### 5. Developer Experience ✅
- Clean, readable logs in development
- Type-safe context objects
- Easy to add context with `.withContext()`

---

## Comparison with Alternatives

### Alternative 1: Plain console.log
```typescript
// ❌ Unstructured, no PII masking
console.log('User logged in:', user)
```

**Problems:**
- No structure
- PII leaks
- No Sentry integration
- Dev-only

---

### Alternative 2: Winston/Pino
```typescript
// ❌ Requires complex setup
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
})
```

**Problems:**
- Heavy dependency
- Complex configuration
- No built-in PII masking

---

### Our Solution ✅
- **Lightweight:** Built-in, no heavy dependencies
- **PII masking:** Automatic GDPR compliance
- **Sentry integration:** Built-in error tracking
- **Environment-aware:** Different formats for dev/prod
- **Type-safe:** TypeScript support

---

## Future Enhancements

### Phase 2: Log Levels Configuration
```typescript
// Configure log levels per environment
process.env.LOG_LEVEL = 'debug'  // dev
process.env.LOG_LEVEL = 'info'   // prod
```

---

### Phase 3: Log Sampling
```typescript
// Sample logs in high-traffic scenarios
logger.info('High-frequency event', { sampling: 0.1 })  // Log 10% of events
```

---

### Phase 4: Custom PII Rules
```typescript
// User-defined PII fields
logger.setPIIFields(['internalId', 'employeeNumber'])
```

---

### Phase 5: Log Aggregation Integration
```typescript
// Direct integration with Datadog, CloudWatch, etc.
logger.configure({
  transport: 'datadog',
  apiKey: process.env.DATADOG_API_KEY,
})
```

---

## Summary

Enhanced structured logging provides **secure, GDPR-compliant, production-ready logging** with automatic PII sanitization.

**Key Features:**
- ✅ Automatic PII masking (passwords, tokens, emails, phones)
- ✅ Structured JSON logs for production
- ✅ Sentry integration for error tracking
- ✅ Request-scoped logging with userId, requestId
- ✅ Environment-aware (dev vs. prod)
- ✅ Type-safe context objects

**Applied To:**
- ✅ Middleware (authentication, authorization)
- ✅ Projects API (GET, POST, PATCH)
- ✅ Users API (POST, validation errors)
- ✅ All error handling

**Security Impact:**
- 🔒 No plain-text passwords in logs
- 🔒 Email addresses partially masked
- 🔒 API keys and tokens fully redacted
- 🔒 GDPR-compliant logging
- 🔒 Audit trail for security incidents

---

**Last Updated:** 2026-09-11  
**Status:** ✅ COMPLETED  
**Task:** #10 - Enhanced Structured Logging with PII Sanitization
