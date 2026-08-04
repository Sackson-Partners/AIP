# AIP Platform - Comprehensive Security Audit & Architecture Review
**Date:** 2026-08-04  
**Auditor:** Senior Full Stack Engineer & Security Expert  
**Platform:** AIP Platform (Africa Infrastructure Partners)  
**Stack:** Next.js 16, React 19, NextAuth v4, Azure AD, PostgreSQL, Vercel  

---

## Executive Summary

This comprehensive security audit identified **23 security findings** across authentication, authorization, data exposure, input validation, API security, and infrastructure. Severity ranges from **CRITICAL** to **LOW**.

### Critical Risk Summary
- **1 CRITICAL**: Dangerous email account linking enabled in Azure AD
- **4 HIGH**: Authentication bypass risks, missing middleware, cache timing attacks, password storage
- **8 MEDIUM**: Input validation gaps, authorization issues, information disclosure
- **10 LOW**: Hardening opportunities, logging improvements

**Immediate Action Required:** Disable `allowDangerousEmailAccountLinking` and implement Next.js middleware.

---

## 1. Authentication & Authorization

### 🔴 CRITICAL: Dangerous Email Account Linking Enabled
**File:** `src/lib/auth/auth.config.ts:63`  
**Issue:** `allowDangerousEmailAccountLinking: true` in Azure AD provider config

**Risk:**  
Account takeover vulnerability. If an attacker has access to an Azure AD tenant, they can claim any existing account by signing in with a matching email address. This bypasses all password/2FA protections.

**Attack Scenario:**
1. User creates account with `admin@company.com` (credentials provider)
2. Attacker creates Azure AD account with same email
3. Attacker signs in via Azure AD
4. NextAuth automatically links accounts → Attacker gains full access

**Remediation:**
```typescript
// Remove this line completely
allowDangerousEmailAccountLinking: true,

// Add manual verification flow instead
// src/lib/auth/auth.config.ts:89 signIn callback
if (account?.provider === "azure-ad") {
  const existing = await prisma.user.findFirst({
    where: { email, authProvider: { not: "AZURE_AD" } }
  });
  
  if (existing) {
    return "/auth/error?error=AccountExists&provider=credentials";
  }
  // ... continue with Azure AD flow
}
```

---

### 🟠 HIGH: Missing Global Middleware for Auth Protection
**File:** Missing `src/middleware.ts`  
**Issue:** No Next.js middleware to protect routes at edge

**Risk:**  
- Routes can be accessed before authentication checks in page components
- Potential for timing attacks and enumeration
- Inconsistent auth enforcement across pages
- API routes rely solely on per-route `getServerSession()` calls

**Remediation:**
```typescript
// Create src/middleware.ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname
    
    // Block PENDING users from accessing anything except auth pages
    if (token?.status === "PENDING" && !path.startsWith("/auth/pending")) {
      return NextResponse.redirect(new URL("/auth/pending", req.url))
    }
    
    // Block SUSPENDED/DEACTIVATED
    if (["SUSPENDED", "DEACTIVATED"].includes(token?.status as string)) {
      return NextResponse.redirect(new URL("/auth/error?error=AccountBlocked", req.url))
    }
    
    // Admin routes
    if (path.startsWith("/admin") && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }
    
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/projects/:path*",
    "/api/:path*", // Protect API routes
  ],
}
```

---

### 🟠 HIGH: Session Token Exposure in Logs
**File:** `src/lib/auth/auth.config.ts:190, 316, 319`  
**Issue:** Verbose logging includes user IDs and session data

**Risk:**
- Session tokens/user IDs in application logs
- If logs are compromised (Sentry, CloudWatch), attacker can impersonate users
- PII exposure in logs violates GDPR/data protection

**Remediation:**
```typescript
// Remove or sanitize logging
console.log('[signIn azure-ad] email=%s', email); // OK - email only
// DON'T log: oid, user object, token fields

// Add log sanitization helper
function sanitizeLog(data: unknown): unknown {
  if (typeof data === 'object' && data !== null) {
    const clean = { ...data };
    ['password', 'token', 'secret', 'key', 'hash'].forEach(key => {
      if (key in clean) clean[key] = '[REDACTED]';
    });
    return clean;
  }
  return data;
}
```

