import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/monitoring
 * System monitoring dashboard data (admin only)
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)

  // Only admins can view monitoring data
  if (!session?.user?.id || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Get stats from last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers,
      totalProjects,
      recentProjects,
      recentAuditLogs,
      errorCount,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Active users (logged in last 7 days)
      prisma.activityLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _count: true,
      }),

      // Total projects
      prisma.project.count(),

      // Projects created in last 24h
      prisma.project.count({
        where: { createdAt: { gte: last24h } },
      }),

      // Recent audit events
      prisma.auditLog.count({
        where: { createdAt: { gte: last24h } },
      }),

      // Error-like audit actions (approximation)
      prisma.auditLog.count({
        where: {
          createdAt: { gte: last24h },
          action: { contains: 'error' },
        },
      }),
    ])

    // Get top actions in last 24h
    const topActions = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: last24h } },
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    })

    // Get system stats
    const stats = {
      timestamp: new Date().toISOString(),
      period: '24h',
      users: {
        total: totalUsers,
        active: activeUsers.length,
      },
      projects: {
        total: totalProjects,
        recent: recentProjects,
      },
      activity: {
        auditLogs: recentAuditLogs,
        errors: errorCount,
      },
      topActions: topActions.map((a) => ({
        action: a.action,
        count: a._count,
      })),
    }

    return NextResponse.json({ data: stats })
  } catch (error) {
    console.error('[admin/monitoring] Error fetching monitoring data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    )
  }
}
