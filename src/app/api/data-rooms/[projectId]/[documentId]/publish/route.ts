import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ projectId: string; documentId: string }> }

// PATCH - Toggle document publish status (Internal staff only)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { projectId, documentId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if user is internal staff
  const userRole = session.user.role as string
  if (!['SUPER_ADMIN', 'ADMIN', 'ANALYST'].includes(userRole)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { isPublic } = body

  if (typeof isPublic !== 'boolean') {
    return NextResponse.json({ error: 'isPublic (boolean) required' }, { status: 400 })
  }

  try {
    // Verify document belongs to this project
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.projectId !== projectId) {
      return NextResponse.json({ error: 'Document does not belong to this project' }, { status: 400 })
    }

    // Update publish status
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { isPublic },
    })

    console.log(`[data-room] Document ${isPublic ? 'published' : 'unpublished'}: ${documentId} by ${session.user.email}`)

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        isPublic: updated.isPublic,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    console.error('[data-room] Toggle publish error:', error)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}
