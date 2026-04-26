import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma, UserRole, ProjectStatus, ProjectSector } from '@prisma/client'
import { z } from 'zod'

const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

const CreateSchema = z.object({
  name:            z.string().optional(),
  project_name:    z.string().optional(),
  description:     z.string().optional(),
  strategic_notes: z.string().optional(),
  status:          z.string().optional(),
  targetAmount:    z.number().optional(),
  estimated_cost:  z.number().optional(),
  sector:          z.string().optional(),
  country:         z.string().optional(),
  region:          z.string().optional(),
  stage:           z.string().optional(),
  project_type:    z.string().optional(),
  currency:        z.string().optional(),
}).refine(d => d.name || d.project_name, { message: 'name is required' })

function generateCode(): string {
  return `AIP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const status = searchParams.get('status') as ProjectStatus | null
  const search = searchParams.get('search') ?? ''

  const where: Prisma.ProjectWhereInput = {
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { title:       { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  }

  try {
    const [data, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ])
    return NextResponse.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error: unknown) {
    logger.error('[GET /api/projects]', error)
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

  const d = parsed.data
  const resolvedName = d.name || d.project_name || ''

  // Map free-text form values to Prisma enum values
  const sectorMap: Record<string, ProjectSector> = {
    energy: ProjectSector.ENERGY, transport: ProjectSector.TRANSPORT,
    water: ProjectSector.WATER, digital: ProjectSector.DIGITAL,
    healthcare: ProjectSector.HEALTHCARE, health: ProjectSector.HEALTHCARE,
    education: ProjectSector.EDUCATION, agriculture: ProjectSector.AGRICULTURE,
    housing: ProjectSector.HOUSING, waste_management: ProjectSector.WASTE_MANAGEMENT,
    mining: ProjectSector.OTHER, ports: ProjectSector.OTHER,
    rail: ProjectSector.OTHER, roads: ProjectSector.OTHER,
    ict: ProjectSector.DIGITAL, social: ProjectSector.OTHER,
  }
  const resolvedSector = d.sector
    ? (sectorMap[d.sector.toLowerCase()] ?? ProjectSector.OTHER)
    : undefined

  const validStatuses = Object.values(ProjectStatus) as string[]
  const resolvedStatus = d.status && validStatuses.includes(d.status.toUpperCase())
    ? d.status.toUpperCase() as ProjectStatus
    : ProjectStatus.DRAFT

  try {
    const project = await prisma.project.create({
      data: {
        code:        generateCode(),
        title:       resolvedName,
        description: d.description || d.strategic_notes,
        status:      resolvedStatus,
        totalCost:   d.targetAmount ?? d.estimated_cost,
        sector:      resolvedSector,
        country:     d.country,
        region:      d.region,
        ownerId:     session.user.id,
      },
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'PROJECT_CREATED',
      tableName: 'Project',
      recordId:  project.id,
      newValues: { title: resolvedName, status: project.status },
    })

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (error: unknown) {
    logger.error('[POST /api/projects]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
