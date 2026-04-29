import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const event = await prisma.event.findUnique({ where: { id }, include: { project: { select: { title: true } } } })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: event })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  if (body.name)        updates.name        = body.name
  if (body.description) updates.description = body.description
  if (body.event_date)  updates.eventDate   = new Date(body.event_date)
  if (body.location)    updates.location    = body.location
  if (body.type)        updates.type        = body.type
  const event = await prisma.event.update({ where: { id }, data: updates }).catch(() => null)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: event })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await prisma.event.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
