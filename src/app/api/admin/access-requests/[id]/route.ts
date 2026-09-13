import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendAccessRequestApproval, sendAccessRequestRejection } from '@/lib/email'
import { logger } from '@/lib/logger'
import { UserRole } from '@prisma/client'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { status, reason } = body as { status?: string; reason?: string }

  if (!['APPROVED', 'REJECTED'].includes(status ?? '')) {
    return NextResponse.json({ error: 'status must be APPROVED or REJECTED' }, { status: 400 })
  }

  const request = await prisma.accessRequest.findUnique({ where: { id } })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let tempPassword: string | undefined

  // Wrap in transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Update access request status
    const updatedRequest = await tx.accessRequest.update({
      where: { id },
      data: { status: status!, reviewedBy: session.user.id, reviewedAt: new Date() },
    })

    if (status === 'APPROVED') {
      // Check if user already exists (shouldn't, but guard)
      const existing = await tx.user.findUnique({ where: { email: request.email } })
      if (!existing) {
        tempPassword = crypto.randomBytes(8).toString('hex') // 16-char hex
        await tx.user.create({
          data: {
            email: request.email,
            name: request.fullName,
            role: request.roleRequested as UserRole,
            status: 'ACTIVE',
            authProvider: 'INTERNAL',
            passwordHash: await bcrypt.hash(tempPassword, 12),
            mustChangePass: true,
            organization: request.organization ?? undefined,
          },
        })

        // Create audit log entry
        await tx.auditLog.create({
          data: {
            action: 'ACCESS_REQUEST_APPROVED',
            userId: session.user.id,
            recordId: id,
            newValues: JSON.stringify({
              email: request.email,
              role: request.roleRequested,
              approvedBy: session.user.id,
            }),
          },
        })
      }
    }

    return { updatedRequest, tempPassword }
  }, {
    timeout: 10000, // 10 second timeout
    maxWait: 5000   // 5 second max wait for connection
  })

  // Send emails outside transaction (non-critical, shouldn't block)
  if (status === 'APPROVED' && tempPassword) {
    try {
      await sendAccessRequestApproval({
        email: request.email,
        name: request.fullName,
        role: request.roleRequested,
        temporaryPassword: tempPassword,
      })
    } catch (err) {
      logger.error('[access-request-approval] Failed to send approval email', err)
      // Continue - user is created, admin can manually share password
    }
  } else if (status === 'REJECTED') {
    try {
      await sendAccessRequestRejection({
        email: request.email,
        name: request.fullName,
        reason,
      })
    } catch (err) {
      logger.error('[access-request-rejection] Failed to send rejection email', err)
      // Continue - rejection is recorded
    }
  }

  return NextResponse.json({
    data: { id, status, reviewed_by: session.user.id },
    ...(tempPassword ? { temp_password: tempPassword, message: 'User created and approval email sent.' } : {}),
  })
}