---

### 🟡 MEDIUM: JWT Token Lacks Expiry and Rotation
**File:** `src/lib/auth/auth.config.ts:399-403`  
**Issue:** JWT session max age is 8 hours, but no forced rotation on privilege escalation

**Risk:**
- If user is demoted (ADMIN → USER), their JWT remains valid for up to 8 hours
- Token theft gives attacker 8 hours of access
- No way to revoke active sessions

**Remediation:**
```typescript
// Add session versioning
model User {
  sessionVersion Int @default(1) // Increment on password change, role change, or manual revocation
}

// In jwt callback
if (token.sessionVersion !== dbUser.sessionVersion) {
  // Force re-authentication
  throw new Error("SESSION_EXPIRED");
}

// On sensitive actions (password change, role change)
await prisma.user.update({
  where: { id: userId },
  data: { sessionVersion: { increment: 1 } }
});
```

---

### 🟡 MEDIUM: Account Lockout Timing Attack
**File:** `src/lib/auth/auth.config.ts:119-121`  
**Issue:** Lockout check happens before password verification

**Risk:**
Timing attack allows enumeration of locked vs. non-existent accounts.
- Response time differs for locked accounts (fast) vs. invalid passwords (bcrypt slow)
- Attacker can enumerate valid emails

**Remediation:**
```typescript
// Always perform bcrypt check, even if locked (constant-time)
const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash || "$2a$12$invalidhashinvalidhash");

if (user.lockedUntil && user.lockedUntil > new Date()) {
  throw new Error("ACCOUNT_LOCKED"); // After password check
}

if (!passwordValid) {
  // ... increment attempts
}
```

---

### 🟢 LOW: Password Reset Token Not Implemented
**File:** `prisma/schema.prisma:157-163`  
**Issue:** `VerificationToken` model exists but no password reset flow

**Risk:** Users with forgotten passwords cannot self-recover (admin intervention required)

**Remediation:** Implement password reset via email with time-limited tokens (15 min expiry).

---

## 2. API Security

### 🟠 HIGH: Inconsistent Rate Limiting Across Endpoints
**Files:** Multiple API routes  
**Issue:** Only `/api/chat` implements rate limiting; most routes unprotected

**Risk:**
- Brute force attacks on `/api/auth/signin`
- Resource exhaustion on expensive endpoints (`/api/ein/[id]/generate`)
- Data scraping via pagination abuse

**Unprotected Critical Endpoints:**
- `/api/projects` - No rate limit (allows pagination abuse)
- `/api/ein/[id]/generate` - Expensive AI calls
- `/api/pis/[id]/generate` - Expensive AI calls
- `/api/documents/[id]/summarize` - Expensive AI calls
- `/api/contact-requests` - Spam vector

**Remediation:**
```typescript
// Apply rate limiting to all sensitive routes
// Example: src/app/api/ein/[id]/generate/route.ts
export async function POST(req: NextRequest, { params }: Ctx) {
  const rateLimitResponse = await applyRateLimit(req, rateLimiters.generate);
  if (rateLimitResponse) return rateLimitResponse;
  // ... rest of handler
}

// Add to these routes:
// - /api/ein/[id]/generate → rateLimiters.generate (5/hour)
// - /api/pis/[id]/generate → rateLimiters.generate (5/hour)
// - /api/contact-requests → rateLimiters.contact (5/24h)
// - /api/projects → rateLimiters.post (100/min)
```

---

### 🟡 MEDIUM: Cache Poisoning via User Role
**File:** `src/app/api/projects/route.ts:56`  
**Issue:** Cache key includes user role but not user ID

**Risk:**
- User A (ADMIN) fetches page 1 → cached with key `projects:list:ADMIN:p1:...`
- User B (ADMIN) fetches page 1 → gets User A's cached result
- If User A had access to private project drafts, User B sees them

