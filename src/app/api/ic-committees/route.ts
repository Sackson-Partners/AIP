import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma, UserRole } from '@prisma/client'
import { z } from 'zod'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

const CreateSchema = z.object({
  name:        z.string().min(1, 'name is required'),
  description: z.string().optional(),
  status:      z.string().optional(),
  meetingDate: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))

  const where: Prisma.IcCommitteeWhereInput = {}

  try {
    const [data, total] = await Promise.all([
      prisma.icCommittee.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.icCommittee.count({ where }),
    ])
    return NextResponse.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error: unknown) {
    logger.error('[GET /api/ic-committees]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { body = {} }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const committee = await prisma.icCommittee.create({
      data: {
        name:        parsed.data.name,
        description: parsed.data.description,
        status:      parsed.data.status ?? 'ACTIVE',
        meetingDate: parsed.data.meetingDate ? new Date(parsed.data.meetingDate) : null,
      },
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'IC_COMMITTEE_CREATED',
      tableName: 'IcCommittee',
      recordId:  committee.id,
      newValues: { name: committee.name },
    })

    return NextResponse.json({ data: committee }, { status: 201 })
  } catch (error: unknown) {
    logger.error('[POST /api/ic-committees]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
