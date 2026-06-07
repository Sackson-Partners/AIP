import { prisma } from '@/lib/prisma'
import { UserRole, ProjectStatus } from '@prisma/client'

// Internal staff can see all project data
const INTERNAL_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

// Published project statuses visible to external partners
const PUBLISHED_STATUSES: ProjectStatus[] = [
  ProjectStatus.ACTIVE,
  ProjectStatus.FUNDED,
  ProjectStatus.CLOSED,
]

/**
 * Check if user is internal staff
 */
export function isInternalUser(userRole: string): boolean {
  return INTERNAL_ROLES.includes(userRole as UserRole)
}

/**
 * Check if project is published (visible to external partners)
 */
export function isProjectPublished(projectStatus: string): boolean {
  return PUBLISHED_STATUSES.includes(projectStatus as ProjectStatus)
}

/**
 * Check if user can access a specific project's data
 * - Internal staff: can access all projects
 * - External partners: can only access published projects
 */
export async function canAccessProject(
  userId: string,
  userRole: string,
  projectId: string
): Promise<{ allowed: boolean; reason?: string; projectStatus?: string }> {
  // Internal staff bypass
  if (isInternalUser(userRole)) {
    return { allowed: true, reason: 'Internal staff access' }
  }

  // Check project status
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  })

  if (!project) {
    return { allowed: false, reason: 'Project not found' }
  }

  if (!isProjectPublished(project.status)) {
    return {
      allowed: false,
      reason: 'Project not published',
      projectStatus: project.status,
    }
  }

  return { allowed: true, projectStatus: project.status }
}

/**
 * Get WHERE clause for filtering projects by visibility
 */
export function getProjectVisibilityFilter(userRole: string) {
  if (isInternalUser(userRole)) {
    // Internal staff see all projects
    return {}
  }

  // External partners only see published projects
  return {
    status: { in: PUBLISHED_STATUSES },
  }
}

/**
 * Filter array of items to only include those with published projects
 * Useful for: Verifications, Data Rooms, EIN Reports, Events, etc.
 */
export async function filterByProjectVisibility<T extends { projectId?: string | null }>(
  items: T[],
  userRole: string
): Promise<T[]> {
  if (isInternalUser(userRole)) {
    return items // Internal staff see all
  }

  // Get unique project IDs
  const projectIds = [...new Set(items.map(item => item.projectId).filter(Boolean))] as string[]

  if (projectIds.length === 0) {
    return items
  }

  // Get published project IDs
  const publishedProjects = await prisma.project.findMany({
    where: {
      id: { in: projectIds },
      status: { in: PUBLISHED_STATUSES },
    },
    select: { id: true },
  })

  const publishedIds = new Set(publishedProjects.map(p => p.id))

  // Filter items to only include those with published projects
  return items.filter(item => !item.projectId || publishedIds.has(item.projectId))
}

/**
 * Log access denied for auditing
 */
export function logAccessDenied(
  userEmail: string,
  userRole: string,
  resource: string,
  projectId: string,
  projectStatus: string
) {
  console.log(
    `[Access Denied] User: ${userEmail} (${userRole}) attempted to access ${resource} ` +
    `for project ${projectId} (status: ${projectStatus})`
  )
}
