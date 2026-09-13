import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma, UserRole } from '@prisma/client'
import { buildPartnerProfile } from '@/lib/matching'
import { getInvestorPatchSchema } from '@/lib/schemas/investor'
import { sanitizeInvestor } from '@/lib/response-sanitizer'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const investor = await prisma.investor.findUnique({ where: { id } })
    if (!investor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const profile = buildPartnerProfile({
      id:               investor.id,
      sectorFocus:      investor.sectorFocus,
      countryFocus:     investor.countryFocus,
      stageFocus:       investor.stageFocus,
      minTicket:        investor.minTicket,
      maxTicket:        investor.maxTicket,
      organizationType: investor.organizationType,
    })

    // Build full response object
    const fullInvestor = {
      id:                  investor.id,
      fund_name:           investor.name,
      name:                investor.name,
      email:               investor.email,
      phone:               investor.phone,
      investor_type:       investor.type,
      type:                investor.type,
      organization_type:   investor.organizationType,
      organizationType:    investor.organizationType,
      status:              investor.status,
      country_of_origin:   investor.countryOfOrigin,
      countryOfOrigin:     investor.countryOfOrigin,
      instruments:         investor.instruments ? (() => { try { return JSON.parse(investor.instruments!) as string[] } catch { return [] } })() : [],
      sector_focus:        profile.sectorFocus,
      sectorFocus:         profile.sectorFocus,
      country_focus:       profile.countryFocus,
      countryFocus:        profile.countryFocus,
      stage_focus:         profile.stageFocus,
      stageFocus:          profile.stageFocus,
      aum:                 investor.aum,
      ticket_size_min:     investor.minTicket ?? 0,
      minTicket:           investor.minTicket,
      ticket_size_max:     investor.maxTicket ?? 0,
      maxTicket:           investor.maxTicket,
      target_irr:          investor.targetIRR,
      targetIRR:           investor.targetIRR,
      esg_constraints:     investor.esgConstraints,
      esgConstraints:      investor.esgConstraints,
      description:         investor.description,
      website:             investor.website,
      languages:           JSON.parse(investor.languages ?? '[]') as string[],
      profile_complete:    Math.round(investor.profileComplete),
      profileComplete:     investor.profileComplete,
      created_at:          investor.createdAt.toISOString(),
      createdAt:           investor.createdAt,
      updatedAt:           investor.updatedAt,
      // Note: verified/verifiedAt/userId not in current Investor schema
    }

    // Determine ownership (Investor model has no userId currently)
    const isOwn = false // investor.userId === session.user.id

    // Sanitize based on viewer role and ownership
    const sanitizedInvestor = sanitizeInvestor(
      fullInvestor as Record<string, any>,
      session.user.role as UserRole,
      isOwn
    )

    return NextResponse.json({ data: sanitizedInvestor })
  } catch (error: unknown) {
    logger.error('[GET /api/investors/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Fetch investor and check ownership
  const investor = await prisma.investor.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!investor) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Determine ownership (Investor model has no userId currently)
  const isOwn = false // investor.userId === session.user.id

  // Get appropriate schema
  const schema = getInvestorPatchSchema(session.user.role as UserRole, isOwn)
  if (!schema) {
    return NextResponse.json({ error: 'Forbidden - you cannot edit this investor' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { body = {} }

  // Validate with role-based schema (prevents mass assignment)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const d = parsed.data

  try {
    const updatedInvestor = await prisma.investor.update({
      where: { id },
      data: d as Prisma.InvestorUpdateInput,
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'INVESTOR_UPDATED',
      tableName: 'Investor',
      recordId:  id,
      newValues: d as Record<string, unknown>,
    })

    // Sanitize response
    const sanitizedInvestor = sanitizeInvestor(
      updatedInvestor as Record<string, any>,
      session.user.role as UserRole,
      isOwn
    )

    return NextResponse.json({ data: sanitizedInvestor })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    logger.error('[PATCH /api/investors/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.investor.delete({ where: { id } })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'INVESTOR_DELETED',
      tableName: 'Investor',
      recordId:  id,
    })

    return new NextResponse(null, { status: 204 })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    logger.error('[DELETE /api/investors/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
