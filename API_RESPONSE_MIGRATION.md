# API Response Format Standardization

**Date:** 2026-09-11  
**Feature:** Task #17 - Standardize API Response Format  
**Impact:** 🔄 Consistent client handling, better error messages, type safety

---

## Overview

Standardized API response format provides **consistent structure** across all endpoints, making it easier for clients to:
- Handle responses uniformly
- Parse errors consistently
- Implement type-safe API clients
- Display user-friendly error messages

---

## Standard Response Formats

### Success Response

**Structure:**
```typescript
{
  "success": true,
  "data": T,                    // Response payload
  "message": "Optional message",
  "meta": {                     // Optional metadata
    "timestamp": "2026-09-11T10:30:00.000Z",
    "requestId": "req-123"
  },
  "pagination": {               // Optional pagination (for lists)
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "warning": "Optional warning" // Optional non-blocking warning
}
```

---

### Error Response

**Structure:**
```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { /* error details */ },
    "field": "email",            // Optional field that caused error
    "stack": "..."               // Only in development
  },
  "meta": {
    "timestamp": "2026-09-11T10:30:00.000Z"
  }
}
```

---

## Error Codes

**Standard Error Codes:**
```typescript
'BAD_REQUEST'         // 400 - Invalid request format
'UNAUTHORIZED'        // 401 - Authentication required
'FORBIDDEN'           // 403 - Insufficient permissions
'NOT_FOUND'           // 404 - Resource not found
'CONFLICT'            // 409 - Resource conflict (duplicate)
'VALIDATION_ERROR'    // 422 - Request validation failed
'RATE_LIMITED'        // 429 - Too many requests
'INTERNAL_ERROR'      // 500 - Server error
'SERVICE_UNAVAILABLE' // 503 - Service temporarily down
```

---

## API Helper Functions

### Success Responses

#### apiSuccess()
```typescript
import { apiSuccess } from '@/lib/api-response'

export async function GET() {
  const user = await prisma.user.findUnique({ where: { id } })
  
  return apiSuccess(user, {
    message: 'User retrieved successfully',
    meta: { cached: false },
  })
}

// Response:
// {
//   "success": true,
//   "data": { "id": "user-123", "name": "John Doe" },
//   "message": "User retrieved successfully",
//   "meta": { "timestamp": "...", "cached": false }
// }
```

---

#### apiCreated() - 201 Status
```typescript
import { apiCreated } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const project = await prisma.project.create({ data })
  
  return apiCreated(project, {
    message: 'Project created successfully',
  })
}

// Response (201 Created):
// {
//   "success": true,
//   "data": { "id": "proj-123", "title": "New Project" },
//   "message": "Project created successfully"
// }
```

---

#### apiList() - Paginated Lists
```typescript
import { apiList } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  
  const [data, total] = await Promise.all([
    prisma.project.findMany({ skip: (page - 1) * limit, take: limit }),
    prisma.project.count(),
  ])
  
  return apiList(data, {
    page,
    limit,
    total,
  })
}

// Response:
// {
//   "success": true,
//   "data": [{ "id": "proj-1" }, { "id": "proj-2" }],
//   "pagination": {
//     "page": 1,
//     "limit": 20,
//     "total": 150,
//     "pages": 8,
//     "hasNext": true,
//     "hasPrev": false
//   }
// }
```

---

#### apiNoContent() - 204 Status
```typescript
import { apiNoContent } from '@/lib/api-response'

export async function DELETE(req: NextRequest) {
  await prisma.project.delete({ where: { id } })
  
  return apiNoContent()
}

// Response: 204 No Content (empty body)
```

---

### Error Responses

