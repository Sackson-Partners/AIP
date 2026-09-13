import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma, UserRole, ProjectStatus } from '@prisma/client'
import { deleteCached, getCached, setCached, CacheKeys, CacheTTL } from '@/lib/redis'
import { getProjectPatchSchema, validateFinancialStructure } from '@/lib/schemas/project'
import { validateTransition } from '@/lib/project-state-machine'
import { sanitizeProject } from '@/lib/response-sanitizer'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]
const INTERNAL_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]
const PUBLISHED_STATUSES = ['ACTIVE', 'FUNDED', 'CLOSED']

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userRole = session.user.role as string
  const isInternal = INTERNAL_ROLES.includes(userRole as UserRole)

  // Try cache first
  const cacheKey = CacheKeys.projects.detail(id)
  const cached = await getCached<unknown>(cacheKey)
  if (cached) {
    return NextResponse.json({ data: cached })
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { milestones: true, documents: true },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // External partners can only view published projects
    if (!isInternal && !PUBLISHED_STATUSES.includes(project.status)) {
      logger.warn('External user attempted to access non-published project', {
        userId: session.user.id,
        userEmail: session.user.email,
        userRole,
        projectId: id,
        projectStatus: project.status,
      })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Sanitize based on viewer role
    const sanitizedProject = sanitizeProject(
      project as Record<string, any>,
      userRole as UserRole
    )

    // Cache the project details
    await setCached(cacheKey, sanitizedProject, CacheTTL.MEDIUM) // 5 minutes

    return NextResponse.json({ data: sanitizedProject })
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

  // Fetch project and check ownership
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, ownerId: true, status: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Authorization check
  const isOwner = project.ownerId === session.user.id
  const isAdmin = ADMIN_ROLES.includes(session.user.role as UserRole)

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden - you can only edit your own projects' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { body = {} }

  logger.info('Project update request', {
    projectId: id,
    userId: session.user.id,
    userEmail: session.user.email,
    userRole: session.user.role,
    isOwner,
  })

  // Use role-based schema validation (prevents mass assignment)
  const schema = getProjectPatchSchema(session.user.role as UserRole)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    logger.warn('Project update validation failed', {
      projectId: id,
      userId: session.user.id,
      errors: parsed.error.flatten(),
    })
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const d = parsed.data as Record<string, any>

  // Validate status transition if status is being changed
  if (d.status && d.status !== project.status) {
    const transitionValidation = validateTransition(
      project.status as ProjectStatus,
      d.status as ProjectStatus,
      session.user.role as UserRole
    )

    if (!transitionValidation.valid) {
      logger.warn('Invalid project status transition attempt', {
        projectId: id,
        userId: session.user.id,
        fromStatus: project.status,
        toStatus: d.status,
        userRole: session.user.role,
        error: transitionValidation.error,
      })
      return NextResponse.json(
        { error: transitionValidation.error },
        { status: 422 }
      )
    }

    logger.info('Valid project status transition', {
      projectId: id,
      userId: session.user.id,
      fromStatus: project.status,
      toStatus: d.status,
      userRole: session.user.role,
    })
  }

  // Validate financial structure if any financial fields are being updated
  if (d.totalCost || d.equityRequired || d.debtRequired || d.grantRequired) {
    const validation = validateFinancialStructure({
      totalCost: d.totalCost,
      equityRequired: d.equityRequired,
      debtRequired: d.debtRequired,
      grantRequired: d.grantRequired,
    })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 422 })
    }
  }

  try {
    // Build update data from validated schema (only include defined fields)
    const updateData: Prisma.ProjectUpdateInput = {}

    if (d.title) updateData.title = d.title
    if (d.description !== undefined) updateData.description = d.description
    if (d.country !== undefined) updateData.country = d.country
    if (d.region !== undefined) updateData.region = d.region
    if (d.sector) updateData.sector = d.sector
    if (d.dealStage) updateData.dealStage = d.dealStage
    if (d.projectType) updateData.projectType = d.projectType
    if (d.totalCost !== undefined) updateData.totalCost = d.totalCost
    if (d.equityRequired !== undefined) updateData.equityRequired = d.equityRequired
    if (d.debtRequired !== undefined) updateData.debtRequired = d.debtRequired
    if (d.grantRequired !== undefined) updateData.grantRequired = d.grantRequired
    if (d.location !== undefined) updateData.location = d.location
    if (d.latitude !== undefined) updateData.latitude = d.latitude
    if (d.longitude !== undefined) updateData.longitude = d.longitude
    if (d.startDate) updateData.startDate = d.startDate
    if (d.estimatedCompletionDate) updateData.estimatedCompletionDate = d.estimatedCompletionDate
    if (d.irr !== undefined) updateData.irr = d.irr
    if (d.paybackPeriod !== undefined) updateData.paybackPeriod = d.paybackPeriod
    if (d.esgRating !== undefined) updateData.esgRating = d.esgRating
    if (d.carbonFootprint !== undefined) updateData.carbonFootprint = d.carbonFootprint
    if (d.jobsCreated !== undefined) updateData.jobsCreated = d.jobsCreated
    if (d.strategicNotes !== undefined) updateData.strategicNotes = d.strategicNotes

    // Admin-only fields (only applied if user is admin and field is present)
    if (isAdmin) {
      if (d.status) updateData.status = d.status
      if (d.reviewerId) updateData.reviewerId = d.reviewerId
      if (d.ownerId) updateData.ownerId = d.ownerId
      if (d.publishedAt) updateData.publishedAt = d.publishedAt
      if (d.archived !== undefined) updateData.archived = d.archived
      if (d.archivedAt) updateData.archivedAt = d.archivedAt
      if (d.archivedById) updateData.archivedById = d.archivedById
      if (d.code) updateData.code = d.code
      if (d.riskRating) updateData.riskRating = d.riskRating
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'PROJECT_UPDATED',
      tableName: 'Project',
      recordId:  id,
      newValues: d as Record<string, unknown>,
    })

    // Invalidate caches
    await Promise.all([
      deleteCached('projects:list:*'),
      deleteCached(CacheKeys.projects.detail(id)),
    ])

    logger.info('Project updated successfully', {
      projectId: id,
      userId: session.user.id,
    })

    // Sanitize response
    const sanitizedProject = sanitizeProject(
      updatedProject as Record<string, any>,
      session.user.role as UserRole
    )

    return NextResponse.json({ data: sanitizedProject })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    logger.error('Project update failed', error, { projectId: id, userId: session.user.id })

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
