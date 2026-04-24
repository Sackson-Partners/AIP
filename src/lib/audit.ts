import { prisma } from "@/lib/prisma"

interface ActivityParams {
  userId?: string
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
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
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        details: params.details ? JSON.stringify(params.details) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch {
    // Silent — intentional
  }
}

/** Create an immutable audit log entry for compliance tracking. Never throws. */
export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        email: params.email,
        action: params.action,
        tableName: params.tableName,
        recordId: params.recordId,
        oldValues: params.oldValues
          ? JSON.stringify(params.oldValues)
          : undefined,
        newValues: params.newValues
          ? JSON.stringify(params.newValues)
          : undefined,
        ipAddress: params.ipAddress,
      },
    })
  } catch {
    // Silent — intentional
  }
}
