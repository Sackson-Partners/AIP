# CSP Nonce Implementation Guide

## Current Issue

**Security Risk:** XSS vulnerability via `unsafe-inline` in Content Security Policy

Current CSP (next.config.ts:10-11):
```javascript
script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
```

**Vulnerability:**
- Allows ANY inline `<script>` and `<style>` tags
- Attackers can inject malicious scripts via template injection
- CSS injection can exfiltrate data via background-image URLs

**Solution:** Nonce-based CSP - only scripts/styles with matching nonce execute

---

## Implementation Steps (4 hours)

### Step 1: Generate Nonce in Middleware (30 min)

**File:** `src/proxy.ts`

```typescript
import crypto from 'crypto'
import { headers } from 'next/headers'

export default withAuth(
  async function middleware(req) {
    // Generate cryptographically secure nonce
    const nonce = crypto.randomBytes(16).toString('base64')
    
    // Store nonce in header for pages to access
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-nonce', nonce)
    
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
    
    // Add CSP header with nonce
    const csp = `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com;
      style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: blob: https: https://graph.microsoft.com https://*.blob.core.windows.net;
      connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com https://*.azure.com https://*.windows.net https://api.anthropic.com https://va.vercel-analytics.com;
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self';
      object-src 'none';
      upgrade-insecure-requests;
    `.replace(/\s+/g, ' ').trim()
    
    response.headers.set('Content-Security-Policy', csp)
    
    return response
  },
  // ... rest of config
)
```

### Step 2: Remove Static CSP from next.config.ts (15 min)

**File:** `next.config.ts`

```typescript
// REMOVE these lines:
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // ...
].join("; ");

// REMOVE from headers():
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        // { key: "Content-Security-Policy", value: CSP }, <- REMOVE THIS
        { key: "X-Content-Type-Options",  value: "nosniff" },
        // ... keep other headers
      ],
    },
  ];
},
```

**Why:** CSP must be dynamic (per-request) for nonces to work.

### Step 3: Create Nonce Context Provider (45 min)

**File:** `src/lib/csp-nonce.tsx` (NEW)

```typescript
'use client'

import { createContext, useContext } from 'react'

const NonceContext = createContext<string | undefined>(undefined)

export function NonceProvider({ 
  nonce, 
  children 
}: { 
  nonce?: string
  children: React.ReactNode 
}) {
  return (
    <NonceContext.Provider value={nonce}>
      {children}
    </NonceContext.Provider>
  )
}

export function useNonce() {
  return useContext(NonceContext)
}

/**
 * Server-side helper to get nonce from headers
 */
export async function getNonce() {
  const { headers } = await import('next/headers')
  const headersList = await headers()
  return headersList.get('x-nonce') || undefined
}
```

### Step 4: Update Root Layout (30 min)

**File:** `src/app/layout.tsx`

```typescript
import { getNonce, NonceProvider } from '@/lib/csp-nonce'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = await getNonce()

  return (
    <html lang="en">
      <head>
        {/* Add nonce to any inline scripts */}
        <script nonce={nonce} dangerouslySetInnerHTML={{
          __html: `
            // Analytics or other inline scripts
            window.__APP_VERSION__ = '${process.env.APP_VERSION}';
          `
        }} />
      </head>
      <body className={inter.className}>
        <NonceProvider nonce={nonce}>
          <SessionProvider>
            <ToastProvider>
              <SearchProvider>
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </SearchProvider>
            </ToastProvider>
          </SessionProvider>
        </NonceProvider>
      </body>
    </html>
  )
}
```

### Step 5: Update All Inline Scripts/Styles (1.5 hours)

**Find all inline scripts:**
```bash
grep -r "dangerouslySetInnerHTML\|<script\|<style" src/app --include="*.tsx" | grep -v node_modules
```

**For each inline script/style, add nonce:**

**Before:**
```tsx
<script dangerouslySetInnerHTML={{ __html: 'console.log("test")' }} />
```

**After:**
```tsx
'use client'
import { useNonce } from '@/lib/csp-nonce'

function MyComponent() {
  const nonce = useNonce()
  
  return (
    <script 
      nonce={nonce} 
      dangerouslySetInnerHTML={{ __html: 'console.log("test")' }} 
    />
  )
}
```

**Common locations to update:**
- `src/app/layout.tsx` - root scripts
- `src/app/dashboard/layout.tsx` - dashboard scripts
- Any page with inline styles or scripts
- Third-party integrations (analytics, etc.)

### Step 6: Handle Next.js Inline Scripts (30 min)

Next.js injects inline scripts for hydration. These need special handling:

**Option A: Use experimental config (Next.js 14+)**

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    strictNextHead: true,
  },
  // ...
}
```

**Option B: Custom Document (if using pages/)**

```typescript
// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document'
import { headers } from 'next/headers'

