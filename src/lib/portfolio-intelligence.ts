import { prisma } from './prisma'

export interface PortfolioMetrics {
  totalProjects: number
  totalValue: number
  activeProjects: number
  averageProjectValue: number
  sectorDistribution: Array<{ sector: string; count: number; value: number }>
  countryDistribution: Array<{ country: string; count: number; value: number }>
  stageDistribution: Array<{ stage: string; count: number }>
  statusDistribution: Array<{ status: string; count: number }>
  riskProfile: {
    low: number
    medium: number
    high: number
  }
  monthlyActivity: Array<{ month: string; created: number; updated: number }>
}

/**
 * Calculate comprehensive portfolio metrics
 */
export async function calculatePortfolioMetrics(): Promise<PortfolioMetrics> {
  // Fetch all active projects
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      status: true,
      sector: true,
      country: true,
      dealStage: true,
      totalCost: true,
      riskRating: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const totalProjects = projects.length
  const totalValue = projects.reduce((sum, p) => sum + (p.totalCost || 0), 0)
  const activeProjects = projects.filter(
    p => p.status === 'ACTIVE' || p.status === 'UNDER_REVIEW' || p.status === 'APPROVED'
  ).length
  const averageProjectValue = totalProjects > 0 ? totalValue / totalProjects : 0

  // Sector distribution
  const sectorMap = new Map<string, { count: number; value: number }>()
  projects.forEach(p => {
    const sector = p.sector || 'OTHER'
    const existing = sectorMap.get(sector) || { count: 0, value: 0 }
    sectorMap.set(sector, {
      count: existing.count + 1,
      value: existing.value + (p.totalCost || 0),
    })
  })
  const sectorDistribution = Array.from(sectorMap.entries()).map(([sector, data]) => ({
    sector,
    count: data.count,
    value: data.value,
  })).sort((a, b) => b.value - a.value)

  // Country distribution
  const countryMap = new Map<string, { count: number; value: number }>()
  projects.forEach(p => {
    const country = p.country || 'Unknown'
    const existing = countryMap.get(country) || { count: 0, value: 0 }
    countryMap.set(country, {
      count: existing.count + 1,
      value: existing.value + (p.totalCost || 0),
    })
  })
  const countryDistribution = Array.from(countryMap.entries()).map(([country, data]) => ({
    country,
    count: data.count,
    value: data.value,
  })).sort((a, b) => b.value - a.value).slice(0, 10) // Top 10 countries

  // Stage distribution
  const stageMap = new Map<string, number>()
  projects.forEach(p => {
    const stage = p.dealStage || 'CONCEPT'
    stageMap.set(stage, (stageMap.get(stage) || 0) + 1)
  })
  const stageDistribution = Array.from(stageMap.entries()).map(([stage, count]) => ({
    stage,
    count,
  })).sort((a, b) => b.count - a.count)

  // Status distribution
  const statusMap = new Map<string, number>()
  projects.forEach(p => {
    const status = p.status
    statusMap.set(status, (statusMap.get(status) || 0) + 1)
  })
  const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }))

  // Risk profile
  const riskProfile = {
    low: projects.filter(p => p.riskRating?.toLowerCase().includes('low')).length,
    medium: projects.filter(p => p.riskRating?.toLowerCase().includes('medium')).length,
    high: projects.filter(p => p.riskRating?.toLowerCase().includes('high')).length,
  }

  // Monthly activity (last 12 months)
  const monthlyActivity: Array<{ month: string; created: number; updated: number }> = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

    const created = projects.filter(
      p => p.createdAt >= monthStart && p.createdAt <= monthEnd
    ).length

    const updated = projects.filter(
      p => p.updatedAt >= monthStart && p.updatedAt <= monthEnd &&
           p.createdAt < monthStart
    ).length

    monthlyActivity.push({
      month: monthStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      created,
      updated,
    })
  }

  return {
    totalProjects,
    totalValue,
    activeProjects,
    averageProjectValue,
    sectorDistribution,
    countryDistribution,
    stageDistribution,
    statusDistribution,
    riskProfile,
    monthlyActivity,
  }
}

/**
 * Get top performing projects by various metrics
 */
export async function getTopProjects() {
  const [highestValue, mostRecent, mostActive] = await Promise.all([
    // Highest value projects
    prisma.project.findMany({
      where: { totalCost: { not: null } },
      orderBy: { totalCost: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        code: true,
        totalCost: true,
        status: true,
        sector: true,
        country: true,
      },
    }),
    // Most recently created
    prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        code: true,
        createdAt: true,
        status: true,
        sector: true,
      },
    }),
    // Most activity (documents + events)
    prisma.project.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        code: true,
        status: true,
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        documents: {
          _count: 'desc',
        },
      },
    }),
  ])

  return {
    highestValue,
    mostRecent,
    mostActive,
  }
}

/**
 * Calculate investor engagement metrics
 */
export async function getInvestorMetrics() {
  const [totalInvestors, activeMatches, recentEOIs] = await Promise.all([
    prisma.investor.count(),
    prisma.partnerMatch.count({
      where: {
        matchScore: { gte: 50 },
      },
    }),
    prisma.expressionOfInterest.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    }),
  ])

  return {
    totalInvestors,
    activeMatches,
    recentEOIs,
  }
}
