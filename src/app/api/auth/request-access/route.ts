import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const VALID_ROLES = [
  'GOV_FOCAL',
  'GOV_TECH',
  'EPC',
  'SPONSOR',
  'PARTNER',
  'GOVERNMENT',
  'SPONSOR_DEVELOPER',
  'EPC_OPERATOR',
  'INSTITUTIONAL_INVESTOR',
]

const GOV_ROLES = ['GOV_FOCAL', 'GOV_TECH', 'GOVERNMENT']

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch (parseError) {
      logger.error('[request-access] JSON parse error', parseError)
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const { email, fullName, organization, country, phone, roleRequested, ministry, message } = body as Record<string, unknown>

    // Validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (!fullName || typeof fullName !== 'string') {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }
    if (!roleRequested || typeof roleRequested !== 'string') {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(roleRequested)) {
      return NextResponse.json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.slice(0, 5).join(', ')}`
      }, { status: 400 })
    }
    if (GOV_ROLES.includes(roleRequested) && (!ministry || typeof ministry !== 'string' || !ministry.trim())) {
      return NextResponse.json({ error: 'Ministry/Department is required for government roles' }, { status: 400 })
    }

    // Check for existing user
    try {
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        return NextResponse.json({
          error: 'An account with this email already exists. Please sign in instead.'
        }, { status: 409 })
      }
    } catch (dbError) {
      logger.error('[request-access] Database error checking existing user', dbError)
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
    }

    // Check for existing pending request
    try {
      const existing = await prisma.accessRequest.findUnique({ where: { email } })
      if (existing && existing.status === 'PENDING') {
        return NextResponse.json({
          error: 'A request with this email is already pending review. Please wait for admin approval.'
        }, { status: 409 })
      }
    } catch (dbError) {
      logger.error('[request-access] Database error checking existing request', dbError)
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
    }

    // Create or update access request
    let request
    try {
      request = await prisma.accessRequest.upsert({
        where:  { email },
        update: {
          fullName,
          organization: organization as string | null ?? null,
          country:      country as string | null ?? null,
          phone:        phone as string | null ?? null,
          roleRequested,
          ministry:     ministry as string | null ?? null,
          message:      message as string | null ?? null,
          status:       'PENDING',
          reviewedBy:   null,
          reviewedAt:   null,
        },
        create: {
          email,
          fullName,
          organization: organization as string | null ?? null,
          country:      country as string | null ?? null,
          phone:        phone as string | null ?? null,
          roleRequested,
          ministry:     ministry as string | null ?? null,
          message:      message as string | null ?? null,
        },
      })
    } catch (dbError) {
      logger.error('[request-access] Database error creating request', dbError)
      return NextResponse.json({ error: 'Failed to save request. Please try again.' }, { status: 500 })
    }

    // Try to send emails, but don't fail if they don't work
    try {
      const { sendAccessRequestConfirmation, notifyAdminsOfAccessRequest } = await import('@/lib/email')

      // Send confirmation email to applicant
      try {
        await sendAccessRequestConfirmation({
          email: request.email,
          name: request.fullName,
          role: request.roleRequested,
        })
        logger.info(`[request-access] Confirmation email sent to ${request.email}`)
      } catch (emailError) {
        logger.warn('[request-access] Failed to send confirmation email (non-critical)', { error: emailError instanceof Error ? emailError.message : String(emailError) })
      }

      // Notify admins
      try {
        const admins = await prisma.user.findMany({
          where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE' },
          select: { email: true },
        })
        const adminEmails = admins.map(a => a.email).filter(Boolean) as string[]

        if (adminEmails.length > 0) {
          await notifyAdminsOfAccessRequest({
            adminEmails,
            requestId: request.id,
            applicantName: request.fullName,
            applicantEmail: request.email,
            role: request.roleRequested,
            organization: request.organization ?? undefined,
            message: request.message ?? undefined,
          })
          logger.info(`[request-access] Admin notification sent to ${adminEmails.length} admins`)
        }
      } catch (emailError) {
        logger.warn('[request-access] Failed to notify admins (non-critical)', { error: emailError instanceof Error ? emailError.message : String(emailError) })
      }
    } catch (importError) {
      logger.warn('[request-access] Email module not available (non-critical)', { error: importError instanceof Error ? importError.message : String(importError) })
    }

    return NextResponse.json({
      success: true,
      data: {
        id:         request.id,
        email:      request.email,
        status:     request.status,
        created_at: request.createdAt.toISOString(),
      },
      message: 'Your access request has been submitted successfully. You will be notified within 2-3 business days.',
    }, { status: 201 })

  } catch (error: unknown) {
    logger.error('[request-access] Unexpected error', error)
    return NextResponse.json({
      error: 'An unexpected error occurred. Please try again or contact support.'
    }, { status: 500 })
  }
}
