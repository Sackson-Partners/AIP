import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { UserRole, NotificationType } from '@prisma/client'
import { z } from 'zod'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

const CreateSchema = z.object({
  userId:  z.string().min(1, 'userId is required'),
  title:   z.string().min(1, 'title is required'),
  message: z.string().min(1, 'message is required'),
  type:    z.string().optional(),
  link:    z.string().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where:   { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take:    20,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ])
    return NextResponse.json({ notifications, unreadCount })
  } catch (error: unknown) {
    logger.error('[GET /api/notifications]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { body = {} }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const validTypes = Object.values(NotificationType)
  const type = parsed.data.type && validTypes.includes(parsed.data.type as NotificationType)
    ? parsed.data.type as NotificationType
    : NotificationType.SYSTEM_ALERT

  try {
    const notification = await prisma.notification.create({
      data: {
        userId:  parsed.data.userId,
        title:   parsed.data.title,
        message: parsed.data.message,
        type,
        link:    parsed.data.link,
      },
    })
    return NextResponse.json({ data: notification }, { status: 201 })
  } catch (error: unknown) {
    logger.error('[POST /api/notifications]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data:  { read: true, readAt: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logger.error('[PATCH /api/notifications]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
