import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const documents = await prisma.document.findMany({
    where: { dealRoomId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      uploader: { select: { id: true, name: true, email: true } },
    },
  })

  const data = documents.map(d => ({
    id:                d.id,
    title:             d.name,
    description:       null,
    document_type:     d.type,
    file_name:         d.name,
    file_url:          d.blobUrl ?? '',
    blobUrl:           d.blobUrl ?? '',
    file_size:         d.size,
    mime_type:         d.mimeType,
    version:           d.version,
    is_confidential:   d.isConfidential,
    uploader_name:     d.uploader?.name ?? d.uploader?.email ?? 'Unknown',
    requires_signature: false,
    signature_status:  'none',
    uploaded_at:       d.createdAt.toISOString(),
  }))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const room = await prisma.dealRoom.findUnique({ where: { id } })
  if (!room) return NextResponse.json({ error: 'Deal room not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const name = body.title ?? body.file_name ?? body.name ?? 'Untitled'

  const doc = await prisma.document.create({
    data: {
      name,
      dealRoomId:     id,
      uploaderId:     session.user.id,
      type:           body.document_type ?? 'OTHER',
      mimeType:       body.mime_type ?? null,
      size:           body.file_size ?? null,
      blobUrl:        body.file_url ?? null,
      isPublic:       false,
      isConfidential: true,
    },
  })

  return NextResponse.json({
    data: {
      id:            doc.id,
      title:         doc.name,
      document_type: doc.type,
      file_name:     doc.name,
      file_url:      doc.blobUrl ?? '',
      uploaded_at:   doc.createdAt.toISOString(),
    },
  }, { status: 201 })
}
