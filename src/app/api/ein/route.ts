import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { filterByProjectVisibility } from '@/lib/project-visibility'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reports = await prisma.eINReport.findMany({
    include: { project: { select: { id: true, title: true, code: true, status: true } } },
    orderBy: { createdAt: 'desc' }
  })

  // Filter by project visibility
  const filtered = await filterByProjectVisibility(reports, session.user.role as string)

  return NextResponse.json({ data: filtered })
}

export async function POST() {
  return NextResponse.json({ error: 'Use POST /api/ein/generate/[projectId]' }, { status: 400 })
}
