import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const outcome = (body.outcome ?? body.decision ?? '') as string
  const notes   = body.notes as string | undefined

  const VALID = ['approved', 'rejected', 'deferred']
  if (!VALID.includes(outcome)) {
    return NextResponse.json({ error: `outcome must be one of: ${VALID.join(', ')}` }, { status: 400 })
  }

  const committee = await prisma.icCommittee.findUnique({ where: { id } })
  if (!committee) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.icCommittee.update({
    where: { id },
    data:  { outcome, outcomeNotes: notes ?? null, status: 'DECIDED' },
    include: {
      votes: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  // Optionally sync project status
  if (committee.projectId) {
    const statusMap: Record<string, string> = {
      approved: 'APPROVED',
      rejected: 'REJECTED',
      deferred: 'UNDER_REVIEW',
    }
    await prisma.project.update({
      where: { id: committee.projectId },
      data:  { status: statusMap[outcome] as never },
    }).catch(() => null) // non-fatal
  }

  const voteCounts = updated.votes.reduce<Record<string, number>>((acc, v) => {
    acc[v.vote] = (acc[v.vote] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    data: {
      committee_id:    updated.id,
      project_id:      updated.projectId,
      status:          updated.status,
      outcome:         updated.outcome,
      outcome_notes:   updated.outcomeNotes,
      quorum_required: updated.quorumRequired,
      quorum_met:      updated.votes.length >= updated.quorumRequired,
      vote_summary:    voteCounts,
      votes:           updated.votes.map(v => ({ voter_id: v.userId, vote: v.vote, rationale: v.rationale })),
    },
  })
}
