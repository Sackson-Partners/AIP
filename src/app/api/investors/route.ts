import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma, UserRole } from '@prisma/client'
import { z } from 'zod'
import { buildPartnerProfile, profileCompleteness } from '@/lib/matching'
import { sanitizeInvestor, sanitizeList } from '@/lib/response-sanitizer'

const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

const CreateSchema = z.object({
  name:              z.string().min(1).optional(),
  fund_name:         z.string().min(1).optional(),
  email:             z.string().email().optional().or(z.literal('')),
  phone:             z.string().optional(),
  type:              z.string().optional(),
  investor_type:     z.string().optional(),
  organization_type: z.string().optional(),
  status:            z.string().optional(),
  country_of_origin: z.string().optional(),
  sector_focus:      z.array(z.string()).optional(),
  country_focus:     z.union([z.array(z.string()), z.string()]).optional(),
  stage_focus:       z.array(z.string()).optional(),
  instruments:       z.union([z.array(z.string()), z.string()]).optional(),
  min_ticket:        z.number().optional(),
  max_ticket:        z.number().optional(),
  ticket_size_min:   z.number().optional(),
  ticket_size_max:   z.number().optional(),
  aum:               z.number().optional(),
  target_irr:        z.number().optional(),
  esg_constraints:   z.string().optional(),
  description:       z.string().optional(),
  website:           z.string().optional(),
}).refine(d => d.name || d.fund_name, { message: 'name or fund_name is required' })

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor') // Cursor-based pagination
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
    // Support both cursor-based and offset-based pagination
    let rows: Awaited<ReturnType<typeof prisma.investor.findMany>>
    let total: number | undefined

    if (cursor) {
      // Cursor-based pagination (more efficient for large datasets)
      rows = await prisma.investor.findMany({
        where,
        take: limit + 1, // Fetch one extra to determine if there's a next page
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      })
    } else {
      // Offset-based pagination (backward compatible)
      [rows, total] = await Promise.all([
        prisma.investor.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.investor.count({ where }),
      ])
    }
    // Handle cursor pagination response
    let hasMore = false
    let nextCursor: string | null = null

    if (cursor) {
      hasMore = rows.length > limit
      if (hasMore) {
        rows = rows.slice(0, -1) // Remove extra item
        nextCursor = rows[rows.length - 1]?.id ?? null
      }
    }

    const data = rows.map(inv => {
      const profile = buildPartnerProfile({
        id:               inv.id,
        sectorFocus:      inv.sectorFocus,
        countryFocus:     inv.countryFocus,
        stageFocus:       inv.stageFocus,
        minTicket:        inv.minTicket,
        maxTicket:        inv.maxTicket,
        organizationType: inv.organizationType,
      })
      return {
        id:                  inv.id,
        // userId:              inv.userId, // Not in current schema
        fund_name:           inv.name,
        name:                inv.name,
        email:               inv.email,
        phone:               inv.phone,
        investor_type:       inv.type,
        type:                inv.type,
        organization_type:   inv.organizationType,
        organizationType:    inv.organizationType,
        status:              inv.status,
        country_of_origin:   inv.countryOfOrigin,
        countryOfOrigin:     inv.countryOfOrigin,
        instruments:         inv.instruments ? (() => { try { return JSON.parse(inv.instruments!) as string[] } catch { return [] } })() : [],
        sector_focus:        profile.sectorFocus,
        sectorFocus:         profile.sectorFocus,
        country_focus:       profile.countryFocus,
        countryFocus:        profile.countryFocus,
        stage_focus:         profile.stageFocus,
        stageFocus:          profile.stageFocus,
        aum:                 inv.aum,
        ticket_size_min:     inv.minTicket ?? 0,
        minTicket:           inv.minTicket,
        ticket_size_max:     inv.maxTicket ?? 0,
        maxTicket:           inv.maxTicket,
        target_irr:          inv.targetIRR,
        targetIRR:           inv.targetIRR,
        esg_constraints:     inv.esgConstraints,
        esgConstraints:      inv.esgConstraints,
        description:         inv.description,
        website:             inv.website,
        languages:           JSON.parse(inv.languages ?? '[]') as string[],
        profile_complete:    Math.round(inv.profileComplete),
        profileComplete:     inv.profileComplete,
        created_at:          inv.createdAt.toISOString(),
        createdAt:           inv.createdAt,
        updatedAt:           inv.updatedAt,
        // verified:            inv.verified, // Not in current schema
        // verifiedAt:          inv.verifiedAt,
      }
    })

    // Sanitize all investors based on viewer role
    const sanitizedData = sanitizeList(
      data as Record<string, any>[],
      (investor) => sanitizeInvestor(
        investor,
        session.user.role as UserRole,
        false // investor.userId === session.user.id // userId not in schema
      )
    )

    // Return appropriate pagination metadata
    if (cursor) {
      return NextResponse.json({ data: sanitizedData, pagination: { limit, hasMore, nextCursor } })
    } else {
      return NextResponse.json({ data: sanitizedData, pagination: { page, limit, total, pages: Math.ceil(total! / limit) } })
    }
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
    const d = parsed.data
    const resolvedName = d.name ?? d.fund_name ?? ''
    const resolvedType = d.type ?? d.investor_type ?? null
    const orgType      = d.organization_type ?? null
    const minTicket    = d.min_ticket ?? d.ticket_size_min ?? null
    const maxTicket    = d.max_ticket ?? d.ticket_size_max ?? null

    const toJsonArr = (v: string | string[] | undefined): string | null => {
      if (!v) return null
      const arr = Array.isArray(v) ? v : v.split(',').map(s => s.trim()).filter(Boolean)
      return arr.length ? JSON.stringify(arr) : null
    }

    const invData = {
      name:             resolvedName,
      email:            d.email || null,
      phone:            d.phone ?? null,
      type:             resolvedType,
      status:           d.status ?? 'ACTIVE',
      organizationType: orgType,
      countryOfOrigin:  d.country_of_origin ?? null,
      sectorFocus:      toJsonArr(d.sector_focus),
      countryFocus:     toJsonArr(d.country_focus),
      stageFocus:       toJsonArr(d.stage_focus),
      instruments:      toJsonArr(d.instruments),
      minTicket,
      maxTicket,
      aum:              d.aum ?? null,
      targetIRR:        d.target_irr ?? null,
      esgConstraints:   d.esg_constraints ?? null,
      description:      d.description ?? null,
      website:          d.website ?? null,
    }

    const completeness = profileCompleteness({
      name:             invData.name,
      email:            invData.email,
      organizationType: invData.organizationType,
      sectorFocus:      invData.sectorFocus,
      countryFocus:     invData.countryFocus,
      stageFocus:       invData.stageFocus,
      minTicket:        invData.minTicket,
      maxTicket:        invData.maxTicket,
      instruments:      invData.instruments,
      description:      invData.description,
      website:          invData.website,
      targetIRR:        invData.targetIRR,
      countryOfOrigin:  invData.countryOfOrigin,
    })

    const investor = await prisma.investor.create({
      data: { ...invData, profileComplete: completeness },
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'INVESTOR_CREATED',
      tableName: 'Investor',
      recordId:  investor.id,
      newValues: { name: investor.name },
    })

    const responseData = {
      id:                  investor.id,
      // userId:              investor.userId, // Not in current schema
      fund_name:           investor.name,
      name:                investor.name,
      email:               investor.email,
      investor_type:       investor.type,
      type:                investor.type,
      organization_type:   investor.organizationType,
      organizationType:    investor.organizationType,
      status:              investor.status,
      sector_focus:        d.sector_focus ?? [],
      sectorFocus:         invData.sectorFocus,
      country_focus:       Array.isArray(d.country_focus) ? d.country_focus : [],
      countryFocus:        invData.countryFocus,
      stage_focus:         d.stage_focus ?? [],
      stageFocus:          invData.stageFocus,
      instruments:         Array.isArray(d.instruments) ? d.instruments : [],
      ticket_size_min:     minTicket ?? 0,
      minTicket:           minTicket,
      ticket_size_max:     maxTicket ?? 0,
      maxTicket:           maxTicket,
      profile_complete:    completeness,
      profileComplete:     completeness,
      created_at:          investor.createdAt.toISOString(),
      createdAt:           investor.createdAt,
      updatedAt:           investor.updatedAt,
    }

    // Sanitize created investor
    const isOwn = false // investor.userId === session.user.id // userId not in schema
    const sanitizedInvestor = sanitizeInvestor(
      responseData as Record<string, any>,
      session.user.role as UserRole,
      isOwn
    )

    return NextResponse.json({ data: sanitizedInvestor }, { status: 201 })
  } catch (error: unknown) {
    logger.error('[POST /api/investors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
