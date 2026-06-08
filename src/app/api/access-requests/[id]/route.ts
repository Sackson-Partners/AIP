import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit-log'
import { sendAccessRequestApproval, sendAccessRequestRejection } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const ApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
})

/**
 * GET /api/access-requests/[id]
 * Get a specific access request (admin only)
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id },
    })

    if (!accessRequest) {
      return NextResponse.json({ error: 'Access request not found' }, { status: 404 })
    }

    return NextResponse.json({ data: accessRequest })
  } catch (error) {
    console.error('[GET /api/access-requests/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch access request' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/access-requests/[id]
 * Approve or reject an access request (admin only)
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = ApprovalSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { action, reason } = parsed.data

    // Get the access request
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id },
    })

    if (!accessRequest) {
      return NextResponse.json({ error: 'Access request not found' }, { status: 404 })
    }

    if (accessRequest.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: 'Access request already processed',
          status: accessRequest.status,
        },
        { status: 400 }
      )
    }

    // Handle approval
    if (action === 'approve') {
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!'
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      // Create user account
      const user = await prisma.user.create({
        data: {
          email: accessRequest.email,
          name: accessRequest.fullName,
          role: accessRequest.roleRequested as any,
          status: 'ACTIVE',
          authProvider: 'INTERNAL',
          passwordHash: hashedPassword,
          mustChangePass: true,
          organization: accessRequest.organization,
          country: accessRequest.country,
          phone: accessRequest.phone,
        },
      })

      // Update access request
      await prisma.accessRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      })

      // Log audit event
      await logAudit({
        userId: session.user.id,
        email: session.user.email || undefined,
        action: 'user.create',
        tableName: 'User',
        recordId: user.id,
        newValues: {
          email: user.email,
          role: user.role,
          createdFrom: 'access_request',
          accessRequestId: id,
        },
      })

      await logAudit({
        userId: session.user.id,
        email: session.user.email || undefined,
        action: 'admin.access_request_approved',
        tableName: 'AccessRequest',
        recordId: id,
        newValues: { userId: user.id, approvedBy: session.user.id },
      })

      // Send approval email with temporary password
      await sendAccessRequestApproval({
        email: accessRequest.email,
        name: accessRequest.fullName,
        role: accessRequest.roleRequested,
        temporaryPassword: tempPassword,
      }).catch((err) => {
        console.error('[access-requests] Failed to send approval email:', err)
      })

      return NextResponse.json({
        success: true,
        message: 'Access request approved and user account created',
        userId: user.id,
      })
    }

    // Handle rejection
    if (action === 'reject') {
      await prisma.accessRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      })

      // Log audit event
      await logAudit({
        userId: session.user.id,
        email: session.user.email || undefined,
        action: 'admin.access_request_rejected',
        tableName: 'AccessRequest',
        recordId: id,
        newValues: { rejectedBy: session.user.id, reason },
      })

      // Send rejection email
      await sendAccessRequestRejection({
        email: accessRequest.email,
        name: accessRequest.fullName,
        reason,
      }).catch((err) => {
        console.error('[access-requests] Failed to send rejection email:', err)
      })

      return NextResponse.json({
        success: true,
        message: 'Access request rejected',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[PATCH /api/access-requests/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process access request' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/access-requests/[id]
 * Delete an access request (admin only)
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await prisma.accessRequest.delete({
      where: { id },
    })

    // Log audit event
    await logAudit({
      userId: session.user.id,
      email: session.user.email || undefined,
      action: 'admin.access_request_deleted',
      tableName: 'AccessRequest',
      recordId: id,
    })

    return NextResponse.json({
      success: true,
      message: 'Access request deleted',
    })
  } catch (error) {
    console.error('[DELETE /api/access-requests/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete access request' },
      { status: 500 }
    )
  }
}
