import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, dealStage: true, status: true,
      updatedAt: true, expectedClose: true,
    },
  })

  const data = projects.map(p => {
    const daysSinceUpdate = Math.floor((Date.now() - p.updatedAt.getTime()) / 86_400_000)
    // Simple SLA: projects older than 30 days at same stage are flagged
    const slaStatus = daysSinceUpdate > 30 ? 'overdue' : daysSinceUpdate > 20 ? 'at_risk' : 'on_track'
    return {
      id:            `status-${p.id}`,
      project_id:    p.id,
      project_name:  p.title,
      stage_id:      p.dealStage,
      stage_name:    p.dealStage,
      current_stage: p.dealStage,
      status:        p.status,
      entered_at:    p.updatedAt.toISOString(),
      days_in_stage: daysSinceUpdate,
      sla_status:    slaStatus,
      sla_remaining: Math.max(0, 30 - daysSinceUpdate),
      sla_days:      30,
    }
  })

  return NextResponse.json({ data })
}
