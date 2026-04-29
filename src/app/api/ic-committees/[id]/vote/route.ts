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
  const { vote, rationale } = body as { vote?: string; rationale?: string }

  const VALID = ['approve', 'reject', 'abstain', 'defer']
  if (!vote || !VALID.includes(vote)) {
    return NextResponse.json({ error: `vote must be one of: ${VALID.join(', ')}` }, { status: 400 })
  }

  const committee = await prisma.icCommittee.findUnique({
    where:   { id },
    include: { votes: true },
  })
  if (!committee) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (committee.status === 'DECIDED') {
    return NextResponse.json({ error: 'This session has already been decided' }, { status: 409 })
  }

  // Upsert — one vote per user per committee
  const icVote = await prisma.icVote.upsert({
    where:  { committeeId_userId: { committeeId: id, userId: session.user.id } },
    update: { vote, rationale: rationale ?? null },
    create: { committeeId: id, userId: session.user.id, vote, rationale: rationale ?? null },
  })

  // Check if quorum is now met and auto-update status
  const allVotes = await prisma.icVote.findMany({ where: { committeeId: id } })
  const voteCounts = allVotes.reduce<Record<string, number>>((acc, v) => {
    acc[v.vote] = (acc[v.vote] ?? 0) + 1
    return acc
  }, {})

  const quorumMet = allVotes.length >= committee.quorumRequired
  if (quorumMet && committee.status === 'SCHEDULED') {
    await prisma.icCommittee.update({ where: { id }, data: { status: 'IN_PROGRESS' } })
  }

  const updatedCommittee = await prisma.icCommittee.findUnique({
    where:   { id },
    include: { votes: { include: { user: { select: { id: true, name: true, email: true } } } } },
  })

  return NextResponse.json({
    data: {
      vote:          icVote,
      project_id:    updatedCommittee?.projectId,
      status:        updatedCommittee?.status,
      quorum_required: updatedCommittee?.quorumRequired,
      quorum_met:    quorumMet,
      vote_summary:  voteCounts,
      votes:         updatedCommittee?.votes.map(v => ({
        voter_id:  v.userId,
        vote:      v.vote,
        rationale: v.rationale,
      })),
    },
  })
}
