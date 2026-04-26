import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma, UserRole } from '@prisma/client'
import { z } from 'zod'

const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

const CreateSchema = z.object({
  name:   z.string().min(1, 'name is required'),
  email:  z.string().email().optional().or(z.literal('')),
  phone:  z.string().optional(),
  type:   z.string().optional(),
  status: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const search = searchParams.get('search') ?? ''

  const where: Prisma.InvestorWhereInput = search ? {
    OR: [
      { name:  { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ],
  } : {}

  try {
    const [data, total] = await Promise.all([
      prisma.investor.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.investor.count({ where }),
    ])
    return NextResponse.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error: unknown) {
    logger.error('[GET /api/investors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!WRITE_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { body = {} }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const investor = await prisma.investor.create({
      data: {
        name:   parsed.data.name,
        email:  parsed.data.email || null,
        phone:  parsed.data.phone,
        type:   parsed.data.type,
        status: parsed.data.status ?? 'ACTIVE',
      },
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'INVESTOR_CREATED',
      tableName: 'Investor',
      recordId:  investor.id,
      newValues: { name: investor.name },
    })

    return NextResponse.json({ data: investor }, { status: 201 })
  } catch (error: unknown) {
    logger.error('[POST /api/investors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
