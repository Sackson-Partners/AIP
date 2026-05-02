import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth/auth.config'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const room = await prisma.dealRoom.findUnique({ where: { id } })

  if (!room) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id:                room.id,
    project_id:        room.projectId,
    name:              room.name,
    description:       room.description,
    status:            room.status,
    deal_value:        room.dealValue,
    deal_currency:     room.dealCurrency,
    target_close_date: room.targetCloseDate?.toISOString() ?? null,
    is_video_enabled:  room.isVideoEnabled,
    is_chat_enabled:   room.isChatEnabled,
    require_nda:       room.requireNda,
    is_public:         room.isPublic,
    created_at:        room.createdAt.toISOString(),
    updated_at:        room.updatedAt.toISOString(),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Access check — validate password for protected deal rooms
  const { id } = await params
  const room = await prisma.dealRoom.findUnique({ where: { id } })

  if (!room) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!room.isPublic) {
    const body = await req.json()
    const valid = await bcrypt.compare(body.password ?? '', room.password ?? '')
    if (!valid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 403 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...safeRoom } = room
  return NextResponse.json({ access: true, room: safeRoom })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const room = await prisma.dealRoom.findUnique({ where: { id } })

  if (!room) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.dealRoom.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
