import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { sendVoteRequests } from '@/lib/ic-automation'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

const CreateCommitteeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  projectId: z.string().optional(),
  meetingDate: z.string().datetime().optional(),
  votingDeadline: z.string().datetime().optional(),
  quorumRequired: z.number().int().min(1).optional(),
  memberIds: z.array(z.string()).min(1),
})

/**
 * GET /api/ic-committees
 * List IC committees
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  try {
    const where: any = {}
    if (status) {
      where.status = status
    }

    const committees = await prisma.icCommittee.findMany({
      where,
      include: {
        project: {
          select: { id: true, title: true, code: true },
        },
        votes: {
          select: {
            id: true,
            userId: true,
            vote: true,
            votedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: committees })
  } catch (error) {
    console.error('[GET /api/ic-committees] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/ic-committees
 * Create new IC committee
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateCommitteeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { name, description, projectId, meetingDate, votingDeadline, quorumRequired, memberIds } = parsed.data

  try {
    // Calculate auto-close time (votingDeadline + 1 hour buffer)
    const autoCloseAt = votingDeadline
      ? new Date(new Date(votingDeadline).getTime() + 60 * 60 * 1000)
      : undefined

    // Create committee with votes
    const committee = await prisma.icCommittee.create({
      data: {
        name,
        description,
        projectId,
        meetingDate: meetingDate ? new Date(meetingDate) : undefined,
        votingDeadline: votingDeadline ? new Date(votingDeadline) : undefined,
        autoCloseAt,
        quorumRequired: quorumRequired || 3,
        createdById: session.user.id,
        votes: {
          create: memberIds.map(userId => ({
            userId,
            vote: '', // Empty initially
          })),
        },
      },
      include: {
        votes: {
          include: { user: true },
        },
      },
    })

    // Send vote request emails
    await sendVoteRequests(committee.id).catch(err => {
      console.error('[POST /api/ic-committees] Failed to send vote requests:', err)
    })

    return NextResponse.json({ data: committee }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/ic-committees] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
