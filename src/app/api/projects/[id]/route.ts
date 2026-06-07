import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma, UserRole } from '@prisma/client'
import { z } from 'zod'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]
const INTERNAL_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]
const PUBLISHED_STATUSES = ['ACTIVE', 'FUNDED', 'CLOSED']

const PatchSchema = z.object({
  name:            z.string().min(1).optional(),
  project_name:    z.string().min(1).optional(),
  description:     z.string().optional(),
  status:          z.string().optional(),
  dealStage:       z.string().optional(),
  targetAmount:    z.number().optional(),
  estimated_cost:  z.number().optional(),
  sector:          z.string().optional(),
  country:         z.string().optional(),
  region:          z.string().optional(),
  stage:           z.string().optional(),
  project_type:    z.string().optional(),
  projectType:     z.string().optional(),
  riskRating:      z.string().optional(),
  strategic_notes: z.string().optional(),
  source_url:      z.string().optional(),
  currency:        z.string().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userRole = session.user.role as string
  const isInternal = INTERNAL_ROLES.includes(userRole as UserRole)

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { milestones: true, documents: true },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // External partners can only view published projects
    if (!isInternal && !PUBLISHED_STATUSES.includes(project.status)) {
      console.log(`[GET /api/projects/${id}] Access denied: ${session.user.email} (${userRole}) tried to access ${project.status} project`);
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data: project })
  } catch (error: unknown) {
    logger.error('[GET /api/projects/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { body = {} }

  console.log('[PATCH /api/projects/[id]] Received body:', JSON.stringify(body, null, 2));
  console.log('[PATCH /api/projects/[id]] User:', session.user.email, 'Role:', session.user.role);

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[PATCH /api/projects/[id]] Validation failed:', parsed.error.flatten());
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const d = parsed.data
  const resolvedName = d.name || d.project_name
  const resolvedAmount = d.targetAmount ?? d.estimated_cost
  const resolvedProjectType = d.projectType || d.project_type

  // Map project_type values to ProjectType enum (must match Prisma schema)
  const typeMap: Record<string, string> = {
    EPC: 'SERVICE_CONTRACT',  // EPC contracts are service contracts
    EPC_F: 'BOT',             // EPC+F includes financing = BOT
    'EPC+F': 'BOT',
    PPP: 'PPP',
    PRIVATE: 'CONCESSION',
    OTHER: 'OTHER',
    IPP: 'IPP',               // Independent Power Producer
    BOT: 'BOT',               // Build-Operate-Transfer
    BOO: 'BOO',               // Build-Own-Operate
    CONCESSION: 'CONCESSION',
    DBFOM: 'DBFOM',
    SERVICE_CONTRACT: 'SERVICE_CONTRACT',
  }
  const mappedProjectType = resolvedProjectType
    ? (typeMap[resolvedProjectType.toUpperCase().replace(/\+/g, '_')] || 'OTHER')
    : undefined

  // Auto-calculate risk rating from projectType if riskRating not explicitly provided
  const riskMap: Record<string, string> = {
    SERVICE_CONTRACT: 'Medium',  // EPC
    BOT: 'High',                  // EPC+F, BOT
    BOO: 'High',
    PPP: 'Medium-High',
    IPP: 'Medium-High',
    CONCESSION: 'Variable',
    DBFOM: 'High',
    OTHER: 'Variable',
  }
  const calculatedRisk = mappedProjectType && !d.riskRating ? riskMap[mappedProjectType] : d.riskRating

  // Map sector
  const sectorMap: Record<string, string> = {
    energy: 'ENERGY', transport: 'TRANSPORT', water: 'WATER',
    digital: 'DIGITAL', healthcare: 'HEALTHCARE', health: 'HEALTHCARE',
    education: 'EDUCATION', agriculture: 'AGRICULTURE', housing: 'HOUSING',
    waste_management: 'WASTE_MANAGEMENT', mining: 'OTHER', ports: 'OTHER',
    rail: 'OTHER', roads: 'OTHER', ict: 'DIGITAL', social: 'OTHER',
  }
  const mappedSector = d.sector ? (sectorMap[d.sector.toLowerCase()] || d.sector.toUpperCase()) : undefined

  // Map dealStage from legacy stage field
  const stageMap: Record<string, string> = {
    planned: 'CONCEPT', concept: 'CONCEPT',
    'pre-feasibility': 'PREFEASIBILITY', prefeasibility: 'PREFEASIBILITY',
    feasibility: 'FEASIBILITY', structuring: 'STRUCTURING',
    procurement: 'PROCUREMENT', financial_close: 'FINANCIAL_CLOSE',
    construction: 'CONSTRUCTION', operational: 'OPERATIONS', operations: 'OPERATIONS',
  }
  const resolvedDealStage = d.dealStage || (d.stage ? stageMap[d.stage.toLowerCase()] : undefined)

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(resolvedName       !== undefined ? { title:       resolvedName }       : {}),
        ...(d.description      !== undefined ? { description: d.description }      : {}),
        ...(d.status           !== undefined ? { status:      d.status as Prisma.ProjectUpdateInput['status'] } : {}),
        ...(resolvedDealStage  !== undefined ? { dealStage:   resolvedDealStage as Prisma.ProjectUpdateInput['dealStage'] } : {}),
        ...(resolvedAmount     !== undefined ? { totalCost:   resolvedAmount }     : {}),
        ...(mappedSector       !== undefined ? { sector:      mappedSector as Prisma.ProjectUpdateInput['sector'] } : {}),
        ...(d.country          !== undefined ? { country:     d.country }          : {}),
        ...(d.region           !== undefined ? { region:      d.region }           : {}),
        ...(mappedProjectType  !== undefined ? { projectType: mappedProjectType as Prisma.ProjectUpdateInput['projectType'] } : {}),
        ...(calculatedRisk     !== undefined ? { riskRating:  calculatedRisk }     : {}),
      },
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'PROJECT_UPDATED',
      tableName: 'Project',
      recordId:  id,
      newValues: parsed.data as Record<string, unknown>,
    })

    return NextResponse.json({ data: project })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[PATCH /api/projects/[id]] Database error:', error);
    logger.error('[PATCH /api/projects/[id]]', error)

    // Return detailed error in development
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorDetails = error instanceof Prisma.PrismaClientKnownRequestError
      ? { code: error.code, meta: error.meta }
      : undefined;

    return NextResponse.json({
      error: errorMessage,
      details: errorDetails,
      hint: 'Check console logs for details'
    }, { status: 500 })
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
    await prisma.project.delete({ where: { id } })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'PROJECT_DELETED',
      tableName: 'Project',
      recordId:  id,
    })

    return new NextResponse(null, { status: 204 })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    logger.error('[DELETE /api/projects/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
