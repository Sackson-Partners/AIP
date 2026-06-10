import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UserRole } from '@prisma/client'

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

const ApproveSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
  contactInfo: z.string().optional(), // JSON string with contact details
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const request = await prisma.contactRequest.findUnique({
      where: { id },
    })

    if (!request) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only requester or admin can view
    const isAdmin = ADMIN_ROLES.includes(session.user.role as UserRole)
    if (request.requesterId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ data: request })
  } catch (error) {
    console.error(`[GET /api/contact-requests/${id}] Error:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can approve/reject
  const isAdmin = ADMIN_ROLES.includes(session.user.role as UserRole)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ApproveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { action, rejectionReason, contactInfo } = parsed.data

  try {
    const existing = await prisma.contactRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request already processed' },
        { status: 409 }
      )
    }

    let updated
    if (action === 'APPROVE') {
      updated = await prisma.contactRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: session.user.id,
          approvedAt: new Date(),
          contactInfo,
        },
      })

      // Notify requester
      await prisma.notification.create({
        data: {
          userId: existing.requesterId,
          type: 'CONTACT_APPROVED',
          title: 'Contact Request Approved',
          message: `Your request to contact ${existing.targetType} has been approved`,
          link: `/dashboard/contact-requests/${id}`,
          read: false,
        },
      })
    } else {
      updated = await prisma.contactRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedBy: session.user.id,
          rejectedAt: new Date(),
          rejectionReason,
        },
      })

      // Notify requester
      await prisma.notification.create({
        data: {
          userId: existing.requesterId,
          type: 'CONTACT_REQUEST',
          title: 'Contact Request Declined',
          message: `Your request to contact ${existing.targetType} was declined`,
          link: `/dashboard/contact-requests/${id}`,
          read: false,
        },
      })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error(`[PATCH /api/contact-requests/${id}] Error:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const existing = await prisma.contactRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only requester can withdraw their own request
    if (existing.requesterId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only withdraw pending requests' },
        { status: 409 }
      )
    }

    await prisma.contactRequest.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`[DELETE /api/contact-requests/${id}] Error:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
