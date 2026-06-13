import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UserRole, Prisma } from '@prisma/client'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  sector: z.string().optional(),
  stage: z.string().optional(),
  defaultFields: z.record(z.string(), z.unknown()).optional(),
  isPublic: z.boolean().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Users can see public templates + their own templates
  const templates = await prisma.projectTemplate.findMany({
    where: {
      OR: [
        { isPublic: true },
        { createdById: session.user.id },
      ],
    },
    orderBy: [
      { isPublic: 'desc' }, // Public templates first
      { createdAt: 'desc' },
    ],
  })

  return NextResponse.json({ data: templates })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { name, description, sector, stage, defaultFields, isPublic } = parsed.data

  // Only admins can create public templates
  if (isPublic && !ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json(
      { error: 'Only administrators can create public templates' },
      { status: 403 }
    )
  }

  try {
    const template = await prisma.projectTemplate.create({
      data: {
        name,
        description: description || null,
        sector: sector || null,
        stage: stage || null,
        defaultFields: defaultFields ? (defaultFields as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        isPublic: isPublic || false,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/project-templates] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
