import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { canAccessProject, logAccessDenied } from '@/lib/project-visibility'
import { canAccessDataRoom, requiresDataRoomNDA } from '@/lib/data-room-access'

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
  const projectAccess = await canAccessProject(session.user.id, session.user.role as string, projectId)

  if (!projectAccess.allowed) {
    logAccessDenied(
      session.user.email ?? 'unknown',
      session.user.role as string,
      'data-room',
      projectId,
      projectAccess.projectStatus || 'unknown'
    )
    return NextResponse.json({
      error: 'PROJECT_NOT_PUBLISHED',
      message: 'This data room is only available for published projects. External partners must wait for project publication.',
      projectStatus: projectAccess.projectStatus,
      requiresNDA: true,
    }, { status: 403 })
  }

  // Check NDA + access code for external partners
  const userRole = session.user.role as string
  if (requiresDataRoomNDA(userRole)) {
    const dataRoomAccess = await canAccessDataRoom(session.user.id, userRole, projectId)

    if (!dataRoomAccess.allowed) {
      logAccessDenied(
        session.user.email ?? 'unknown',
        userRole,
        'data-room-nda',
        projectId,
        dataRoomAccess.reason || 'unknown'
      )

      return NextResponse.json({
        error: dataRoomAccess.reason === 'NDA_REQUIRED' ? 'NDA_REQUIRED' : 'ACCESS_DENIED',
        message: dataRoomAccess.reason === 'NDA_REQUIRED'
          ? 'You must sign an NDA and receive an access code to view data room documents'
          : dataRoomAccess.reason || 'Access denied',
        requiresNDA: dataRoomAccess.requiresNDA,
        accessId: dataRoomAccess.accessId,
      }, { status: 403 })
    }
  }

  // Log access for auditing
  console.log(`[data-room] Access granted: ${session.user.email} → project ${projectId}`)


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
