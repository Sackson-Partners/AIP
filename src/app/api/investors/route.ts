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
  // Accept both 'name' and 'fund_name' (frontend uses fund_name)
  name:      z.string().min(1).optional(),
  fund_name: z.string().min(1).optional(),
  email:     z.string().email().optional().or(z.literal('')),
  phone:     z.string().optional(),
  type:      z.string().optional(),
  investor_type: z.string().optional(),
  status:    z.string().optional(),
}).refine(d => d.name || d.fund_name, { message: 'name or fund_name is required' })

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
    const [rows, total] = await Promise.all([
      prisma.investor.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.investor.count({ where }),
    ])
    // Normalise to frontend-expected shape (fund_name alias, empty arrays for missing rich fields)
    const data = rows.map(inv => ({
      id:              inv.id,
      fund_name:       inv.name,
      name:            inv.name,
      email:           inv.email,
      phone:           inv.phone,
      investor_type:   inv.type,
      type:            inv.type,
      status:          inv.status,
      instruments:     [] as string[],
      sector_focus:    [] as string[],
      country_focus:   [] as string[],
      aum:             null as number | null,
      ticket_size_min: 0,
      ticket_size_max: 0,
      created_at:      inv.createdAt.toISOString(),
    }))
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
    const resolvedName = parsed.data.name ?? parsed.data.fund_name ?? ''
    const resolvedType = parsed.data.type ?? parsed.data.investor_type ?? null
    const investor = await prisma.investor.create({
      data: {
        name:   resolvedName,
        email:  parsed.data.email || null,
        phone:  parsed.data.phone ?? null,
        type:   resolvedType,
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

    return NextResponse.json({
      data: {
        id:            investor.id,
        fund_name:     investor.name,
        name:          investor.name,
        email:         investor.email,
        investor_type: investor.type,
        type:          investor.type,
        status:        investor.status,
        instruments:   [],
        sector_focus:  [],
        country_focus: [],
        created_at:    investor.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (error: unknown) {
    logger.error('[POST /api/investors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