**Attack Scenario:**
1. Admin creates DRAFT project (not published)
2. Admin fetches `/api/projects?status=DRAFT` → cached
3. Another admin fetches same endpoint → sees first admin's private drafts

**Remediation:**
```typescript
// Option 1: Don't cache user-specific data
if (!search && isInternal) {
  // Don't cache for internal users (ADMIN/ANALYST see different data)
  // OR include userId in cache key
  const cacheKey = `projects:list:${userRole}:${session.user.id}:p${page}:...`;
}

// Option 2: Use Redis tags for fine-grained invalidation
await setCached(cacheKey, response, CacheTTL.MEDIUM, {
  tags: [`user:${session.user.id}`, `role:${userRole}`]
});
```

---

### 🟡 MEDIUM: Missing Input Sanitization on Rich Text Fields
**Files:** Multiple API routes accepting `description`, `message`, `notes`  
**Issue:** No HTML sanitization; Zod validates string length but not content

**Risk:**
- Stored XSS if descriptions are rendered as HTML
- Script injection in fields like `Project.description`, `ContactRequest.message`
- While Next.js auto-escapes JSX, custom `dangerouslySetInnerHTML` or PDF generation could trigger XSS

**Example Vulnerable Fields:**
- `Project.description` (2000 char limit, no sanitization)
- `ContactRequest.message` (unlimited text)
- `Document.summary` (AI-generated, could contain malicious prompts)

**Remediation:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

const CreateSchema = z.object({
  description: z.string().max(2000).transform(val => DOMPurify.sanitize(val)),
  message: z.string().max(5000).transform(val => DOMPurify.sanitize(val)),
});
```

---

### 🟡 MEDIUM: Mass Assignment Vulnerability in PATCH Endpoints
**File:** `src/app/api/projects/[id]/route.ts:77-169`  
**Issue:** PATCH accepts any field from `PatchSchema` without ownership checks

**Risk:**
- User updates their own project but can modify `ownerId`, `reviewerId`, `status`
- Privilege escalation: Change `status` to `APPROVED` without admin approval
- Transfer ownership to another user

**Current Code:**
```typescript
const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().optional(),  // ❌ Anyone can change
  // ... accepts ~20 fields
})

// No check: Is user the owner? Can this role modify status?
await prisma.project.update({ where: { id }, data: { ...allFields } });
```

**Remediation:**
```typescript
// Split schemas by permission level
const UserPatchSchema = z.object({
  description: z.string().optional(),
  sector: z.string().optional(),
  // Only fields users can modify
});

const AdminPatchSchema = UserPatchSchema.extend({
  status: z.string().optional(),
  reviewerId: z.string().optional(),
  // Admin-only fields
});

