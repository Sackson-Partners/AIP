import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { getCached, setCached, CacheTTL } from '@/lib/redis'
import { getProjectVisibilityFilter } from '@/lib/project-visibility'

/**
 * GET /api/search
 * Global search across projects, investors, users, and documents
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.trim()
    const type = searchParams.get('type') // projects, investors, users, all
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!query || query.length < 2) {
      return NextResponse.json({
        data: {
          projects: [],
          investors: [],
          users: [],
          totalResults: 0,
        },
      })
    }

    // Try cache first
    const cacheKey = `search:${type || 'all'}:${query}:${limit}`
    const cached = await getCached<any>(cacheKey)
    if (cached) {
      return NextResponse.json({ data: cached })
    }

    const searchQuery = query.toLowerCase()
    const shouldSearchAll = !type || type === 'all'

    // Parallel search across all entities
    const [projects, investors, users] = await Promise.all([
      // Search projects
      shouldSearchAll || type === 'projects'
        ? prisma.project.findMany({
            where: {
              OR: [
                { title: { contains: searchQuery, mode: 'insensitive' } },
                { description: { contains: searchQuery, mode: 'insensitive' } },
                { country: { contains: searchQuery, mode: 'insensitive' } },
                { region: { contains: searchQuery, mode: 'insensitive' } },
              ],
              ...getProjectVisibilityFilter(session.user.role),
            },
            select: {
              id: true,
              title: true,
              description: true,
              country: true,
              sector: true,
              totalCost: true,
              status: true,
              createdAt: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : [],

      // Search investors
      shouldSearchAll || type === 'investors'
        ? prisma.investor.findMany({
            where: {
              OR: [
                { name: { contains: searchQuery, mode: 'insensitive' } },
                { email: { contains: searchQuery, mode: 'insensitive' } },
                { type: { contains: searchQuery, mode: 'insensitive' } },
                { countryOfOrigin: { contains: searchQuery, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              name: true,
              email: true,
              type: true,
              countryOfOrigin: true,
              minTicket: true,
              maxTicket: true,
              createdAt: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
          })
        : [],

      // Search users (admin only)
      shouldSearchAll || type === 'users'
        ? ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)
          ? prisma.user.findMany({
              where: {
                OR: [
                  { name: { contains: searchQuery, mode: 'insensitive' } },
                  { email: { contains: searchQuery, mode: 'insensitive' } },
                  { organization: { contains: searchQuery, mode: 'insensitive' } },
                  { country: { contains: searchQuery, mode: 'insensitive' } },
                ],
              },
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                organization: true,
                country: true,
                status: true,
                createdAt: true,
              },
              take: limit,
              orderBy: { createdAt: 'desc' },
            })
          : []
        : [],
    ])

    const results = {
      projects: projects.map((p) => ({
        ...p,
        type: 'project' as const,
        link: `/dashboard/projects/${p.id}`,
      })),
      investors: investors.map((i) => ({
        ...i,
        type: 'investor' as const,
        link: `/dashboard/investors/${i.id}`,
      })),
      users: users.map((u) => ({
        ...u,
        type: 'user' as const,
        link: `/admin/users/${u.id}`,
      })),
      totalResults: projects.length + investors.length + users.length,
    }

    // Cache results for 5 minutes
    await setCached(cacheKey, results, CacheTTL.MEDIUM)

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('[GET /api/search] Error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
