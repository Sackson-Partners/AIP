import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { UserRole, ProjectStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { deleteCached } from '@/lib/redis'

const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

const CreateFromTemplateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  overrideFields: z.record(z.string(), z.unknown()).optional(),
})

function generateCode(): string {
  return `AIP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!WRITE_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { templateId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateFromTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { title, description, country, region, overrideFields } = parsed.data

  try {
    // Fetch template
    const template = await prisma.projectTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check access: user can use public templates or their own templates
    if (!template.isPublic && template.createdById !== session.user.id) {
      return NextResponse.json(
        { error: 'You do not have access to this template' },
        { status: 403 }
      )
    }

    // Merge template defaults with override fields
    const defaultFields = (template.defaultFields as Record<string, unknown>) || {}
    const mergedFields = { ...defaultFields, ...(overrideFields || {}) }

    // Create project from template
    const project = await prisma.project.create({
      data: {
        code: generateCode(),
        title,
        description: description || template.description || undefined,
        status: (mergedFields.status as ProjectStatus) || ProjectStatus.DRAFT,
        dealStage: (mergedFields.dealStage as Prisma.ProjectCreateInput['dealStage']) || 'CONCEPT',
        totalCost: mergedFields.totalCost as number | undefined,
        sector: (mergedFields.sector as Prisma.ProjectCreateInput['sector']) || template.sector as Prisma.ProjectCreateInput['sector'] || undefined,
        country: country || (mergedFields.country as string) || undefined,
        region: region || (mergedFields.region as string) || undefined,
        projectType: mergedFields.projectType as Prisma.ProjectCreateInput['projectType'] || undefined,
        riskRating: mergedFields.riskRating as string | undefined,
        ownerId: session.user.id,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      email: session.user.email ?? undefined,
      action: 'PROJECT_CREATED',
      tableName: 'Project',
      recordId: project.id,
      newValues: {
        title,
        status: project.status,
        templateId: template.id,
        templateName: template.name,
      },
    })

    // Invalidate project list caches
    await deleteCached('projects:list:*')

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects/from-template] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
