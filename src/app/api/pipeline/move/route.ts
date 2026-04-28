import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import type { DealStage, ProjectStatus } from '@prisma/client'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { project_id, stage, status, notes } = body as {
    project_id?: string
    stage?: string
    status?: string
    notes?: string
  }

  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  if (!stage && !status) return NextResponse.json({ error: 'stage or status required' }, { status: 400 })

  const project = await prisma.project.findUnique({ where: { id: project_id } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const updates: { dealStage?: DealStage; status?: ProjectStatus } = {}
  if (stage)  updates.dealStage = stage as DealStage
  if (status) updates.status    = status as ProjectStatus

  const updated = await prisma.project.update({ where: { id: project_id }, data: updates })

  // Log the pipeline move
  await prisma.activityLog.create({
    data: {
      userId:      session.user.id,
      action:    'PIPELINE_MOVE',
      resource:  'project',
      resourceId: project_id,
      details:   notes ?? `Moved to ${stage ?? status}`,
    },
  }).catch(() => null) // non-fatal

  return NextResponse.json({
    data: {
      project_id,
      stage:      updated.dealStage,
      status:     updated.status,
      moved_at:   new Date().toISOString(),
      moved_by:   session.user.id,
      notes,
    },
  })
}
