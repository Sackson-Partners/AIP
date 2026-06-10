import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UserRole, ProjectStatus } from '@prisma/client'
import { deleteCached } from '@/lib/redis'

const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

const BulkSchema = z.object({
  action: z.enum(['ARCHIVE', 'RESTORE', 'DELETE', 'UPDATE_STATUS', 'ASSIGN_OWNER']),
  projectIds: z.array(z.string()).min(1, 'At least one project ID required'),
  status: z.nativeEnum(ProjectStatus).optional(),
  ownerId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!WRITE_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { action, projectIds, status, ownerId } = parsed.data

  try {
    let result

    switch (action) {
      case 'ARCHIVE':
        result = await prisma.project.updateMany({
          where: { id: { in: projectIds } },
          data: {
            archived: true,
            archivedAt: new Date(),
            archivedBy: session.user.id,
          },
        })
        break

      case 'RESTORE':
        result = await prisma.project.updateMany({
          where: { id: { in: projectIds } },
          data: {
            archived: false,
            archivedAt: null,
            archivedBy: null,
          },
        })
        break

      case 'DELETE':
        // Soft delete via archive
        result = await prisma.project.updateMany({
          where: { id: { in: projectIds } },
          data: {
            archived: true,
            archivedAt: new Date(),
            archivedBy: session.user.id,
          },
        })
        break

      case 'UPDATE_STATUS':
        if (!status) {
          return NextResponse.json(
            { error: 'Status is required for UPDATE_STATUS action' },
            { status: 422 }
          )
        }
        result = await prisma.project.updateMany({
          where: { id: { in: projectIds } },
          data: { status },
        })
        break

      case 'ASSIGN_OWNER':
        if (!ownerId) {
          return NextResponse.json(
            { error: 'ownerId is required for ASSIGN_OWNER action' },
            { status: 422 }
          )
        }
        result = await prisma.project.updateMany({
          where: { id: { in: projectIds } },
          data: { ownerId },
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Invalidate all project caches
    await deleteCached('projects:*')
    console.log('[POST /api/projects/bulk] Cache invalidated after bulk operation')

    return NextResponse.json({
      success: true,
      count: result.count,
      action,
    })
  } catch (error) {
    console.error('[POST /api/projects/bulk] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
