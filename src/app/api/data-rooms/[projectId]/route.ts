import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { canAccessProject, logAccessDenied } from '@/lib/project-visibility'

type Ctx = { params: Promise<{ projectId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { id: true, title: true, country: true, sector: true, status: true },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Check project visibility (DRAFT vs PUBLISHED)
  const access = await canAccessProject(session.user.id, session.user.role as string, projectId)

  if (!access.allowed) {
    logAccessDenied(
      session.user.email ?? 'unknown',
      session.user.role as string,
      'data-room',
      projectId,
      access.projectStatus || 'unknown'
    )
    return NextResponse.json({
      error: 'PROJECT_NOT_PUBLISHED',
      message: 'This data room is only available for published projects',
      projectStatus: access.projectStatus,
    }, { status: 403 })
  }

  const documents = await prisma.document.findMany({
    where:   { projectId },
    include: { uploader: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Group documents by type (each DocumentType becomes a "folder")
  const byType: Record<string, typeof documents> = {}
  for (const doc of documents) {
    const key = doc.type as string
    if (!byType[key]) byType[key] = []
    byType[key].push(doc)
  }

  const folders = Object.entries(byType).map(([type, docs]) => ({
    type,
    documents: docs.map(d => ({
      id:            d.id,
      name:          d.name,
      type:          d.type,
      mime_type:     d.mimeType,
      size:          d.size,
      blob_url:      d.blobUrl,
      version:       d.version,
      is_confidential: d.isConfidential,
      uploaded_at:   d.createdAt.toISOString(),
      uploader_name: d.uploader.name ?? d.uploader.email ?? 'Unknown',
    })),
  }))

  return NextResponse.json({
    data: {
      project: {
        id:      project.id,
        title:   project.title,
        country: project.country,
        sector:  project.sector,
      },
      folders,
    },
  })
}
