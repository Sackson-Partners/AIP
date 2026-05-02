import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Group documents by projectId and pick up project metadata
  const projects = await prisma.project.findMany({
    select: {
      id:      true,
      title:   true,
      country: true,
      sector:  true,
      documents: {
        where:   { projectId: { not: null } },
        select:  { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const data = projects.map(p => ({
    projectId:     p.id,
    projectTitle:  p.title,
    projectCountry: p.country ?? null,
    projectSector:  p.sector  ?? null,
    documentCount:  p.documents.length,
    lastUploadAt:   p.documents[0]?.createdAt?.toISOString() ?? null,
  }))

  return NextResponse.json({ data })
}
