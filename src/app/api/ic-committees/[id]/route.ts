import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const committee = await prisma.icCommittee.findUnique({
    where:   { id },
    include: {
      project: { select: { id: true, title: true, sector: true, country: true } },
      votes:   { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })
  if (!committee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const voteCounts = committee.votes.reduce<Record<string, number>>((acc, v) => {
    acc[v.vote] = (acc[v.vote] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    data: {
      committee_id:    committee.id,
      project_id:      committee.projectId,
      project_name:    committee.project?.title ?? committee.name,
      status:          committee.status,
      outcome:         committee.outcome ?? null,
      outcome_notes:   committee.outcomeNotes ?? null,
      quorum_required: committee.quorumRequired,
      quorum_met:      committee.votes.length >= committee.quorumRequired,
      vote_summary:    voteCounts,
      votes:           committee.votes.map(v => ({
        voter_id:   v.userId,
        voter_name: v.user.name,
        vote:       v.vote,
        rationale:  v.rationale ?? null,
      })),
      scheduled_date:  committee.meetingDate?.toISOString() ?? null,
      created_at:      committee.createdAt.toISOString(),
    },
  })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const committee = await prisma.icCommittee.update({
    where: { id },
    data: {
      ...(body.name        !== undefined ? { name: body.name }                                    : {}),
      ...(body.description !== undefined ? { description: body.description }                      : {}),
      ...(body.status      !== undefined ? { status: body.status }                                : {}),
      ...(body.meetingDate !== undefined ? { meetingDate: body.meetingDate ? new Date(body.meetingDate) : null } : {}),
      ...(body.scheduled_date !== undefined ? { meetingDate: body.scheduled_date ? new Date(body.scheduled_date) : null } : {}),
      ...(body.quorum_required !== undefined ? { quorumRequired: Number(body.quorum_required) } : {}),
      ...(body.project_id !== undefined ? { projectId: body.project_id } : {}),
    },
  }).catch(() => null)

  if (!committee) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: committee })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.icCommittee.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
