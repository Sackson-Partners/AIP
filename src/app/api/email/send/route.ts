import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { sendEmail } from '@/lib/email'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { applyRateLimit, rateLimiters } from '@/middleware/rateLimit'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1).max(200),
  template: z.enum(['ic-vote', 'contact-request', 'contact-approved', 'project-published']),
  data: z.record(z.string(), z.unknown()),
})

/**
 * POST /api/email/send
 * Send email via Resend (admin only)
 */
export async function POST(req: NextRequest) {
  // Apply rate limiting (10 emails per hour)
  const rateLimitResponse = await applyRateLimit(req, rateLimiters.post)
  if (rateLimitResponse) return rateLimitResponse

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can send emails via API
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SendEmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { to, subject, template, data } = parsed.data

  try {
    // Template-specific email sending is handled by dedicated functions
    // This endpoint is a fallback for manual email sending
    return NextResponse.json({
      message: 'Use dedicated email functions (sendICVoteRequest, sendContactRequestNotification, etc.) instead',
      error: 'Direct email sending not implemented',
    }, { status: 501 })
  } catch (error) {
    console.error('[POST /api/email/send] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
