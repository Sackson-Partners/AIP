# Project Visibility Control System

## Overview

All project-related data (Data Rooms, Verifications, PIS, EIN, Events, Analytics) is now controlled by project visibility status. External partners only see data from PUBLISHED projects, while internal staff see everything.

## Visibility Rules

### Project Statuses

| Status | Internal Staff | External Partners | Description |
|--------|----------------|-------------------|-------------|
| **DRAFT** | ✅ Visible | 🔒 Hidden | Work in progress |
| **SUBMITTED** | ✅ Visible | 🔒 Hidden | Submitted for review |
| **UNDER_REVIEW** | ✅ Visible | 🔒 Hidden | Being reviewed |
| **APPROVED** | ✅ Visible | 🔒 Hidden | Approved but not published |
| **ACTIVE** | ✅ Visible | ✅ Visible | **PUBLISHED** - Live project |
| **FUNDED** | ✅ Visible | ✅ Visible | **PUBLISHED** - Secured funding |
| **CLOSED** | ✅ Visible | ✅ Visible | **PUBLISHED** - Completed |
| **REJECTED** | ✅ Visible | 🔒 Hidden | Rejected project |

### User Roles

**Internal Staff (See ALL projects):**
- SUPER_ADMIN
- ADMIN
- ANALYST

**External Partners (See PUBLISHED only):**
- GOVERNMENT
- SPONSOR_DEVELOPER
- EPC_OPERATOR
- INSTITUTIONAL_INVESTOR

## Features Protected

### 1. Data Rooms
```
GET /api/data-rooms/[projectId]
```
- **Internal**: Access all project data rooms
- **External**: Only published projects
- **Error**: 403 `PROJECT_NOT_PUBLISHED` if draft

### 2. Verifications
```
GET /api/verifications
```
- Returns verifications only for visible projects
- Filtered server-side before sending to client

### 3. PIS Reports
```
GET /api/pis
```
- Returns PIS reports only for visible projects
- External partners can't see draft project PIS

### 4. EIN Reports
```
GET /api/ein
```
- Returns EIN reports only for visible projects
- External partners can't see draft project EIN

### 5. Events
```
GET /api/events
```
- Returns events only for visible projects
- Project-specific events hidden if draft

### 6. Analytics
```
GET /api/analytics
```
- Calculates stats only for visible projects
- External partners see metrics for published projects only
- Prevents data leakage about draft projects

### 7. Project Discovery Map
```
Dashboard Map Component
```
- Shows projects on map by country/region
- Automatically filtered by visibility rules
- Uses Mapbox for visualization
- External partners only see published project pins

## Implementation

### Core Library: `src/lib/project-visibility.ts`

```typescript
// Check if user is internal staff
isInternalUser(userRole: string): boolean

// Check if project is published
isProjectPublished(projectStatus: string): boolean

// Check access to specific project
canAccessProject(userId, userRole, projectId): Promise<{
  allowed: boolean
  reason?: string
  projectStatus?: string
}>

// Get WHERE clause for Prisma queries
getProjectVisibilityFilter(userRole: string): Prisma.ProjectWhereInput

// Filter array of items by project visibility
filterByProjectVisibility<T>(items: T[], userRole: string): Promise<T[]>

// Log access denial for auditing
logAccessDenied(userEmail, userRole, resource, projectId, projectStatus)
```

### Usage Examples

**Filter list endpoint:**
```typescript
// GET /api/verifications
const verifications = await prisma.verification.findMany({
  include: { project: { select: { status: true } } }
})

const filtered = await filterByProjectVisibility(verifications, userRole)
return NextResponse.json({ data: filtered })
```

**Check single project access:**
```typescript
// GET /api/data-rooms/[projectId]
const access = await canAccessProject(userId, userRole, projectId)

if (!access.allowed) {
  return NextResponse.json({
    error: 'PROJECT_NOT_PUBLISHED',
    projectStatus: access.projectStatus
  }, { status: 403 })
}
```

**Filter analytics:**
```typescript
// GET /api/analytics
const projectFilter = getProjectVisibilityFilter(userRole)

const totalProjects = await prisma.project.count({ where: projectFilter })
const projectsByStatus = await prisma.project.groupBy({
  by: ['status'],
  _count: true,
  where: projectFilter
})
```

## Publishing Workflow

### How to Publish a Project

**As Internal Staff (ADMIN/ANALYST):**

