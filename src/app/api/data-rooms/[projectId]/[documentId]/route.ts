import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ projectId: string; documentId: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { projectId, documentId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await prisma.document.findFirst({
    where:   { id: documentId, projectId },
    include: { uploader: { select: { id: true, name: true, email: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Log the VIEW access
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null

  await prisma.documentAccessLog.create({
    data: {
      documentId,
      userId:    session.user.id ?? null,
      email:     session.user.email ?? null,
      action:    'VIEW',
      ipAddress: ip,
    },
  })

  return NextResponse.json({
    data: {
      id:              doc.id,
      name:            doc.name,
      type:            doc.type,
      mime_type:       doc.mimeType,
      size:            doc.size,
      blob_url:        doc.blobUrl,
      version:         doc.version,
      is_confidential: doc.isConfidential,
      uploaded_at:     doc.createdAt.toISOString(),
      uploader_name:   doc.uploader.name ?? doc.uploader.email ?? 'Unknown',
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { projectId, documentId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin-only: only SUPER_ADMIN or ANALYST may delete
  const role = (session.user as { role?: string }).role ?? ''
  if (!['SUPER_ADMIN', 'ANALYST'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const doc = await prisma.document.findFirst({ where: { id: documentId, projectId } })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  await prisma.document.delete({ where: { id: documentId } })

  return NextResponse.json({ success: true })
}
