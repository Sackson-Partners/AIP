import { prisma } from '@/lib/prisma'

/**
 * Audit log helper for tracking critical operations
 */

export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed_login'
  // User management
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.suspend'
  | 'user.activate'
  | 'user.password_reset'
  // Project management
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'project.status_change'
  | 'project.publish'
  | 'project.archive'
  | 'project.restore'
  // Data room access
  | 'data_room.access_granted'
  | 'data_room.access_revoked'
  | 'data_room.nda_signed'
  | 'data_room.code_issued'
  | 'data_room.access_attempt'
  | 'data_room.document_upload'
  | 'data_room.document_delete'
  | 'data_room.document_publish'
  | 'data_room.document_unpublish'
  // PESTEL & PIS
  | 'pestel.create'
  | 'pestel.update'
  | 'pestel.ai_augment'
  | 'pis.create'
  | 'pis.update'
  | 'pis.ai_generate'
  // Investor matching
  | 'investor.create'
  | 'investor.update'
  | 'investor.delete'
  | 'investor.match_run'
  // Admin actions
  | 'admin.settings_change'
  | 'admin.role_change'
  | 'admin.bulk_delete'
  | 'admin.access_request_submitted'
  | 'admin.access_request_approved'
  | 'admin.access_request_rejected'
  | 'admin.access_request_deleted'

export interface LogAuditParams {
  userId?: string
  email?: string
  action: AuditAction
  tableName?: string
  recordId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an audit event
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  const {
    userId,
    email,
    action,
    tableName,
    recordId,
    oldValues,
    newValues,
    ipAddress,
    metadata,
  } = params

  try {
    // Merge metadata into newValues if provided
    const enrichedNewValues = metadata
      ? { ...newValues, _metadata: metadata }
      : newValues

    await prisma.auditLog.create({
      data: {
        userId,
        email,
        action,
        tableName,
        recordId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: enrichedNewValues ? JSON.stringify(enrichedNewValues) : null,
        ipAddress,
      },
    })

    console.log(`[Audit] ${action} by ${email || userId || 'system'} on ${tableName}:${recordId || 'N/A'}`)
  } catch (error) {
    // CRITICAL: Never let audit logging break the main operation
    console.error('[Audit] Failed to log audit event:', error)
    console.error('[Audit] Event details:', { action, userId, email, tableName, recordId })
  }
}

/**
 * Extract IP address from Next.js request headers
 */
export function getIpAddress(headers: Headers): string | undefined {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined
  )
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(userId: string, limit = 100) {
  return await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Get audit logs for a specific record
 */
export async function getRecordAuditLogs(
  tableName: string,
  recordId: string,
  limit = 100
) {
  return await prisma.auditLog.findMany({
    where: { tableName, recordId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Get recent audit logs (admin view)
 */
export async function getRecentAuditLogs(
  limit = 100,
  filters?: {
    action?: string
    userId?: string
    tableName?: string
    startDate?: Date
    endDate?: Date
  }
) {
  const where = {
    ...(filters?.action && { action: filters.action }),
    ...(filters?.userId && { userId: filters.userId }),
    ...(filters?.tableName && { tableName: filters.tableName }),
    ...(filters?.startDate || filters?.endDate
      ? {
          createdAt: {
            ...(filters?.startDate && { gte: filters.startDate }),
            ...(filters?.endDate && { lte: filters.endDate }),
          },
        }
      : {}),
  }

  return await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Get audit stats (for admin dashboard)
 */
export async function getAuditStats(startDate?: Date, endDate?: Date) {
  const where = {
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  }

  const [total, byAction, byUser] = await Promise.all([
    // Total events
    prisma.auditLog.count({ where }),

    // Events by action type
    prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    }),

    // Events by user
    prisma.auditLog.groupBy({
      by: ['userId'],
      where: { ...where, userId: { not: null } },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
  ])

  return {
    total,
    byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
    byUser: byUser.map((u) => ({ userId: u.userId, count: u._count })),
  }
}
