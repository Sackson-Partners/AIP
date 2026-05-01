import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify membership
  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: id, userId: session.user.id } },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })

  const url = new URL(req.url)
  const before = url.searchParams.get('before')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100)

  const messages = await prisma.message.findMany({
    where: {
      channelId: id,
      deletedAt:  null,
      threadId:   null,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })

  // Update lastReadAt
  await prisma.channelMember.update({
    where: { channelId_userId: { channelId: id, userId: session.user.id } },
    data:  { lastReadAt: new Date() },
  })

  return NextResponse.json({ data: messages.reverse() })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: id, userId: session.user.id } },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const message = await prisma.message.create({
    data: {
      channelId:      id,
      senderId:       session.user.id,
      content:        body.content.trim(),
      threadId:       body.threadId ?? null,
      attachmentUrl:  body.attachmentUrl  ?? null,
      attachmentName: body.attachmentName ?? null,
    },
  })

  return NextResponse.json({ data: message }, { status: 201 })
}
