import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/deal-rooms/[id]/save  — save a deal
 * DELETE /api/deal-rooms/[id]/save — unsave
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await prisma.savedDeal.upsert({
      where:  { userId_dealRoomId: { userId: session.user.id, dealRoomId: id } },
      create: { userId: session.user.id, dealRoomId: id },
      update: {},
    })
    return NextResponse.json({ saved: true }, { status: 201 })
  } catch (err) {
    logger.error('[POST /api/deal-rooms/[id]/save]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await prisma.savedDeal.deleteMany({
      where: { userId: session.user.id, dealRoomId: id },
    })
    return NextResponse.json({ saved: false })
  } catch (err) {
    logger.error('[DELETE /api/deal-rooms/[id]/save]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
