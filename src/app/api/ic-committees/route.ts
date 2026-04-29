import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))

  const [committees, total] = await Promise.all([
    prisma.icCommittee.findMany({
      skip:    (page - 1) * limit,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, title: true } }, votes: true },
    }),
    prisma.icCommittee.count(),
  ])

  const data = committees.map(c => ({
    committee_id:   c.id,
    project_id:     c.projectId ?? null,
    project_name:   c.project?.title ?? c.name,
    scheduled_date: c.meetingDate?.toISOString() ?? null,
    status:         c.status,
    outcome:        c.outcome ?? null,
    vote_count:     c.votes.length,
    quorum:         c.quorumRequired,
  }))

  return NextResponse.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const projectId      = body.project_id ? String(body.project_id) : undefined
  const scheduledDate  = body.scheduled_date ?? body.meetingDate ?? null
  const quorumRequired = Number(body.quorum_required ?? body.quorumRequired ?? 3)

  let name = body.name as string | undefined
  if (!name && projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { title: true } })
    name = `IC Session — ${project?.title ?? 'Project'} (${scheduledDate ? new Date(scheduledDate).toLocaleDateString() : 'TBD'})`
  }
  if (!name) name = `IC Session — ${new Date().toLocaleDateString()}`

  const committee = await prisma.icCommittee.create({
    data: {
      name,
      description:    body.description ?? null,
      status:         'SCHEDULED',
      meetingDate:    scheduledDate ? new Date(scheduledDate) : null,
      projectId:      projectId ?? null,
      quorumRequired,
    },
  })

  return NextResponse.json({
    data: {
      committee_id:   committee.id,
      project_id:     committee.projectId,
      project_name:   name,
      scheduled_date: committee.meetingDate?.toISOString() ?? null,
      status:         committee.status,
      vote_count:     0,
      quorum:         committee.quorumRequired,
    },
  }, { status: 201 })
}