export default function Document() {
  const nonce = headers().get('x-nonce')
  
  return (
    <Html lang="en">
      <Head nonce={nonce} />
      <body>
        <Main />
        <NextScript nonce={nonce} />
      </body>
    </Html>
  )
}
```

### Step 7: Test CSP Compliance (30 min)

**1. Check browser console for CSP violations:**

```javascript
// Add CSP violation listener
document.addEventListener('securitypolicyviolation', (e) => {
  console.error('CSP Violation:', {
    blockedURI: e.blockedURI,
    violatedDirective: e.violatedDirective,
    originalPolicy: e.originalPolicy,
  })
})
```

**2. Use CSP validator:**
- https://csp-evaluator.withgoogle.com/
- Paste your CSP header

**3. Test in production:**
```bash
# Check CSP header is set
curl -I https://app.africa-infra.com

# Should see:
# Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-ABC123...'
```

**4. Monitor violations:**
- Add `report-uri` directive to CSP
- Set up endpoint to collect violations
- Review violations weekly

---

## Verification Checklist

- [ ] Nonce generated in middleware (crypto.randomBytes)
- [ ] Nonce stored in request header (x-nonce)
- [ ] CSP header includes `script-src 'nonce-${nonce}'`
- [ ] CSP header includes `style-src 'nonce-${nonce}'`
- [ ] Static CSP removed from next.config.ts
- [ ] NonceProvider wraps app in layout.tsx
- [ ] All inline scripts have `nonce={nonce}`
- [ ] All inline styles have `nonce={nonce}`
- [ ] No CSP violations in browser console
- [ ] Next.js hydration scripts work
- [ ] Third-party scripts still load
- [ ] Tested in production

---

## Common Pitfalls

### 1. Next.js Hydration Scripts Blocked

**Symptom:** Page loads but interactive features don't work

**Fix:** Ensure NextScript component has nonce:
```tsx
<NextScript nonce={nonce} />
```

### 2. Nonce Changes on Every Request

**Symptom:** CSP violations on client-side navigation

**Fix:** This is expected! Each request gets new nonce for security.

### 3. Third-Party Scripts Blocked

**Symptom:** Analytics, ads, or widgets don't load

**Fix:** Add domain to CSP whitelist:
```typescript
script-src 'self' 'nonce-${nonce}' https://allowed-domain.com
```

### 4. Vercel Analytics Blocked

**Symptom:** `/_vercel/insights/script.js` fails to load

**Fix:** Already included in CSP:
```typescript
script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com
```

---

## Performance Impact

**Before (unsafe-inline):**
- All inline scripts execute
- No nonce computation
- Static CSP header

**After (nonce-based):**
- Only approved inline scripts execute
- +0.1ms per request (nonce generation)
- Dynamic CSP header

**Net Impact:** Negligible performance cost, massive security improvement

---

## Rollback Plan

If CSP breaks critical functionality:

**1. Quick Rollback (2 minutes):**

```typescript
// src/proxy.ts - comment out CSP header
// response.headers.set('Content-Security-Policy', csp)

// next.config.ts - re-enable static CSP
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // TEMPORARY - revert after fix
  // ...
].join("; ")
```

**2. Deploy rollback:**
```bash
git add -A
git commit -m "revert: temporarily disable CSP nonces"
git push origin main
```

**3. Fix violations:**
- Review browser console
- Add missing nonces
- Whitelist necessary domains

**4. Re-enable CSP nonces**

---

## Testing Script

```bash
#!/bin/bash
# test-csp.sh

echo "🔍 Testing CSP implementation..."

# 1. Check nonce in HTML
NONCE=$(curl -s https://app.africa-infra.com | grep -o "nonce-[A-Za-z0-9+/=]*" | head -1 | cut -d'-' -f2)

if [ -z "$NONCE" ]; then
  echo "❌ No nonce found in HTML"
  exit 1
fi

echo "✅ Nonce found: $NONCE"

# 2. Check CSP header includes nonce
CSP=$(curl -sI https://app.africa-infra.com | grep -i "content-security-policy" | grep "nonce-$NONCE")

if [ -z "$CSP" ]; then
  echo "❌ CSP header missing nonce"
  exit 1
fi

echo "✅ CSP header includes nonce"

# 3. Check unsafe-inline is removed
UNSAFE=$(curl -sI https://app.africa-infra.com | grep -i "content-security-policy" | grep "unsafe-inline")

if [ -n "$UNSAFE" ]; then
  echo "❌ CSP still contains unsafe-inline"
  exit 1
fi

echo "✅ unsafe-inline removed from CSP"

echo "🎉 CSP nonce implementation verified!"
```

---

## Resources

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Next.js: Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [OWASP: CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

---

**Estimated Implementation Time:** 4 hours  
**Security Impact:** HIGH - Eliminates XSS via inline injection  
**Complexity:** MEDIUM - Requires careful testing  
**Priority:** HIGH - Close critical vulnerability

**Status:** Ready for implementation (guide complete)  
**Next Step:** Assign to engineer for implementation  
**Review:** Requires security team sign-off after testing
