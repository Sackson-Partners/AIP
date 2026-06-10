import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateSchema = z.object({
  targetType: z.enum(['PROJECT', 'INVESTOR', 'PARTNER']),
  targetId: z.string().min(1),
  message: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type') // 'sent' | 'received'

  try {
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (type === 'sent') {
      where.requesterId = session.user.id
    } else if (type === 'received') {
      // User is target of request - needs to be admin/owner of target
      // For now, show all pending requests to admins
      where.status = 'PENDING'
    }

    const requests = await prisma.contactRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: requests })
  } catch (error) {
    console.error('[GET /api/contact-requests] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
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

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { targetType, targetId, message } = parsed.data

  try {
    // Check for existing pending request
    const existing = await prisma.contactRequest.findFirst({
      where: {
        requesterId: session.user.id,
        targetType,
        targetId,
        status: 'PENDING',
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'You already have a pending request for this contact' },
        { status: 409 }
      )
    }

    // Create contact request
    const request = await prisma.contactRequest.create({
      data: {
        requesterId: session.user.id,
        targetType,
        targetId,
        message,
        status: 'PENDING',
      },
    })

    // Create notification for admins
    // TODO: Get actual target owner/admin users
    await prisma.notification.create({
      data: {
        userId: 'ADMIN', // Placeholder - should get actual admin user IDs
        type: 'CONTACT_REQUEST',
        title: 'New Contact Request',
        message: `A user has requested contact information for ${targetType} ${targetId}`,
        link: `/dashboard/contact-requests/${request.id}`,
        read: false,
      },
    })

    return NextResponse.json({ data: request }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/contact-requests] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