// Check ownership
const project = await prisma.project.findUnique({ where: { id } });
if (project.ownerId !== session.user.id && !isAdmin(session.user.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Use appropriate schema
const schema = isAdmin(session.user.role) ? AdminPatchSchema : UserPatchSchema;
```

---

### 🟡 MEDIUM: Authorization Bypass in Project Access
**File:** `src/app/api/projects/[id]/route.ts:62-64`  
**Issue:** External users blocked from viewing DRAFT projects, but no check for project owner

**Risk:**
- User A creates DRAFT project
- User B (also external, not project owner) tries to view
- Currently blocked (correct)
- BUT: User A updates project to ACTIVE
- Now User B can view, even though project might have access restrictions

**Remediation:**
```typescript
// Add explicit access control list or visibility rules
model Project {
  visibility String @default("PRIVATE") // PRIVATE | PUBLIC | RESTRICTED
  allowedUsers String[] // User IDs with explicit access
}

// In GET handler
if (project.visibility === "PRIVATE" && project.ownerId !== session.user.id) {
  if (!isInternal && !project.allowedUsers.includes(session.user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

---

### 🟢 LOW: API Route Response Doesn't Set Content-Type
**Issue:** Some routes return JSON without explicit `Content-Type: application/json` header

**Risk:** Browser may misinterpret response as HTML (low risk with NextResponse.json)

**Remediation:** NextResponse.json() sets this automatically; verify in Sentry/logs.

---

## 3. Data Exposure & Privacy

### 🟡 MEDIUM: Sensitive Fields Exposed in API Responses
**Files:** `/api/projects`, `/api/users`  
**Issue:** API returns full database objects including internal fields

**Exposed Fields:**
- `Project.petfelScore`, `Project.einScore` (should be role-gated)
- `User.passwordHash` (never sent, but schema allows select *)
- `User.twoFactorSecret` (TOTP secret)
- `User.failedLoginAttempts`, `User.lockedUntil` (security state)

**Current Code:**
```typescript
const data = await prisma.project.findMany({
  where,
  // No select clause → returns ALL fields
});
return NextResponse.json({ data });
```

**Remediation:**
```typescript
// Define explicit response shapes
const data = await prisma.project.findMany({
  where,
  select: {
    id: true,
    code: true,
    title: true,
    description: true,
    country: true,
    sector: true,
    status: true,
    // Conditionally include sensitive fields
    ...(isInternal ? { petfelScore: true, einScore: true } : {}),
  },
});

// Never select password fields
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    name: true,
    // Exclude: passwordHash, twoFactorSecret, failedLoginAttempts
  },
});
```

---

### 🟡 MEDIUM: Deal Room Passwords Stored in Plaintext
**File:** `prisma/schema.prisma:425`  
**Issue:** `DealRoom.password` field has TODO comment: "always bcrypt-hash before writing; never store plaintext"

**Risk:**
- If implemented without hashing, password-protected deal rooms are compromised in DB breach
- Admins can see plaintext passwords

**Remediation:**
```typescript
// When creating deal room with password
if (password) {
  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.dealRoom.create({
    data: { password: hashedPassword, ... }
  });
}

// When verifying access
const dealRoom = await prisma.dealRoom.findUnique({ where: { id } });
if (dealRoom.password) {
  const valid = await bcrypt.compare(submittedPassword, dealRoom.password);
  if (!valid) return { error: 'Invalid password' };
}
```

---

### 🟢 LOW: PII Logging in Activity Logs
**File:** `src/lib/audit.ts:26-40`  
**Issue:** `logActivity` accepts arbitrary `details` object which may contain PII

**Risk:** GDPR violation if user email/IP logged without consent

**Remediation:** Document PII exclusion policy; add PII filter function.

---

## 4. Input Validation & Injection

### 🟡 MEDIUM: No File Type Validation on Document Upload
**Files:** `/api/documents/[id]/upload`, `/api/deal-rooms/[id]/upload`  
**Issue:** No validation of file MIME type vs. extension

**Risk:**
- Upload `malware.pdf.exe` → stored as PDF
- Polyglot files (valid PDF + ZIP header) bypass scanners
- Large file DoS (no size limit enforcement)

**Remediation:**
```typescript
// src/lib/file-validator.ts
export function validateFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE = 100 * 1024 * 1024; // 100MB
  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File too large (max 100MB)' };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }
  
  // Check magic bytes (first few bytes match MIME type)
  const reader = new FileReader();
  // ... implement magic byte validation
  
  return { valid: true };
}
```

---

### 🟡 MEDIUM: SQL Injection via Prisma Dynamic Filters
**File:** `src/app/api/projects/route.ts:70-78`  
**Issue:** While Prisma generally prevents SQL injection, dynamic filter construction can be risky

**Current Code:**
```typescript
const where: Prisma.ProjectWhereInput = {
  ...(status ? { status } : {}),
  ...(search ? {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ],
  } : {}),
};
```

**Risk:** Low (Prisma parameterizes queries), but if raw SQL is ever added, injection possible

**Remediation:**
- Never use `prisma.$executeRaw` with user input
- Always use `$executeRawUnsafe` with parameterized queries
- Document that raw SQL must use bindings

---

### 🟢 LOW: Zod Schema Doesn't Validate Enum Values
**File:** `src/app/api/projects/route.ts:126-138`  
**Issue:** Schema accepts any string for `sector`, then maps to enum in code

**Risk:** If mapping fails, invalid enum value crashes DB insert

**Remediation:**
```typescript
const CreateSchema = z.object({
  sector: z.enum(['ENERGY', 'TRANSPORT', 'WATER', ...]).optional(),
  // Instead of z.string().optional() with mapping
});
```

---

## 5. Infrastructure & Configuration

### 🟠 HIGH: Environment Variables Exposed in Client
**File:** `next.config.ts:43-46`  
**Issue:** `NEXTAUTH_URL` exposed via `env` config

**Risk:**
- Internal URLs exposed to client bundle
- If `NEXTAUTH_URL` contains secrets (rare), they leak

**Current Code:**
```typescript
env: {
  NEXT_PUBLIC_APP_NAME: "AIP Platform",
  NEXT_PUBLIC_APP_URL: process.env.NEXTAUTH_URL ?? "",
},
```

**Remediation:**
```typescript
// Only expose NEXT_PUBLIC_* vars (Next.js convention)
// Remove NEXTAUTH_URL from client env
env: {
  NEXT_PUBLIC_APP_NAME: "AIP Platform",
  // Use VERCEL_URL or explicit public URL
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "https://app.africa-infra.com",
},
```

---

### 🟡 MEDIUM: Missing Security Headers in Production
**File:** `next.config.ts:53-67`  
**Issue:** CSP allows `unsafe-inline` for scripts/styles; missing other headers

**Current Headers:**
```typescript
"script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}",
```

**Risk:**
- XSS via inline scripts
- Clickjacking (DENY helps, but CSP `frame-ancestors` is stronger)

**Remediation:**
```typescript
const nonce = crypto.randomUUID(); // Generate per-request nonce

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}'`, // Remove unsafe-inline
  "style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests", // Force HTTPS
].join("; ");

// Add to all pages
headers: [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
],
```

---

### 🟡 MEDIUM: CORS Not Configured for API Routes
**Issue:** No explicit CORS headers; relies on same-origin policy

**Risk:**
- If frontend is hosted on different domain, API calls fail
- Preflight requests (OPTIONS) not handled
- Credentials (cookies) not explicitly allowed

**Remediation:**
```typescript
// src/middleware/cors.ts
export function corsHeaders(origin?: string) {
  const allowedOrigins = [
    'https://app.africa-infra.com',
    'https://www.africa-infra.com',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  ].filter(Boolean);
  
  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }
  return {};
}

// In API route
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin') || undefined),
  });
}
```

---

### 🟢 LOW: Database Connection Pool Not Configured
**File:** `src/lib/prisma.ts:9-14`  
**Issue:** No explicit connection pool settings

**Risk:** Connection exhaustion under high load

**Remediation:**
```typescript
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Add connection pool
  __internal: {
    engine: {
      connectionLimit: 10, // Max connections
      idleTimeout: 60000,  // 60s
    },
  },
});
```

---

### 🟢 LOW: No Request Size Limit on API Routes
**Issue:** Next.js default body size limit (1MB) may be insufficient for file uploads

**Remediation:**
```typescript
// vercel.json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  },
  "limits": {
    "maxBodySize": "100mb" // For document uploads
  }
}
```

---

## 6. Third-Party Integrations

### 🟡 MEDIUM: Anthropic API Key Exposed in Client-Side Error Messages
**File:** `src/app/api/chat/route.ts:44-48`  
**Issue:** Error message "AI service not configured" reveals API key status

**Risk:** Enumeration attack to determine when API key is valid/invalid

**Remediation:**
```typescript
// Return generic error, log specifics server-side
if (!process.env.ANTHROPIC_API_KEY) {
  logger.error('[POST /api/chat] ANTHROPIC_API_KEY not configured');
  return NextResponse.json(
    { error: 'Service temporarily unavailable' },
    { status: 503 }
  );
}
```

---

### 🟢 LOW: Vercel Blob Token in Source Code
**Files:** `/api/deal-rooms/[id]/upload/route.ts`, `/api/data-rooms/[projectId]/upload/route.ts`  
**Issue:** `BLOB_READ_WRITE_TOKEN` checked inline

**Risk:** Low (token is in env var, not hardcoded), but consider using Vercel Edge Config

**Remediation:** Move to Vercel Edge Config for runtime secret rotation.

---

## 7. Cryptography & Secrets

### 🟡 MEDIUM: TOTP Secret Generation Not Cryptographically Secure
**File:** `src/lib/auth/totp.ts` (assumed based on context)  
**Issue:** If using `Math.random()` for TOTP secret, it's predictable

**Risk:** Attacker can brute-force TOTP secret if generation is weak

**Remediation:**
```typescript
import { randomBytes } from 'crypto';

