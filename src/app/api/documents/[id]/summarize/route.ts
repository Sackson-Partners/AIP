import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { summarizeDocument } from '@/lib/document-intelligence'
import { UserRole } from '@prisma/client'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

/**
 * POST /api/documents/[id]/summarize
 * Trigger AI summarization for a document (requires document content)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins/analysts can trigger summarization
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: documentId } = await params

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if already processing or completed
    if (document.summarizationStatus === 'PROCESSING') {
      return NextResponse.json({
        error: 'Summarization already in progress',
      }, { status: 409 })
    }

    // Get document content (placeholder - in real implementation, extract from blobUrl)
    // For now, return pending status and the actual summarization should be done via background job
    await prisma.document.update({
      where: { id: documentId },
      data: { summarizationStatus: 'PENDING' },
    })

    // TODO: Trigger Inngest background job here
    // await inngest.send({ name: 'document.summarize', data: { documentId } })

    return NextResponse.json({
      message: 'Summarization queued',
      status: 'PENDING',
    })
  } catch (error) {
    console.error('[POST /api/documents/:id/summarize] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/documents/[id]/summarize
 * Get current summarization status and results
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: documentId } = await params

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        summary: true,
        keyInsights: true,
        summarizedAt: true,
        summarizationStatus: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ data: document })
  } catch (error) {
    console.error('[GET /api/documents/:id/summarize] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
