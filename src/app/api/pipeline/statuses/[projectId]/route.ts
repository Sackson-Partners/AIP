import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { id: true, title: true, dealStage: true, status: true, updatedAt: true, expectedClose: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const daysSinceUpdate = Math.floor((Date.now() - project.updatedAt.getTime()) / 86_400_000)
  const slaStatus = daysSinceUpdate > 30 ? 'overdue' : daysSinceUpdate > 20 ? 'at_risk' : 'on_track'

  return NextResponse.json({
    id:            `status-${project.id}`,
    project_id:    project.id,
    project_name:  project.title,
    stage_id:      project.dealStage,
    stage_name:    project.dealStage,
    current_stage: project.dealStage,
    status:        project.status,
    entered_at:    project.updatedAt.toISOString(),
    days_in_stage: daysSinceUpdate,
    sla_status:    slaStatus,
    sla_remaining: Math.max(0, 30 - daysSinceUpdate),
    sla_days:      30,
  })
}
