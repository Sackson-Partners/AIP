import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { calculatePortfolioMetrics, getTopProjects, getInvestorMetrics } from '@/lib/portfolio-intelligence'
import { UserRole } from '@prisma/client'
import { getCached, setCached, CacheTTL } from '@/lib/redis'

const VIEWER_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ANALYST,
]

/**
 * GET /api/portfolio/metrics
 * Get comprehensive portfolio intelligence metrics
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only internal staff can view portfolio metrics
  if (!VIEWER_ROLES.includes(session.user.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Check cache first (cache for 15 minutes)
    const cacheKey = 'portfolio:metrics:dashboard'
    const cached = await getCached<any>(cacheKey)
    if (cached) {
      return NextResponse.json({ data: cached, cached: true })
    }

    // Calculate fresh metrics
    const [metrics, topProjects, investorMetrics] = await Promise.all([
      calculatePortfolioMetrics(),
      getTopProjects(),
      getInvestorMetrics(),
    ])

    const data = {
      ...metrics,
      topProjects,
      investorMetrics,
    }

    // Cache the results
    await setCached(cacheKey, data, CacheTTL.LONG) // 15 minutes

    return NextResponse.json({ data, cached: false })
  } catch (error) {
    console.error('[GET /api/portfolio/metrics] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
