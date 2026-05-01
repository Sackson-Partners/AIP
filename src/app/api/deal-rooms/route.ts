import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth/auth.config'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')   ?? undefined
  const dealType = searchParams.get('dealType') ?? undefined
  const search   = searchParams.get('search')   ?? ''

  const rooms = await prisma.dealRoom.findMany({
    where: {
      ...(status   ? { status }             : {}),
      ...(dealType ? { dealType }           : {}),
      ...(search   ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      project: { select: { id: true, title: true, sector: true, country: true } },
      _count:  { select: { eois: true } },
    },
  })

  // Which of these has the user saved?
  const savedIds = new Set(
    (await prisma.savedDeal.findMany({
      where:  { userId: session.user.id, dealRoomId: { in: rooms.map(r => r.id) } },
      select: { dealRoomId: true },
    })).map(s => s.dealRoomId)
  )

  const data = rooms.map(r => ({
    id:               r.id,
    project_id:       r.projectId,
    project_name:     r.project?.title ?? null,
    project_sector:   r.project?.sector ?? null,
    project_country:  r.project?.country ?? null,
    name:             r.name,
    description:      r.description,
    status:           r.status,
    deal_value:       r.dealValue,
    deal_currency:    r.dealCurrency,
    target_close_date: r.targetCloseDate?.toISOString() ?? null,
    is_public:        r.isPublic,
    require_nda:      r.requireNda,
    is_video_enabled: r.isVideoEnabled,
    is_chat_enabled:  r.isChatEnabled,
    // Marketplace fields
    deal_type:        r.dealType,
    target_raise:     r.targetRaise,
    min_ticket:       r.minTicket,
    eoi_deadline:     r.eoiDeadline?.toISOString() ?? null,
    featured_until:   r.featuredUntil?.toISOString() ?? null,
    view_count:       r.viewCount,
    eoi_count:        r._count.eois,
    is_saved:         savedIds.has(r.id),
    created_at:       r.createdAt.toISOString(),
  }))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const projectId       = String(body.project_id   ?? body.projectId   ?? '')
  const name            = body.name            as string | undefined
  const description     = body.description     as string | undefined
  const status          = (body.status         as string | undefined) ?? 'ACTIVE'
  const dealValue       = body.deal_value       != null ? Number(body.deal_value)   : null
  const dealCurrency    = (body.deal_currency   as string | undefined) ?? 'USD'
  const targetCloseDate = body.target_close_date ? new Date(body.target_close_date) : null
  const isPublic        = body.is_public        ?? body.isPublic        ?? false
  const requireNda      = body.require_nda       ?? body.requireNda      ?? true
  const isVideoEnabled  = body.is_video_enabled  ?? body.isVideoEnabled  ?? true
  const isChatEnabled   = body.is_chat_enabled   ?? body.isChatEnabled   ?? true
  const password        = body.password          as string | undefined
  // Marketplace
  const dealType        = (body.deal_type        as string | undefined)  ?? null
  const targetRaise     = body.target_raise != null ? Number(body.target_raise) : null
  const minTicketMkt    = body.min_ticket   != null ? Number(body.min_ticket)   : null
  const eoiDeadline     = body.eoi_deadline   ? new Date(body.eoi_deadline)   : null

  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  if (!name)      return NextResponse.json({ error: 'name required' },       { status: 400 })

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const hashedPassword = password ? await bcrypt.hash(password, 12) : null

  const room = await prisma.dealRoom.create({
    data: {
      projectId,
      name,
      description:     description   ?? null,
      status,
      dealValue,
      dealCurrency,
      targetCloseDate,
      isPublic:        Boolean(isPublic),
      requireNda:      Boolean(requireNda),
      isVideoEnabled:  Boolean(isVideoEnabled),
      isChatEnabled:   Boolean(isChatEnabled),
      password:        hashedPassword,
      dealType,
      targetRaise,
      minTicket:       minTicketMkt,
      eoiDeadline,
    },
  })

  return NextResponse.json({
    data: {
      id:               room.id,
      project_id:       room.projectId,
      project_name:     project.title,
      name:             room.name,
      description:      room.description,
      status:           room.status,
      deal_value:       room.dealValue,
      deal_currency:    room.dealCurrency,
      target_close_date: room.targetCloseDate?.toISOString() ?? null,
      is_public:        room.isPublic,
      require_nda:      room.requireNda,
      is_video_enabled: room.isVideoEnabled,
      is_chat_enabled:  room.isChatEnabled,
      deal_type:        room.dealType,
      target_raise:     room.targetRaise,
      min_ticket:       room.minTicket,
      eoi_deadline:     room.eoiDeadline?.toISOString() ?? null,
      eoi_count:        0,
      is_saved:         false,
      created_at:       room.createdAt.toISOString(),
    },
  }, { status: 201 })
}
