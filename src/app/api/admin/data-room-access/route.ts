import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { grantDataRoomAccess } from '@/lib/data-room-access'
import { prisma } from '@/lib/prisma'

// POST - Grant data room access to a user (Admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRole = session.user.role as string
  if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { projectId, userId, email } = body

  if (!projectId || !userId || !email) {
    return NextResponse.json({ error: 'projectId, userId, and email required' }, { status: 400 })
  }

  try {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const access = await grantDataRoomAccess(projectId, userId, email, session.user.id)

    return NextResponse.json({
      data: {
        id: access.id,
        projectId: access.projectId,
        userId: access.userId,
        email: access.email,
        ndaSigned: access.ndaSigned,
        accessLevel: access.accessLevel,
        createdAt: access.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[admin] Grant data room access error:', error)
    return NextResponse.json({ error: 'Failed to grant access' }, { status: 500 })
  }
}
