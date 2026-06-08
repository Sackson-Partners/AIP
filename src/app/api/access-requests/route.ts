import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit-log'
import { inngest } from '@/lib/inngest/client'
import { z } from 'zod'

// Validation schema
const AccessRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  organization: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  roleRequested: z.enum([
    'GOVERNMENT',
    'SPONSOR_DEVELOPER',
    'EPC_OPERATOR',
    'INSTITUTIONAL_INVESTOR',
  ]),
  ministry: z.string().optional(),
  message: z.string().max(1000).optional(),
})

/**
 * POST /api/access-requests
 * Submit a new access request (public endpoint)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = AccessRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const data = parsed.data

    // Check if request already exists for this email
    const existing = await prisma.accessRequest.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      if (existing.status === 'PENDING') {
        return NextResponse.json(
          {
            error: 'Access request already pending',
            message: 'You already have a pending access request. Please wait for admin approval.',
          },
          { status: 409 }
        )
      }

      if (existing.status === 'APPROVED') {
        return NextResponse.json(
          {
            error: 'Access already granted',
            message: 'Your access has already been approved. Please sign in.',
          },
          { status: 409 }
        )
      }

      // If rejected, allow resubmission
      if (existing.status === 'REJECTED') {
        await prisma.accessRequest.update({
          where: { id: existing.id },
          data: {
            ...data,
            status: 'PENDING',
            reviewedBy: null,
            reviewedAt: null,
            updatedAt: new Date(),
          },
        })

        return NextResponse.json({
          success: true,
          message: 'Access request resubmitted successfully',
        })
      }
    }

    // Create new access request
    const accessRequest = await prisma.accessRequest.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        organization: data.organization,
        country: data.country,
        phone: data.phone,
        roleRequested: data.roleRequested,
        ministry: data.ministry,
        message: data.message,
        status: 'PENDING',
      },
    })

    // Log audit event
    await logAudit({
      email: data.email,
      action: 'admin.access_request_submitted',
      tableName: 'AccessRequest',
      recordId: accessRequest.id,
      newValues: { email: data.email, roleRequested: data.roleRequested },
      ipAddress:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        undefined,
    })

    // Send confirmation email to applicant
    // TODO: Create email function for access request confirmation

    // Notify admins via email
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
        status: 'ACTIVE',
      },
      select: { email: true },
    })

    const adminEmails = admins.map((a) => a.email).filter(Boolean) as string[]

    if (adminEmails.length > 0) {
      // Send admin notification via background job
      await inngest
        .send({
          name: 'notification/send',
          data: {
            userId: 'system',
            type: 'access_request_submitted',
            title: 'New Access Request',
            message: `${data.fullName} (${data.email}) requested ${data.roleRequested} access`,
            link: `/admin/access-requests`,
          },
        })
        .catch((err) => {
          console.error('[access-requests] Failed to send notification:', err)
        })
    }

    return NextResponse.json({
      success: true,
      message:
        'Access request submitted successfully. You will receive an email notification within 2-3 business days.',
      requestId: accessRequest.id,
    })
  } catch (error) {
    console.error('[POST /api/access-requests] Error:', error)
    return NextResponse.json(
      { error: 'Failed to submit access request' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/access-requests
 * List access requests (admin only)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  // Only admins can view access requests
  if (!session?.user?.id || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const where = {
      ...(status && { status }),
    }

    const [requests, total] = await Promise.all([
      prisma.accessRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.accessRequest.count({ where }),
    ])

    return NextResponse.json({
      data: requests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + requests.length < total,
      },
    })
  } catch (error) {
    console.error('[GET /api/access-requests] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch access requests' },
      { status: 500 }
    )
  }
}
