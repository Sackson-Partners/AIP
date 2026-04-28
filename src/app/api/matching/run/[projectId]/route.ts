import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Simple matching: find investor profiles that overlap on sector/stage
  const profiles = await prisma.investorProfile.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  const matches = profiles
    .map((profile) => {
      let score = 0
      const reasons: string[] = []

      if (profile.preferredSectors?.includes(project.sector ?? '')) {
        score += 40; reasons.push(`Sector match: ${project.sector}`)
      }
      if (profile.preferredStages?.includes(project.dealStage ?? '')) {
        score += 30; reasons.push(`Stage match: ${project.dealStage}`)
      }
      if (project.totalCost && profile.minTicket && profile.maxTicket) {
        if (project.totalCost >= profile.minTicket && project.totalCost <= profile.maxTicket) {
          score += 30; reasons.push('Ticket size fits')
        }
      }

      return { investor_id: profile.userId, investor_name: profile.user.name, score, reasons }
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return NextResponse.json({ data: { project_id: projectId, matches, run_at: new Date().toISOString() } })
}
