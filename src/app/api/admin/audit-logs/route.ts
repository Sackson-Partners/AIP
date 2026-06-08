import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { getRecentAuditLogs, getAuditStats } from '@/lib/audit-log'

// GET - Fetch audit logs (admin only)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  // Only SUPER_ADMIN and ADMIN can view audit logs
  if (!session?.user?.id || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || undefined
  const userId = searchParams.get('userId') || undefined
  const tableName = searchParams.get('tableName') || undefined
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const stats = searchParams.get('stats') === 'true'

  try {
    if (stats) {
      // Return statistics
      const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined
      const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined

      const statistics = await getAuditStats(startDate, endDate)
      return NextResponse.json({ data: statistics })
    } else {
      // Return audit logs
      const logs = await getRecentAuditLogs(limit, {
        action,
        userId,
        tableName,
      })

      return NextResponse.json({
        data: logs,
        count: logs.length,
      })
    }
  } catch (error) {
    console.error('[admin/audit-logs] Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
