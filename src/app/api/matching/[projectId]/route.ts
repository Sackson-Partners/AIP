import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        sector: true,
        country: true,
        dealStage: true,
        totalCost: true,
        description: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get matching results (if they exist)
    const investors = await prisma.investor.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        sectorFocus: true,
        stageFocus: true,
        minTicket: true,
        maxTicket: true,
      },
      take: 50, // Limit for performance
    })

    // Simple matching algorithm
    const matches = investors
      .map((investor) => {
        let score = 0
        const reasons: string[] = []

        // Parse JSON arrays from database
        let sectorFocus: string[] = []
        let stageFocus: string[] = []

        try {
          sectorFocus = investor.sectorFocus
            ? (typeof investor.sectorFocus === 'string' ? JSON.parse(investor.sectorFocus) : investor.sectorFocus)
            : []
          stageFocus = investor.stageFocus
            ? (typeof investor.stageFocus === 'string' ? JSON.parse(investor.stageFocus) : investor.stageFocus)
            : []
        } catch (e) {
          console.error(`[Matching] Failed to parse investor ${investor.id} focus arrays:`, e)
        }

        // Sector match
        if (project.sector && sectorFocus.includes(project.sector)) {
          score += 40
          reasons.push(`Sector: ${project.sector}`)
        }

        // Stage match
        if (project.dealStage && stageFocus.includes(project.dealStage)) {
          score += 30
          reasons.push(`Stage: ${project.dealStage}`)
        }

        // Ticket size match
        if (project.totalCost && investor.minTicket && investor.maxTicket) {
          if (project.totalCost >= investor.minTicket && project.totalCost <= investor.maxTicket) {
            score += 30
            reasons.push('Ticket size fits')
          }
        }

        return {
          investorId: investor.id,
          investorName: investor.name,
          investorEmail: investor.email,
          investorType: investor.type,
          score,
          reasons,
        }
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)

    return NextResponse.json({
      data: {
        project,
        matches,
        totalMatches: matches.length,
      },
    })
  } catch (error) {
    console.error('[GET /api/matching/[projectId]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch matching data' },
      { status: 500 }
    )
  }
}
