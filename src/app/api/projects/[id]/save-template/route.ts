import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { UserRole, Prisma } from '@prisma/client'
import { z } from 'zod'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

const SaveTemplateSchema = z.object({
  templateName: z.string().min(1).max(100),
  templateDescription: z.string().optional(),
  isPublic: z.boolean().optional(),
  includeFields: z.array(z.string()).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SaveTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { templateName, templateDescription, isPublic, includeFields } = parsed.data

  // Only admins can create public templates
  if (isPublic && !ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json(
      { error: 'Only administrators can create public templates' },
      { status: 403 }
    )
  }

  try {
    // Fetch project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build defaultFields from project
    const fieldsToInclude = includeFields || [
      'sector',
      'projectType',
      'dealStage',
      'riskRating',
    ]

    const defaultFields: Record<string, unknown> = {}
    for (const field of fieldsToInclude) {
      if (field in project && project[field as keyof typeof project] != null) {
        defaultFields[field] = project[field as keyof typeof project]
      }
    }

    // Create template
    const template = await prisma.projectTemplate.create({
      data: {
        name: templateName,
        description: templateDescription || project.description || null,
        sector: project.sector || null,
        stage: project.dealStage || null,
        defaultFields: defaultFields as unknown as Prisma.InputJsonValue,
        isPublic: isPublic || false,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects/:id/save-template] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
