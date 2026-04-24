// src/app/api/admin/promote/route.ts
// MIGRATED: Supabase service role → Prisma + NextAuth
// Endpoint: POST /api/admin/promote
// Body: { userId: string, role: string }
// Auth: SUPER_ADMIN only

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { UserRole } from '@prisma/client'

const VALID_ROLES = [
  'SUPER_ADMIN',
  'ANALYST',
  'GOVERNMENT',
  'SPONSOR_DEVELOPER',
  'EPC_OPERATOR',
  'INSTITUTIONAL_INVESTOR',
] as const

export async function POST(request: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────────
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      )
    }

    // ── Parse body ──────────────────────────────────────────────
    const body = await request.json()
    const { userId, role } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    // ── Prevent self-demotion ───────────────────────────────────
    if (userId === session.user.id && role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      )
    }

    // ── Fetch target user ───────────────────────────────────────
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, status: true },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const previousRole = targetUser.role

    // ── Update role ─────────────────────────────────────────────
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        status: true,
      },
    })

    // ── Audit log ───────────────────────────────────────────────
    await createAuditLog({
      userId: session.user.id,
      email: session.user.email ?? undefined,
      action: 'PROMOTE_USER',
      tableName: 'users',
      recordId: userId,
      oldValues: { role: previousRole },
      newValues: { role },
    })

    return NextResponse.json({
      message: `User promoted to ${role} successfully`,
      user: updated,
    })
  } catch (error: unknown) {
    logger.error('[PROMOTE] Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