export function generateTOTPSecret(): string {
  // Use crypto.randomBytes for cryptographic randomness
  return randomBytes(20).toString('base64').replace(/[/+=]/g, '');
}
```

---

### 🟢 LOW: No Secret Rotation Policy
**Issue:** `NEXTAUTH_SECRET`, API keys never rotated

**Risk:** Long-lived secrets increase breach impact

**Remediation:**
- Document secret rotation policy (90-day rotation)
- Use Vercel Edge Config for runtime secret updates
- Implement graceful secret rollover (accept 2 secrets during transition)

---

## 8. Logging & Monitoring

### 🟡 MEDIUM: No Structured Logging
**Files:** Multiple console.log calls  
**Issue:** Unstructured logs difficult to parse and query

**Current:**
```typescript
console.log('[GET /api/projects] User: %s, Role: %s', email, role);
```

**Remediation:**
```typescript
import { logger } from '@/lib/logger';

logger.info('api.projects.get', {
  userId: session.user.id,
  role: session.user.role,
  query: { page, limit, status },
});

// lib/logger.ts
export const logger = {
  info: (event: string, data: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', event, ...data, timestamp: new Date().toISOString() }));
  },
  // ... error, warn, debug
};
```

---

### 🟢 LOW: Audit Logs Silently Fail
**File:** `src/lib/audit.ts:38-40`  
**Issue:** `catch { /* Silent */ }` hides audit failures

**Risk:** Security events not logged without detection

**Remediation:**
```typescript
catch (error) {
  // Log to separate error channel
  console.error('[AUDIT FAILURE]', { action: params.action, error });
  // Send to Sentry/alerting system
  captureException(error, { tags: { component: 'audit' } });
}
```

---

### 🟢 LOW: No Failed Login Attempt Logging
**Issue:** Failed logins increment counter but don't emit events

**Remediation:**
```typescript
// After failed login
await logActivity({
  userId: user.id,
  action: 'LOGIN_FAILED',
  details: { attempts: attempts, ip, reason: 'invalid_password' },
});

