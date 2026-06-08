import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { getRecordAuditLogs } from '@/lib/audit-log'

type Ctx = { params: Promise<{ tableName: string; recordId: string }> }

// GET - Fetch audit logs for a specific record
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tableName, recordId } = await params
  const session = await getServerSession(authOptions)

  // Only authenticated users can view audit logs
  // In a real app, you might want role-based filtering here
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can view all audit logs
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const logs = await getRecordAuditLogs(tableName, recordId)

    return NextResponse.json({
      data: logs,
      count: logs.length,
      tableName,
      recordId,
    })
  } catch (error) {
    console.error('[admin/audit-logs/record] Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
