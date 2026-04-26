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
  name:   z.string().min(1).optional(),
  email:  z.string().email().optional().or(z.literal('')),
  phone:  z.string().optional(),
  type:   z.string().optional(),
  status: z.string().optional(),
})

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
    return NextResponse.json({ data: investor })
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

  let body: unknown
  try { body = await req.json() } catch { body = {} }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const investor = await prisma.investor.update({
      where: { id },
      data: {
        ...(parsed.data.name   !== undefined ? { name:  parsed.data.name }          : {}),
        ...(parsed.data.email  !== undefined ? { email: parsed.data.email || null } : {}),
        ...(parsed.data.phone  !== undefined ? { phone: parsed.data.phone }         : {}),
        ...(parsed.data.type   !== undefined ? { type:  parsed.data.type }          : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status }       : {}),
      },
    })

    await createAuditLog({
      userId:    session.user.id,
      email:     session.user.email ?? undefined,
      action:    'INVESTOR_UPDATED',
      tableName: 'Investor',
      recordId:  id,
      newValues: parsed.data as Record<string, unknown>,
    })

    return NextResponse.json({ data: investor })
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
