import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth/auth.config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rooms = await prisma.dealRoom.findMany({
    orderBy: { createdAt: 'desc' },
    include: { project: { select: { id: true, title: true, sector: true, country: true } } },
  })

  const data = rooms.map(r => ({
    id:          r.id,
    project_id:  r.projectId,
    project_name: r.project?.title ?? null,
    name:        r.name,
    description: r.description,
    is_public:   r.isPublic,
    created_at:  r.createdAt.toISOString(),
  }))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  // Accept both snake_case (frontend) and camelCase
  const projectId   = String(body.project_id ?? body.projectId ?? '')
  const name        = body.name as string | undefined
  const description = body.description as string | undefined
  const isPublic    = body.is_public ?? body.isPublic ?? false
  const password    = body.password as string | undefined

  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  if (!name)      return NextResponse.json({ error: 'name required' },       { status: 400 })

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const hashedPassword = password ? await bcrypt.hash(password, 12) : null

  const room = await prisma.dealRoom.create({
    data: {
      projectId,
      name,
      description: description ?? null,
      isPublic:    Boolean(isPublic),
      password:    hashedPassword,
    },
  })

  return NextResponse.json({
    data: {
      id:          room.id,
      project_id:  room.projectId,
      project_name: project.title,
      name:        room.name,
      description: room.description,
      is_public:   room.isPublic,
      created_at:  room.createdAt.toISOString(),
    },
  }, { status: 201 })
}
