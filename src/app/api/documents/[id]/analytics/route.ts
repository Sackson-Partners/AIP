import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { getDocumentAnalytics } from '@/lib/document-intelligence'
import { UserRole } from '@prisma/client'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

/**
 * GET /api/documents/[id]/analytics
 * Get document analytics (views, downloads, unique users)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins/analysts can view analytics
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: documentId } = await params

  try {
    const analytics = await getDocumentAnalytics(documentId)
    return NextResponse.json({ data: analytics })
  } catch (error) {
    console.error('[GET /api/documents/:id/analytics] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
