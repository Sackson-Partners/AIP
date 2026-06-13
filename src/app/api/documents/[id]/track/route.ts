import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { trackDocumentEvent } from '@/lib/document-intelligence'
import { z } from 'zod'

const TrackEventSchema = z.object({
  eventType: z.enum(['VIEW', 'DOWNLOAD', 'SHARE']),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * POST /api/documents/[id]/track
 * Track document event (view, download, share)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: documentId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = TrackEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { eventType, metadata } = parsed.data

  try {
    await trackDocumentEvent({
      documentId,
      userId: session.user.id,
      userEmail: session.user.email || undefined,
      eventType,
      metadata,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/documents/:id/track] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
