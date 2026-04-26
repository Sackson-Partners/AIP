import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { Prisma, UserRole } from '@prisma/client'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data:  { read: true, readAt: new Date() },
    })
    return NextResponse.json({ data: updated })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    logger.error('[PATCH /api/notifications/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const isOwner = notification.userId === session.user.id
    const isAdmin = ADMIN_ROLES.includes(session.user.role as UserRole)
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.notification.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    logger.error('[DELETE /api/notifications/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
