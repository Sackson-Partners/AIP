import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/access-requests/stats
 * Get access request statistics (admin only)
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      recentRequests,
      requestsByRole,
    ] = await Promise.all([
      // Total requests
      prisma.accessRequest.count(),

      // Pending requests
      prisma.accessRequest.count({
        where: { status: 'PENDING' },
      }),

      // Approved requests
      prisma.accessRequest.count({
        where: { status: 'APPROVED' },
      }),

      // Rejected requests
      prisma.accessRequest.count({
        where: { status: 'REJECTED' },
      }),

      // Recent requests (last 7 days)
      prisma.accessRequest.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Requests by role
      prisma.accessRequest.groupBy({
        by: ['roleRequested'],
        _count: true,
        orderBy: {
          _count: {
            roleRequested: 'desc',
          },
        },
      }),
    ])

    // Average response time (time from creation to review)
    const reviewedRequests = await prisma.accessRequest.findMany({
      where: {
        reviewedAt: { not: null },
      },
      select: {
        createdAt: true,
        reviewedAt: true,
      },
      take: 100,
    })

    const avgResponseTime =
      reviewedRequests.length > 0
        ? reviewedRequests.reduce((sum, req) => {
            if (!req.reviewedAt) return sum
            return sum + (req.reviewedAt.getTime() - req.createdAt.getTime())
          }, 0) / reviewedRequests.length
        : 0

    const avgResponseHours = Math.round(avgResponseTime / (1000 * 60 * 60))

    return NextResponse.json({
      data: {
        total: totalRequests,
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        recent: recentRequests,
        avgResponseHours,
        byRole: requestsByRole.map((r) => ({
          role: r.roleRequested,
          count: r._count,
        })),
      },
    })
  } catch (error) {
    console.error('[GET /api/access-requests/stats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch access request stats' },
      { status: 500 }
    )
  }
}