1. Navigate to `/dashboard/projects`
2. Click **Edit** on the project
3. Find **Visibility Status** dropdown
4. Change from `Draft` to one of:
   - `Active (Published)` - for live projects
   - `Funded (Published)` - for funded projects
   - `Closed (Published)` - for completed projects
5. Click **Save Changes**
6. ✅ Project now visible to external partners

### Publishing Impact

When you publish a project (change to ACTIVE/FUNDED/CLOSED):
- ✅ Project appears in partner project lists
- ✅ Data Room becomes accessible
- ✅ Verifications become visible
- ✅ PIS/EIN reports become visible
- ✅ Events appear in calendar
- ✅ Project appears on discovery map
- ✅ Included in analytics metrics

## Security Features

### 1. Server-Side Filtering
All filtering happens on the server before data is sent to clients. External partners never receive draft project data.

### 2. No Data Leakage
- Draft projects: completely invisible to external partners
- Returns 403 or filtered out (no 404 to avoid confirming existence)
- External partners can't guess project IDs

### 3. Audit Logging
Every access denial is logged:
```
[Access Denied] User: partner@example.com (INSTITUTIONAL_INVESTOR)
attempted to access data-room for project abc123 (status: DRAFT)
```

### 4. Consistent Across Features
Same visibility rules apply to:
- Projects list
- Data Rooms
- Deal Rooms (separate NDA check)
- Verifications
- PIS/EIN Reports
- Events
- Analytics
- Discovery Map

## API Error Responses

### PROJECT_NOT_PUBLISHED
```json
{
  "error": "PROJECT_NOT_PUBLISHED",
  "message": "This data room is only available for published projects",
  "projectStatus": "DRAFT"
}
```

Returned when external partner tries to access draft project data.

### NDA_REQUIRED (Deal Rooms only)
```json
{
  "error": "NDA_REQUIRED",
  "message": "You must sign an NDA to access this deal room",
  "requiresNDA": true,
  "memberId": "clx123..."
}
```

Returned when user hasn't signed NDA for deal room access.

## Project Discovery Map

### Features
- **Visual Discovery**: Interactive map showing all visible projects
- **Location-Based**: Projects plotted by country/region
- **Filtered Automatically**: Respects visibility rules
- **Mapbox Integration**: Professional map tiles
- **Click to View**: Click project pin for details

### Implementation
Located at: `src/components/dashboard/MapPanel.tsx`

**Country Coordinates:**
- 85+ countries pre-configured
- Africa-focused with global coverage
- Uses `[longitude, latitude]` format for Mapbox

**Data Flow:**
1. Dashboard fetches projects (already filtered by visibility)
2. MapPanel receives filtered project list
3. Plots projects using country coordinates
4. External partners only see published project pins

## Testing

### Test as Internal Staff (ADMIN)
```
1. Sign in as ADMIN
2. Create project with status: DRAFT
3. Navigate to:
   - Data Rooms → Should see draft project
   - Verifications → Can create for draft project
   - Analytics → Draft project counted in metrics
   - Map → Draft project visible on map
```

### Test as External Partner (INVESTOR)
```
1. Sign in as INSTITUTIONAL_INVESTOR
2. Check same draft project:
   - Projects list → Draft project NOT visible
   - Data Rooms → 403 PROJECT_NOT_PUBLISHED
   - Verifications → Draft project verifications hidden
   - Analytics → Draft project NOT counted
   - Map → Draft project NOT on map
3. Admin publishes project (ACTIVE)
4. Refresh all pages:
   - Now visible everywhere ✅
```

### Edge Cases
- [x] External partner can't access draft via direct URL
- [x] Analytics don't leak draft project counts
- [x] Map doesn't show draft project locations
- [x] Events for draft projects hidden
- [x] Verifications for draft projects filtered out

## Future Enhancements

### Phase 2
- Scheduled publishing (publishedAt date)
- Bulk publish/unpublish actions
- Publishing workflow (request → approve → publish)
- Email notifications on publish

### Phase 3
- Per-document visibility within data rooms
- Project visibility tiers (partners vs public)
- Embargo periods (published but delayed visibility)
- Geographic restrictions (visible only in certain regions)

---

**Implementation Date:** June 8, 2026  
**Status:** ✅ Complete - Deployed to Production  
**Coverage:** Data Rooms, Verifications, PIS, EIN, Events, Analytics, Discovery Map
