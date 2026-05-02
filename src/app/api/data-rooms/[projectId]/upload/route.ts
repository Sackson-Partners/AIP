import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

type Ctx = { params: Promise<{ projectId: string }> }

const VALID_DOC_TYPES = [
  'FEASIBILITY_STUDY', 'ENVIRONMENTAL_IMPACT', 'FINANCIAL_MODEL',
  'LEGAL_AGREEMENT', 'TECHNICAL_SPECS', 'EIN_REPORT', 'PETFEL_REPORT',
  'COMPLIANCE_REPORT', 'OTHER',
]

export async function POST(req: NextRequest, { params }: Ctx) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

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

  const blob = await put(
    `data-rooms/${projectId}/${Date.now()}-${file.name}`,
    file,
    { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN },
  )

  const doc = await prisma.document.create({
    data: {
      name:           file.name,
      projectId,
      uploaderId:     session.user.id,
      type:           docType as never,
      mimeType:       file.type || null,
      size:           file.size,
      blobUrl:        blob.url,
      blobKey:        blob.pathname,
      isPublic:       false,
      isConfidential: false,
    },
  })

  return NextResponse.json({
    data: {
      id:          doc.id,
      name:        doc.name,
      blob_url:    blob.url,
      size:        file.size,
      type:        doc.type,
      uploaded_at: doc.createdAt.toISOString(),
    },
  }, { status: 201 })
}
