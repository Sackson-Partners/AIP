import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { UserRole, DealStage } from '@prisma/client'
import { z } from 'zod'

const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

const StageUpdateSchema = z.object({
  dealStage: z.enum([
    'CONCEPT',
    'PREFEASIBILITY',
    'FEASIBILITY',
    'STRUCTURING',
    'PROCUREMENT',
    'FINANCIAL_CLOSE',
    'CONSTRUCTION',
    'OPERATIONS',
  ]),
})

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!WRITE_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { body = {} }

  const parsed = StageUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const { dealStage } = parsed.data

  try {
    const project = await prisma.project.update({
      where: { id },
      data: { dealStage: dealStage as DealStage },
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'PROJECT_STAGE_UPDATED',
      tableName: 'Project',
      recordId:  id,
      oldValues: { dealStage: project.dealStage },
      newValues: { dealStage },
    })

    return NextResponse.json({ data: project })
  } catch (error: unknown) {
    logger.error('[PATCH /api/projects/[id]/stage]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