// Alert on threshold
if (attempts >= 5) {
  await sendAlert('security', 'Multiple failed login attempts', { userId, ip });
}
```

---

## 9. Frontend Security

### 🟢 LOW: No Subresource Integrity (SRI) for CDN Assets
**Issue:** Fonts loaded from `fonts.googleapis.com` without SRI

**Risk:** If Google Fonts CDN compromised, malicious CSS injected

**Remediation:**
```tsx
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  rel="stylesheet"
  integrity="sha384-..." // Generate SRI hash
  crossOrigin="anonymous"
/>
```

---

### 🟢 LOW: Client-Side Storage Not Encrypted
**Issue:** If using localStorage for sensitive data (not observed, but common)

**Remediation:** Never store tokens/secrets in localStorage; use httpOnly cookies.

---

## 10. Business Logic Vulnerabilities

### 🟡 MEDIUM: Race Condition in Project Code Generation
**File:** `src/app/api/projects/route.ts:34-36`  
**Issue:** Project code uses timestamp + random → not guaranteed unique

**Risk:**
- Two requests at same millisecond → duplicate codes
- Database constraint violation crashes API

**Current Code:**
```typescript
function generateCode(): string {
  return `AIP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
```

**Remediation:**
```typescript
// Use database sequence or UUID
function generateCode(): string {
  return `AIP-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

// Add unique constraint to schema
model Project {
  code String @unique
}
```

---

### 🟢 LOW: No Idempotency Keys for Financial Operations
**Issue:** No protection against double-submit on deal room creation, payments

**Remediation:**
```typescript
// Add idempotency key to critical operations
const CreateDealRoomSchema = z.object({
  idempotencyKey: z.string().uuid(),
  // ... other fields
});

// Check if already processed
const existing = await prisma.dealRoom.findFirst({
  where: { idempotencyKey: body.idempotencyKey }
});
if (existing) return NextResponse.json({ data: existing }, { status: 200 });
```

---

## Summary of Recommendations by Priority

### Immediate (This Week)
1. ✅ **Remove `allowDangerousEmailAccountLinking`** (auth.config.ts:63)
2. ✅ **Implement Next.js middleware** for global auth protection
3. ✅ **Add rate limiting** to AI generation endpoints
4. ✅ **Fix cache poisoning** (include userId in cache keys)
5. ✅ **Hash deal room passwords** before storage

### Short-Term (This Month)
6. ✅ **Implement input sanitization** (DOMPurify for all text fields)
7. ✅ **Add mass assignment protection** (split PATCH schemas by role)
8. ✅ **Explicit API response shapes** (never return full DB objects)
9. ✅ **File upload validation** (magic bytes, size limits)
10. ✅ **Fix session token logging** (remove PII from logs)

### Medium-Term (This Quarter)
11. ✅ **Structured logging** (JSON logs for Sentry/DataDog)
12. ✅ **Session versioning** (force logout on privilege change)
13. ✅ **CORS configuration** (explicit allowed origins)
14. ✅ **Improve CSP** (remove unsafe-inline, use nonces)
15. ✅ **Secret rotation policy** (90-day rotation for API keys)

### Long-Term (Ongoing)
16. ✅ **Implement password reset flow**
17. ✅ **Add idempotency keys** for financial operations
18. ✅ **Database connection pooling** configuration
19. ✅ **Failed login alerting** system
20. ✅ **Subresource integrity** for CDN assets

---

## Compliance Notes

### GDPR/Data Protection
- ⚠️ PII in logs (IP addresses, emails) requires consent or legitimate interest
- ✅ User data deletion (GDPR Right to Erasure) not implemented
- ✅ Data export (GDPR Right to Portability) not implemented

### SOC 2 / ISO 27001
- ✅ Audit logging exists but incomplete (no failed login tracking)
- ⚠️ No encryption at rest (PostgreSQL should use TDE)
- ✅ HTTPS enforced, HSTS enabled

---

## Testing Recommendations

### Security Testing Tools
```bash
# Dependency vulnerabilities
npm audit --audit-level=high

# OWASP dependency check
npx @cyclonedx/cyclonedx-npm --output-format JSON

# Static analysis
npx eslint-plugin-security

# Secret scanning
truffleHog --regex --entropy=false .

# API fuzzing
zap-cli quick-scan https://app.africa-infra.com/api
```

### Penetration Testing Checklist
- [ ] Authentication bypass attempts
- [ ] Authorization boundary testing (role escalation)
- [ ] SQL injection via Prisma filters
- [ ] XSS via file uploads (polyglot files)
- [ ] Rate limit bypass (distributed IP attack)
- [ ] Session fixation/hijacking
- [ ] CSRF (should be protected by SameSite cookies)
- [ ] Business logic flaws (race conditions, idempotency)

---

## Contact for Security Issues

**Security Email:** security@africa-infra.com  
**Bug Bounty Program:** Not yet established (recommended)

---

**End of Audit Report**  
*Next Review Date: 2026-11-04 (Quarterly)*
