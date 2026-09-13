import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * POST /api/cron/cleanup-logs
 * GDPR Data Retention: Delete logs older than 90 days
 *
 * Should be called by:
 * - Vercel Cron (configured in vercel.json)
 * - Inngest scheduled job
 * - Manual trigger by admin
 *
 * Authorization: CRON_SECRET from environment
 */
export async function POST(req: NextRequest) {
  // Verify this is called by legitimate cron (not public endpoint)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron cleanup attempt', {
      ip: req.headers.get('x-forwarded-for') ?? 'unknown',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 90) // 90 days ago

  try {
    logger.info('Starting GDPR data retention cleanup', {
      cutoffDate: cutoffDate.toISOString(),
    })

    // Delete old records in parallel
    const [deletedAuditLogs, deletedActivityLogs, deletedNotifications] = await Promise.all([
      // Audit logs older than 90 days (keep critical security events)
      prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          action: { notIn: ['GDPR_ERASURE', 'GDPR_DATA_EXPORT', 'SECURITY_BREACH'] }, // Keep GDPR/security logs longer
        },
      }),

      // Activity logs older than 90 days
      prisma.activityLog.deleteMany({
        where: { createdAt: { lt: cutoffDate } },
      }),

      // Expired idempotency records (already expired, just cleanup)
      // TODO: Uncomment after idempotency migration is applied
      // prisma.idempotencyRecord.deleteMany({
      //   where: { expiresAt: { lt: new Date() } },
      // }),

      // Old read notifications (keep unread forever, delete read after 90 days)
      prisma.notification.deleteMany({
        where: {
          read: true,
          createdAt: { lt: cutoffDate },
        },
      }),
    ])

    const result = {
      success: true,
      deleted: {
        auditLogs: deletedAuditLogs.count,
        activityLogs: deletedActivityLogs.count,
        idempotencyRecords: 0, // deletedIdempotency.count, // TODO: Enable after migration
        notifications: deletedNotifications?.count || 0,
        total: deletedAuditLogs.count + deletedActivityLogs.count + (deletedNotifications?.count || 0),
      },
      cutoffDate: cutoffDate.toISOString(),
      retentionDays: 90,
      timestamp: new Date().toISOString(),
    }

    logger.info('GDPR data retention cleanup completed', result)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Data retention cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/cleanup-logs
 * Health check for the cron job (no auth required)
 */
export async function GET() {
  const configured = !!process.env.CRON_SECRET

  return NextResponse.json({
    service: 'cleanup-logs-cron',
    configured,
    retentionDays: 90,
    schedule: 'Daily at 2:00 AM UTC',
    note: configured
      ? 'Cron job configured and ready'
      : 'CRON_SECRET not configured - job will not run',
  })
}
