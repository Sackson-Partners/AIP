import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit-log'
import { sendAccessRequestApproval, sendAccessRequestRejection } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const BulkActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'delete']),
  requestIds: z.array(z.string()).min(1).max(50),
  reason: z.string().optional(),
})

/**
 * POST /api/access-requests/bulk
 * Perform bulk actions on access requests (admin only)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = BulkActionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { action, requestIds, reason } = parsed.data

    // Get all access requests
    const accessRequests = await prisma.accessRequest.findMany({
      where: {
        id: { in: requestIds },
        status: 'PENDING', // Only process pending requests
      },
    })

    if (accessRequests.length === 0) {
      return NextResponse.json(
        { error: 'No pending access requests found with the provided IDs' },
        { status: 404 }
      )
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    }

    // Process each request
    for (const accessRequest of accessRequests) {
      try {
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
              password: hashedPassword,
              mustChangePass: true,
              organization: accessRequest.organization,
              country: accessRequest.country,
              phone: accessRequest.phone,
            },
          })

          // Update access request
          await prisma.accessRequest.update({
            where: { id: accessRequest.id },
            data: {
              status: 'APPROVED',
              reviewedBy: session.user.id,
              reviewedAt: new Date(),
            },
          })

          // Send approval email
          await sendAccessRequestApproval({
            email: accessRequest.email,
            name: accessRequest.fullName,
            role: accessRequest.roleRequested,
            temporaryPassword: tempPassword,
          }).catch((err) => {
            console.error('[bulk] Failed to send approval email:', err)
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
              createdFrom: 'bulk_approval',
              accessRequestId: accessRequest.id,
            },
          })

          results.success++
        } else if (action === 'reject') {
          await prisma.accessRequest.update({
            where: { id: accessRequest.id },
            data: {
              status: 'REJECTED',
              reviewedBy: session.user.id,
              reviewedAt: new Date(),
            },
          })

          // Send rejection email
          await sendAccessRequestRejection({
            email: accessRequest.email,
            name: accessRequest.fullName,
            reason,
          }).catch((err) => {
            console.error('[bulk] Failed to send rejection email:', err)
          })

          // Log audit event
          await logAudit({
            userId: session.user.id,
            email: session.user.email || undefined,
            action: 'admin.access_request_rejected',
            tableName: 'AccessRequest',
            recordId: accessRequest.id,
            newValues: { rejectedBy: session.user.id, reason },
          })

          results.success++
        } else if (action === 'delete') {
          await prisma.accessRequest.delete({
            where: { id: accessRequest.id },
          })

          // Log audit event
          await logAudit({
            userId: session.user.id,
            email: session.user.email || undefined,
            action: 'admin.access_request_deleted',
            tableName: 'AccessRequest',
            recordId: accessRequest.id,
          })

          results.success++
        }
      } catch (error) {
        results.failed++
        results.errors.push({
          id: accessRequest.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        console.error(`[bulk] Failed to process request ${accessRequest.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk ${action} completed`,
      results,
    })
  } catch (error) {
    console.error('[POST /api/access-requests/bulk] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk action' },
      { status: 500 }
    )
  }
}
