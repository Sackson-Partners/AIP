import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { Prisma, UserRole } from '@prisma/client'
import { z } from 'zod'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

const PatchSchema = z.object({
  name:         z.string().min(1).optional(),
  description:  z.string().optional(),
  status:       z.string().optional(),
  targetAmount: z.number().optional(),
  sector:       z.string().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { milestones: true, documents: true },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const { name, description, status, targetAmount } = parsed.data

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name         !== undefined ? { title:     name }         : {}),
        ...(description  !== undefined ? { description }             : {}),
        ...(status       !== undefined ? { status:    status as Prisma.ProjectUpdateInput['status'] } : {}),
        ...(targetAmount !== undefined ? { totalCost: targetAmount } : {}),
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
    logger.error('[PATCH /api/projects/[id]]', error)
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