#### apiError() - Generic Error
```typescript
import { apiError } from '@/lib/api-response'

export async function GET() {
  try {
    const data = await fetchData()
    return apiSuccess(data)
  } catch (error) {
    return apiError(error instanceof Error ? error : 'Unknown error', {
      code: 'FETCH_FAILED',
      status: 500,
    })
  }
}

// Response (500 Internal Server Error):
// {
//   "success": false,
//   "error": {
//     "code": "FETCH_FAILED",
//     "message": "Connection timeout",
//     "stack": "..." // Only in development
//   },
//   "meta": { "timestamp": "..." }
// }
```

---

#### apiValidationError() - 422 Status
```typescript
import { apiValidationError } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(body)
  
  if (!parsed.success) {
    return apiValidationError(
      'Validation failed',
      parsed.error.flatten(),
      'email' // Field that failed
    )
  }
}

// Response (422 Unprocessable Entity):
// {
//   "success": false,
//   "error": {
//     "code": "VALIDATION_ERROR",
//     "message": "Validation failed",
//     "field": "email",
//     "details": {
//       "fieldErrors": { "email": ["Invalid email format"] }
//     }
//   }
// }
```

---

#### apiUnauthorized() - 401 Status
```typescript
import { apiUnauthorized } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return apiUnauthorized()
  }
}

// Response (401 Unauthorized):
// {
//   "success": false,
//   "error": {
//     "code": "UNAUTHORIZED",
//     "message": "Unauthorized - authentication required"
//   }
// }
```

---

#### apiForbidden() - 403 Status
```typescript
import { apiForbidden } from '@/lib/api-response'

export async function DELETE(req: NextRequest) {
  if (session.user.role !== 'SUPER_ADMIN') {
    return apiForbidden('Only super admins can delete projects')
  }
}

// Response (403 Forbidden):
// {
//   "success": false,
//   "error": {
//     "code": "FORBIDDEN",
//     "message": "Only super admins can delete projects"
//   }
// }
```

---

#### apiNotFound() - 404 Status
```typescript
import { apiNotFound } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const project = await prisma.project.findUnique({ where: { id } })
  
  if (!project) {
    return apiNotFound('Project')
  }
}

// Response (404 Not Found):
// {
//   "success": false,
//   "error": {
//     "code": "NOT_FOUND",
//     "message": "Project not found"
//   }
// }
```

---

#### apiConflict() - 409 Status
```typescript
import { apiConflict } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const existing = await prisma.user.findUnique({ where: { email } })
  
  if (existing) {
    return apiConflict('User with this email already exists')
  }
}

// Response (409 Conflict):
// {
//   "success": false,
//   "error": {
//     "code": "CONFLICT",
//     "message": "User with this email already exists"
//   }
// }
```

---

#### apiRateLimited() - 429 Status
```typescript
import { apiRateLimited } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const rateLimitResult = await checkRateLimit(req)
  
  if (!rateLimitResult.success) {
    return apiRateLimited(60) // Retry after 60 seconds
  }
}

// Response (429 Too Many Requests):
// Headers: Retry-After: 60
// {
//   "success": false,
//   "error": {
//     "code": "RATE_LIMITED",
//     "message": "Rate limit exceeded"
//   },
//   "meta": {
//     "timestamp": "...",
//     "retryAfter": 60
//   }
// }
```

---

## Migration Patterns

### Pattern 1: Simple GET Endpoint

**Before:**
```typescript
export async function GET() {
  const user = await prisma.user.findUnique({ where: { id } })
  
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  return NextResponse.json({ user })
}
```

**After:**
```typescript
import { apiSuccess, apiNotFound } from '@/lib/api-response'

export async function GET() {
  const user = await prisma.user.findUnique({ where: { id } })
  
  if (!user) {
    return apiNotFound('User')
  }
  
  return apiSuccess(user)
}
```

---

### Pattern 2: POST with Validation

**Before:**
```typescript
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(body)
  
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }
  
  const project = await prisma.project.create({ data: parsed.data })
  return NextResponse.json({ project }, { status: 201 })
}
```

**After:**
```typescript
import { apiCreated, apiValidationError } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(body)
  
  if (!parsed.success) {
    return apiValidationError('Validation failed', parsed.error.flatten())
  }
  
  const project = await prisma.project.create({ data: parsed.data })
  return apiCreated(project)
}
```

