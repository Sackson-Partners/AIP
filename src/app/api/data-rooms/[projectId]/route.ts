import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { canAccessDealRoom } from '@/lib/nda-check'
import { UserRole } from '@prisma/client'

type Ctx = { params: Promise<{ projectId: string }> }

const INTERNAL_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { id: true, title: true, country: true, sector: true, dealRooms: { select: { id: true, requireNda: true } } },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Check NDA requirement for external partners
  const userRole = session.user.role as string
  const isInternal = INTERNAL_ROLES.includes(userRole as UserRole)

  if (!isInternal && project.dealRooms.length > 0) {
    // Check if any deal room for this project requires NDA
    const requiresNDA = project.dealRooms.some(dr => dr.requireNda)

    if (requiresNDA) {
      // Check if user has signed NDA for at least one deal room of this project
      let hasAccess = false
      let memberId: string | undefined

      for (const dealRoom of project.dealRooms) {
        const access = await canAccessDealRoom(session.user.id, userRole, dealRoom.id)
        if (access.allowed) {
          hasAccess = true
          break
        }
        if (access.memberId) memberId = access.memberId
      }

      if (!hasAccess) {
        console.log(`[Data Room Access Denied] User: ${session.user.email}, Project: ${project.title}, Reason: NDA not signed`)
        return NextResponse.json({
          error: 'NDA_REQUIRED',
          message: 'You must sign an NDA to access this data room',
          requiresNDA: true,
          memberId,
        }, { status: 403 })
      }
    }
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
