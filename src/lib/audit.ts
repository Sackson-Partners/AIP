import { prisma } from '@/lib/prisma'

interface ActivityParams {
  userId?: string
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

// PII fields that should be redacted from audit metadata
const PII_FIELDS = [
  'password',
  'token',
  'secret',
  'ssn',
  'creditCard',
  'bankAccount',
  'passportNumber',
  'nationalId',
  'apiKey',
  'privateKey',
]

function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      const isPII = PII_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))
      return isPII ? [key, '[REDACTED]'] : [key, value]
    })
  )
}

interface AuditParams {
  userId?: string
  email?: string
  action: string
  tableName?: string
  recordId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
}

/** Log a user activity. Never throws — audit failures must not break user flows. */
export async function logActivity(params: ActivityParams): Promise<void> {
  try {
    // Sanitize PII from details before storing
    const sanitizedDetails = params.details ? sanitizeAuditMetadata(params.details) : undefined

    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        details: sanitizedDetails ? JSON.stringify(sanitizedDetails) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (error) {
    // NEVER silently fail audit logs - this is a compliance requirement
    // Log to multiple destinations to ensure at least one captures it
    const auditError = {
      message: 'CRITICAL: Activity log write failed',
      originalAction: params.action,
      originalUserId: params.userId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
    }

    // Always log to stderr so it appears in server logs
    console.error('[AUDIT-FAILURE]', JSON.stringify(auditError))

    // Send to Sentry if available
    try {
      if (typeof Sentry !== 'undefined') {
        // @ts-expect-error - Sentry may not be available
        Sentry.captureException(error, {
          level: 'error',
          tags: { component: 'audit-log', action: String(params.action) },
          extra: auditError,
        })
      }
    } catch {
      // Even Sentry reporting failed - already logged to stderr as last resort
      console.error('[AUDIT-FAILURE] Sentry report also failed')
    }
  }
}

/** Create an immutable audit log entry for compliance tracking. Never throws. */
export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    // Sanitize PII from old/new values before storing
    const sanitizedOldValues = params.oldValues ? sanitizeAuditMetadata(params.oldValues) : undefined
    const sanitizedNewValues = params.newValues ? sanitizeAuditMetadata(params.newValues) : undefined

    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        email: params.email,
        action: params.action,
        tableName: params.tableName,
        recordId: params.recordId,
        oldValues: sanitizedOldValues ? JSON.stringify(sanitizedOldValues) : undefined,
        newValues: sanitizedNewValues ? JSON.stringify(sanitizedNewValues) : undefined,
        ipAddress: params.ipAddress,
      },
    })
  } catch (error) {
    // NEVER silently fail audit logs - this is a compliance requirement
    const auditError = {
      message: 'CRITICAL: Audit log write failed',
      originalAction: params.action,
      originalUserId: params.userId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
    }

    // Always log to stderr so it appears in server logs
    console.error('[AUDIT-FAILURE]', JSON.stringify(auditError))

    // Send to Sentry if available
    try {
      if (typeof Sentry !== 'undefined') {
        // @ts-expect-error - Sentry may not be available
        Sentry.captureException(error, {
          level: 'error',
          tags: { component: 'audit-log', action: String(params.action) },
          extra: auditError,
        })
      }
    } catch {
      // Even Sentry reporting failed - already logged to stderr as last resort
      console.error('[AUDIT-FAILURE] Sentry report also failed')
    }
  }
}
