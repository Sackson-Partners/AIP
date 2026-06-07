# Project Visibility Rules

## Role-Based Access Control

### Internal Staff (Can see ALL projects)
- **SUPER_ADMIN** - Full access to all projects
- **ADMIN** - Full access to all projects  
- **ANALYST** - Full access to all projects

### External Partners (Can only see PUBLISHED projects)
- **GOVERNMENT** - Only published projects
- **SPONSOR_DEVELOPER** - Only published projects
- **EPC_OPERATOR** - Only published projects
- **INSTITUTIONAL_INVESTOR** - Only published projects

## Project Statuses

### Published Statuses (Visible to ALL users)
- **ACTIVE** - Project is live and operational
- **FUNDED** - Project has secured funding
- **CLOSED** - Project completed

### Non-Published Statuses (Internal staff ONLY)
- **DRAFT** - Work in progress, not ready
- **SUBMITTED** - Submitted for review
- **UNDER_REVIEW** - Being reviewed by team
- **APPROVED** - Approved but not yet active
- **REJECTED** - Rejected project

## API Endpoints Affected

1. **GET /api/projects** - List projects
   - Internal: Returns all projects
   - External: Returns only ACTIVE, FUNDED, CLOSED

2. **GET /api/projects/[id]** - Single project
   - Internal: Can view any project
   - External: Returns 404 for non-published projects

## Implementation

Files modified:
- `/src/app/api/projects/route.ts` - Added role check and status filtering
- `/src/app/api/projects/[id]/route.ts` - Added visibility check for single projects

## Testing

**As Internal Staff (ADMIN):**
- Navigate to /dashboard/projects
- Should see all projects including DRAFT, SUBMITTED, etc.

**As External Partner (INSTITUTIONAL_INVESTOR):**
- Navigate to /dashboard/projects
- Should only see ACTIVE, FUNDED, CLOSED projects
- Attempting to access draft project by URL should return 404

## Future Enhancements

Consider adding:
- Project visibility toggle in admin UI
- Bulk publish/unpublish actions
- Scheduled publishing (publishedAt field)
- Project preview for partners before publishing