---

### Pattern 3: Paginated List

**Before:**
```typescript
export async function GET(req: NextRequest) {
  const [data, total] = await Promise.all([
    prisma.project.findMany({ skip, take: limit }),
    prisma.project.count(),
  ])
  
  return NextResponse.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}
```

**After:**
```typescript
import { apiList } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const [data, total] = await Promise.all([
    prisma.project.findMany({ skip, take: limit }),
    prisma.project.count(),
  ])
  
  return apiList(data, { page, limit, total })
}
```

---

### Pattern 4: DELETE Endpoint

**Before:**
```typescript
export async function DELETE(req: NextRequest) {
  await prisma.project.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

**After:**
```typescript
import { apiNoContent } from '@/lib/api-response'

export async function DELETE(req: NextRequest) {
  await prisma.project.delete({ where: { id } })
  return apiNoContent()
}
```

---

### Pattern 5: Error Handling

**Before:**
```typescript
export async function GET() {
  try {
    const data = await fetchData()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Fetch failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**After:**
```typescript
import { apiSuccess, apiError } from '@/lib/api-response'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const data = await fetchData()
    return apiSuccess(data)
  } catch (error) {
    logger.error('Fetch failed', error)
    return apiError(error instanceof Error ? error : 'Internal error')
  }
}
```

---

## Client-Side TypeScript Types

### Type-Safe API Client

```typescript
// types/api.ts
import { ApiSuccessResponse, ApiErrorResponse } from '@/lib/api-response'

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// Client-side fetch wrapper
export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(url, options)
  return response.json() as Promise<ApiResponse<T>>
}

// Usage in components
import { apiRequest, isApiSuccess } from '@/lib/api-client'

const response = await apiRequest<Project>('/api/projects/123')

if (isApiSuccess(response)) {
  console.log('Success:', response.data)
  // TypeScript knows response.data is Project
} else {
  console.error('Error:', response.error.message)
  // TypeScript knows response.error exists
}
```

---

### React Query Integration

```typescript
import { useQuery } from '@tanstack/react-query'
import { apiRequest, isApiSuccess } from '@/lib/api-client'

function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const response = await apiRequest<Project>(`/api/projects/${id}`)
      
      if (!isApiSuccess(response)) {
        throw new Error(response.error.message)
      }
      
      return response.data
    },
  })
}

// Component
function ProjectDetail({ id }: { id: string }) {
  const { data: project, error, isLoading } = useProject(id)
  
  if (isLoading) return <Loading />
  if (error) return <Error message={error.message} />
  
  return <div>{project.title}</div>
}
```

---

## Benefits

### 1. Consistent Client Handling ✅

**Before (inconsistent):**
```typescript
// Endpoint A returns:
{ "user": { ... } }

// Endpoint B returns:
{ "data": { ... } }

// Endpoint C returns:
{ "result": { ... } }

// Client must handle 3 different formats
```

**After (consistent):**
```typescript
// All endpoints return:
{ "success": true, "data": { ... } }

// Client handles one format
if (response.success) {
  handleData(response.data)
}
```

---

### 2. Better Error Messages ✅

**Before:**
```json
{ "error": "Validation failed" }
// What field? What was wrong?
```

**After:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "field": "email",
    "details": {
      "fieldErrors": { "email": ["Invalid email format"] }
    }
  }
}
// Clear error with actionable details
```

---

### 3. Type Safety ✅

```typescript
// Type-safe response handling
const response = await fetch('/api/projects')
const result: ApiResponse<Project[]> = await response.json()

if (isApiSuccess(result)) {
  // TypeScript knows result.data is Project[]
  result.data.forEach(project => {
    console.log(project.title) // ✅ Type-safe
  })
} else {
  // TypeScript knows result.error exists
  console.error(result.error.code) // ✅ Type-safe
}
```

---

### 4. Automatic Pagination Metadata ✅

```typescript
return apiList(projects, { page, limit, total })

