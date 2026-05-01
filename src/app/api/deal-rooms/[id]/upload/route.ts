import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

type Ctx = { params: Promise<{ id: string }> }

const VALID_DOC_TYPES = [
  'FEASIBILITY_STUDY','ENVIRONMENTAL_IMPACT','FINANCIAL_MODEL',
  'LEGAL_AGREEMENT','TECHNICAL_SPECS','EIN_REPORT','PETFEL_REPORT',
  'COMPLIANCE_REPORT','OTHER',
]

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const room = await prisma.dealRoom.findUnique({ where: { id } })
  if (!room) return NextResponse.json({ error: 'Deal room not found' }, { status: 404 })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Blob storage not configured.' }, { status: 503 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Max 50 MB.' }, { status: 413 })
  }

  const rawType = formData.get('type') as string | null
  const docType = rawType && VALID_DOC_TYPES.includes(rawType) ? rawType : 'OTHER'

  const blob = await put(`deal-rooms/${id}/${Date.now()}-${file.name}`, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })

  const doc = await prisma.document.create({
    data: {
      name:           file.name,
      dealRoomId:     id,
      uploaderId:     session.user.id,
      type:           docType as never,
      mimeType:       file.type || null,
      size:           file.size,
      blobUrl:        blob.url,
      blobKey:        blob.pathname,
      isPublic:       false,
      isConfidential: true,
    },
  })

  return NextResponse.json({
    data: {
      id:            doc.id,
      name:          doc.name,
      title:         doc.name,
      document_type: doc.type,
      file_name:     doc.name,
      file_url:      blob.url,
      blobUrl:       blob.url,
      file_size:     file.size,
      mime_type:     file.type,
      version:       doc.version,
      uploaded_at:   doc.createdAt.toISOString(),
    },
  }, { status: 201 })
}
