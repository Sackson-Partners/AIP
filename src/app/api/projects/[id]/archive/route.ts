import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { archiveProject, restoreProject } from '@/lib/soft-delete'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/projects/[id]/archive
 * Archive a project (soft delete with cascading)
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return apiUnauthorized()
  }

  const { id } = await params

  // Check if project exists
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      title: true,
      ownerId: true,
      archived: true,
    },
  })

  if (!project) {
    return apiNotFound('Project')
  }

  if (project.archived) {
    return apiError('Project is already archived', {
      code: 'ALREADY_ARCHIVED',
      status: 400,
    })
  }

  // Authorization: Owner or Admin can archive
  const isOwner = project.ownerId === session.user.id
  const isAdmin = ADMIN_ROLES.includes(session.user.role as UserRole)

  if (!isOwner && !isAdmin) {
    return apiForbidden('Only project owner or admins can archive projects')
  }

  // Get reason from request body (optional)
  let reason: string | undefined
  try {
    const body = await req.json()
    reason = body.reason
  } catch {
    // No body or invalid JSON, continue without reason
  }

  // Archive project
  const result = await archiveProject(id, {
    archivedBy: session.user.id,
    reason,
    cascade: true,
    auditLog: true,
  })

  if (!result.success) {
    return apiError(result.error ?? 'Failed to archive project', {
      status: 500,
    })
  }

  return apiSuccess(
    {
      archived: true,
      projectId: id,
      projectCode: project.code,
      cascaded: result.cascadedEntities,
    },
    {
      message: 'Project archived successfully',
    }
  )
}

/**
 * DELETE /api/projects/[id]/archive
 * Restore an archived project (unarchive)
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return apiUnauthorized()
  }

  // Only admins can restore projects
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return apiForbidden('Only admins can restore archived projects')
  }

  const { id } = await params

  // Check if project exists and is archived
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      title: true,
      archived: true,
    },
  })

  if (!project) {
    return apiNotFound('Project')
  }

  if (!project.archived) {
    return apiError('Project is not archived', {
      code: 'NOT_ARCHIVED',
      status: 400,
    })
  }

  // Restore project
  const result = await restoreProject(id, session.user.id, true)

  if (!result.success) {
    return apiError(result.error ?? 'Failed to restore project', {
      status: 500,
    })
  }

  return apiSuccess(
    {
      archived: false,
      projectId: id,
      projectCode: project.code,
      cascaded: result.cascadedEntities,
    },
    {
      message: 'Project restored successfully',
    }
  )
}