// Automatically includes:
// - pages: Math.ceil(total / limit)
// - hasNext: page < pages
// - hasPrev: page > 1
```

---

### 5. Development-Only Debug Info ✅

```json
{
  "error": {
    "message": "Database connection failed",
    "stack": "Error: Connection timeout\n  at ..." // Only in dev
  }
}
```

Production: No stack trace (security)
Development: Full stack trace (debugging)

---

## Migration Checklist

### Phase 1: High-Traffic Endpoints (Week 1)
- [ ] `GET /api/projects` (list)
- [ ] `GET /api/projects/[id]` (detail)
- [ ] `POST /api/projects` (create)
- [ ] `PATCH /api/projects/[id]` (update)
- [ ] `GET /api/investors` (list)
- [ ] `GET /api/admin/users` (list)
- [ ] `POST /api/auth/*` (authentication)

### Phase 2: Admin Endpoints (Week 2)
- [ ] `GET /api/admin/users/[id]`
- [ ] `PATCH /api/admin/users/[id]`
- [ ] `POST /api/admin/users`
- [ ] All other `/api/admin/*` endpoints

### Phase 3: Remaining Endpoints (Week 3)
- [ ] Document endpoints
- [ ] Milestone endpoints
- [ ] Deal room endpoints
- [ ] Notification endpoints
- [ ] All other endpoints

---

## Testing

### Test 1: Success Response Format
```bash
curl https://app.africa-infra.com/api/projects/proj-123

# Expected:
{
  "success": true,
  "data": {
    "id": "proj-123",
    "title": "Project Title"
  },
  "meta": {
    "timestamp": "2026-09-11T10:30:00.000Z"
  }
}
```

---

### Test 2: Error Response Format
```bash
curl https://app.africa-infra.com/api/projects/nonexistent

# Expected (404):
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found"
  },
  "meta": {
    "timestamp": "2026-09-11T10:30:00.000Z"
  }
}
```

---

### Test 3: Validation Error Format
```bash
curl -X POST https://app.africa-infra.com/api/projects \
  -d '{"title": ""}'

# Expected (422):
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "field": "title",
    "details": {
      "fieldErrors": { "title": ["String must contain at least 1 character(s)"] }
    }
  }
}
```

---

### Test 4: Paginated List Format
```bash
curl https://app.africa-infra.com/api/projects?page=2&limit=20

# Expected:
{
  "success": true,
  "data": [ /* 20 projects */ ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## Summary

Standardized API response format provides **consistent, type-safe, developer-friendly** responses across all endpoints.

**Key Features:**
- ✅ Uniform success/error structure
- ✅ Standard error codes
- ✅ Type-safe TypeScript interfaces
- ✅ Helper functions for common patterns
- ✅ Automatic pagination metadata
- ✅ Development-only debug info
- ✅ Non-blocking warnings support

**Helper Functions:**
- ✅ `apiSuccess()` - Standard success response
- ✅ `apiCreated()` - 201 Created response
- ✅ `apiList()` - Paginated list response
- ✅ `apiNoContent()` - 204 No Content
- ✅ `apiError()` - Generic error
- ✅ `apiValidationError()` - 422 Validation error
- ✅ `apiUnauthorized()` - 401 Unauthorized
- ✅ `apiForbidden()` - 403 Forbidden
- ✅ `apiNotFound()` - 404 Not Found
- ✅ `apiConflict()` - 409 Conflict
- ✅ `apiRateLimited()` - 429 Rate Limited

**Benefits:**
- 🔄 Consistent client handling
- 🔄 Better error messages
- 🔄 Type safety
- 🔄 Automatic metadata
- 🔄 Easier testing

---

**Last Updated:** 2026-09-11  
**Status:** ✅ IMPLEMENTED (library ready, migration in progress)  
**Task:** #17 - Standardize API Response Format
