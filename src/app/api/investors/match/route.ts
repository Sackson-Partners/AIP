import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { scoreMatch, buildPartnerProfile, MatchResult } from '@/lib/matching'
import { generateMatchExplanation } from '@/lib/matching-ai'
import { getCached, setCached, CacheKeys, CacheTTL } from '@/lib/redis'

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
    logger.info(`[POST /api/investors/match] Starting match for investor ${investorId}`)

    // Check cache first
    const cacheKey = CacheKeys.investors.matches(investorId)
    const cached = await getCached<Array<MatchResult & { projectName: string }>>(cacheKey)
    if (cached) {
      logger.info(`[POST /api/investors/match] Cache HIT for investor ${investorId}`)
      return NextResponse.json({ data: cached })
    }

    const investor = await prisma.investor.findUnique({ where: { id: investorId } })
    if (!investor) {
      logger.warn(`[POST /api/investors/match] Investor ${investorId} not found`)
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
        riskRating:  true,
      },
    })

    logger.info(`[POST /api/investors/match] Loaded ${projects.length} projects for matching`)

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
          riskRating:  p.riskRating ?? null,
        }),
        projectName: p.title,
      }))
      .sort((a, b) => b.score - a.score)

    // Persist top matches (score >= 30) to PartnerMatch table with 24h cache
    const topMatches = results.filter(r => r.score >= 30)
    const now = new Date()
    const cachedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

    if (topMatches.length > 0) {
      // Generate AI explanations for top 10 matches only (to control API costs)
      const top10 = topMatches.slice(0, 10)
      const explanations: Record<string, string> = {}

      for (const match of top10) {
        const project = projects.find(p => p.id === match.projectId)!
        try {
          const explanation = await generateMatchExplanation({
            match,
            project: {
              id: project.id,
              title: project.title,
              sector: (project.sector as string | null) ?? null,
              country: project.country ?? null,
              dealStage: project.dealStage as string,
              totalCost: project.totalCost ?? null,
              projectType: project.projectType ?? null,
              riskRating: project.riskRating ?? null,
            },
            partner: {
              ...partner,
              name: investor.name || 'Investor',
            },
          })
          explanations[match.projectId] = explanation
        } catch (error) {
          logger.error(`[POST /api/investors/match] Failed to generate explanation for ${match.projectId}:`, error)
        }
      }

      // Upsert matches with explanations and cache expiry
      await Promise.allSettled(
        topMatches.map(r =>
          prisma.partnerMatch.upsert({
            where: { investorId_projectId: { investorId, projectId: r.projectId } },
            create: {
              investorId,
              projectId: r.projectId,
              matchScore: r.score,
              matchTier: r.matchTier,
              matchExplanation: explanations[r.projectId] || null,
              action: 'INTERESTED',
              createdBy: session.user.id,
              cachedUntil,
            },
            update: {
              matchScore: r.score,
              matchTier: r.matchTier,
              matchExplanation: explanations[r.projectId] || null,
              cachedUntil,
            },
          })
        )
      )
    }

    // Cache the results (15 minutes - matches don't change frequently)
    await setCached(cacheKey, results, CacheTTL.LONG)
    logger.info(`[POST /api/investors/match] Cached ${results.length} matches for investor ${investorId}`)

    return NextResponse.json({ data: results })
  } catch (error: unknown) {
    logger.error('[POST /api/investors/match]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
