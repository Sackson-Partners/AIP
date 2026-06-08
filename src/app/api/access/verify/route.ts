import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/access/verify
 * Verify access code for Data Room or PESTEL access
 * Body: { accessCode: string, projectId: string, type: 'data-room' | 'pestel' }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { accessCode, projectId, type } = body

  if (!accessCode || !projectId) {
    return NextResponse.json({
      error: 'accessCode and projectId required'
    }, { status: 400 })
  }

  // Validate format: 6-digit code
  if (!/^\d{6}$/.test(accessCode)) {
    return NextResponse.json({
      valid: false,
      error: 'Invalid access code format'
    }, { status: 400 })
  }

  try {
    // Look up access code in database
    const accessRecord = await prisma.dataRoomAccess.findFirst({
      where: {
        accessCode,
        projectId,
        userId: session.user.id,
        ndaSigned: true, // Must have signed NDA
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          }
        }
      }
    })

    if (!accessRecord) {
      console.log(`[access/verify] Invalid code attempt: ${accessCode} for project ${projectId} by user ${session.user.email}`)
      return NextResponse.json({
        valid: false,
        error: 'Invalid or expired access code'
      }, { status: 403 })
    }

    // Check expiration
    if (accessRecord.expiresAt && accessRecord.expiresAt < new Date()) {
      console.log(`[access/verify] Expired code: ${accessCode} for project ${projectId}`)
      return NextResponse.json({
        valid: false,
        error: 'Access code has expired'
      }, { status: 403 })
    }

    // Check project is published (not DRAFT or COMPLETE)
    if (accessRecord.project.status && ['DRAFT', 'COMPLETE'].includes(accessRecord.project.status)) {
      return NextResponse.json({
        valid: false,
        error: 'Project not yet published'
      }, { status: 403 })
    }

    console.log(`[access/verify] Valid access: ${session.user.email} → project ${projectId} (${type})`)

    return NextResponse.json({
      valid: true,
      accessId: accessRecord.id,
      accessLevel: accessRecord.accessLevel,
      grantedAt: accessRecord.createdAt,
      expiresAt: accessRecord.expiresAt,
      project: {
        id: accessRecord.project.id,
        title: accessRecord.project.title,
      }
    })

  } catch (error) {
    console.error('[access/verify] Verification error:', error)
    return NextResponse.json({
      error: 'Verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
