import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { UserRole } from '@prisma/client'

type Ctx = { params: Promise<{ id: string }> }

const ADMIN_ROLES = new Set<string>([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST])

/**
 * GET /api/deal-rooms/[id]/eoi
 * List EOIs for a deal room (admin only).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_ROLES.has(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const eois = await prisma.expressionOfInterest.findMany({
      where:   { dealRoomId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: eois })
  } catch (err) {
    logger.error('[GET /api/deal-rooms/[id]/eoi]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/deal-rooms/[id]/eoi
 * Submit an expression of interest (any authenticated user).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: { name?: string; email?: string; organization?: string; message?: string }
  try { body = await req.json() } catch { body = {} }

  const name  = (body.name  ?? session.user.name  ?? '').trim()
  const email = (body.email ?? session.user.email ?? '').trim()

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 422 })
  }

  try {
    const room = await prisma.dealRoom.findUnique({ where: { id } })
    if (!room) return NextResponse.json({ error: 'Deal room not found' }, { status: 404 })

    const eoi = await prisma.expressionOfInterest.create({
      data: {
        dealRoomId:   id,
        userId:       session.user.id,
        name,
        email,
        organization: body.organization ?? null,
        message:      body.message      ?? null,
      },
    })

    // Increment eoiCount
    await prisma.dealRoom.update({
      where: { id },
      data:  { eoiCount: { increment: 1 } },
    })

    return NextResponse.json({ data: eoi }, { status: 201 })
  } catch (err) {
    logger.error('[POST /api/deal-rooms/[id]/eoi]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/deal-rooms/[id]/eoi?eoiId=xxx
 * Update EOI status (admin only): REVIEWED | ACCEPTED | DECLINED
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_ROLES.has(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const eoiId  = req.nextUrl.searchParams.get('eoiId')
  if (!eoiId) return NextResponse.json({ error: 'eoiId query param required' }, { status: 422 })

  let body: { status?: string }
  try { body = await req.json() } catch { body = {} }

  const VALID = ['PENDING', 'REVIEWED', 'ACCEPTED', 'DECLINED']
  if (!body.status || !VALID.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${VALID.join(', ')}` }, { status: 422 })
  }

  try {
    const eoi = await prisma.expressionOfInterest.update({
      where: { id: eoiId, dealRoomId: id },
      data:  { status: body.status, reviewedBy: session.user.id, reviewedAt: new Date() },
    })
    return NextResponse.json({ data: eoi })
  } catch (err) {
    logger.error('[PATCH /api/deal-rooms/[id]/eoi]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
