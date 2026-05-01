import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { scoreMatch, buildPartnerProfile, MatchResult } from '@/lib/matching'

/**
 * POST /api/investors/match
 * Body: { investorId: string }
 * Returns top matching projects scored by weighted algorithm.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { investorId?: string }
  try { body = await req.json() } catch { body = {} }

  const { investorId } = body
  if (!investorId) {
    return NextResponse.json({ error: 'investorId is required' }, { status: 422 })
  }

  try {
    const investor = await prisma.investor.findUnique({ where: { id: investorId } })
    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    const projects = await prisma.project.findMany({
      select: {
        id:          true,
        title:       true,
        sector:      true,
        country:     true,
        dealStage:   true,
        totalCost:   true,
        projectType: true,
      },
    })

    const partner = buildPartnerProfile({
      id:               investor.id,
      sectorFocus:      investor.sectorFocus,
      countryFocus:     investor.countryFocus,
      stageFocus:       investor.stageFocus,
      minTicket:        investor.minTicket,
      maxTicket:        investor.maxTicket,
      organizationType: investor.organizationType,
    })

    const results: Array<MatchResult & { projectName: string }> = projects
      .map(p => ({
        ...scoreMatch(partner, {
          id:          p.id,
          sector:      (p.sector as string | null) ?? null,
          country:     p.country ?? null,
          dealStage:   p.dealStage as string,
          totalCost:   p.totalCost ?? null,
          projectType: p.projectType ?? null,
        }),
        projectName: p.title,
      }))
      .sort((a, b) => b.score - a.score)

    return NextResponse.json({ data: results })
  } catch (error: unknown) {
    logger.error('[POST /api/investors/match]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
