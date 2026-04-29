import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const events = await prisma.event.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { eventDate: 'asc' },
    include: { project: { select: { id: true, title: true } } },
  })

  const data = events.map(e => ({
    id: e.id,
    name: e.name,
    description: e.description,
    event_date: e.eventDate.toISOString(),
    location: e.location,
    type: e.type,
    project_id: e.projectId,
    project_name: e.project?.title ?? null,
    created_at: e.createdAt.toISOString(),
  }))

  return NextResponse.json({ data, pagination: { page: 1, limit: 100, total: data.length, pages: 1 } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.name)       return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!body.event_date) return NextResponse.json({ error: 'event_date required' }, { status: 400 })

  // Handle projects_involved — take first project or project_id
  const projectId = body.project_id
    ? String(body.project_id)
    : (Array.isArray(body.projects_involved) && body.projects_involved[0])
      ? String(body.projects_involved[0])
      : null

  const event = await prisma.event.create({
    data: {
      name:        body.name,
      description: body.description ?? null,
      eventDate:   new Date(body.event_date),
      location:    body.location ?? null,
      type:        body.type ?? 'general',
      projectId:   projectId ?? null,
      createdBy:   session.user.id,
    },
    include: { project: { select: { id: true, title: true } } },
  })

  return NextResponse.json({
    data: {
      id:           event.id,
      name:         event.name,
      description:  event.description,
      event_date:   event.eventDate.toISOString(),
      location:     event.location,
      type:         event.type,
      project_id:   event.projectId,
      project_name: event.project?.title ?? null,
      created_at:   event.createdAt.toISOString(),
    },
  }, { status: 201 })
}
