import { prisma } from '@/lib/prisma'
import { deleteCached } from '@/lib/redis'

/**
 * Session Versioning Utilities
 *
 * Increment session version to immediately invalidate all active sessions
 * when security-relevant changes occur (password change, role change, suspension)
 */

/**
 * Increment session version for a user
 * This forces all active sessions to logout on next request
 */
export async function incrementSessionVersion(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    })

    // Clear cached session version to force fresh DB lookup
    const cacheKey = `session:version:${userId}`
    await deleteCached(cacheKey)

    console.log(`[Session] Incremented session version for user ${userId}`)
  } catch (error) {
    console.error(`[Session] Failed to increment session version for user ${userId}:`, error)
    throw error
  }
}

/**
 * Reset session version to 1 (useful for testing or admin reset)
 */
export async function resetSessionVersion(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: 1 },
    })

    // Clear cached session version
    const cacheKey = `session:version:${userId}`
    await deleteCached(cacheKey)

    console.log(`[Session] Reset session version for user ${userId}`)
  } catch (error) {
    console.error(`[Session] Failed to reset session version for user ${userId}:`, error)
    throw error
  }
}

/**
 * Get current session version for a user
 */
export async function getSessionVersion(userId: string): Promise<number | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sessionVersion: true },
    })
    return user?.sessionVersion ?? null
  } catch (error) {
    console.error(`[Session] Failed to get session version for user ${userId}:`, error)
    return null
  }
}

/**
 * Security events that should increment session version
 */
export enum SessionInvalidationReason {
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  SUSPENSION = 'SUSPENSION',
  SECURITY_INCIDENT = 'SECURITY_INCIDENT',
  ADMIN_FORCE_LOGOUT = 'ADMIN_FORCE_LOGOUT',
}

/**
 * Invalidate all sessions for a user with audit logging
 */
export async function invalidateAllSessions(
  userId: string,
  reason: SessionInvalidationReason,
  performedBy?: string
): Promise<void> {
  try {
    await incrementSessionVersion(userId)

    console.log(`[Session] Invalidated all sessions for user ${userId}. Reason: ${reason}${performedBy ? `, Performed by: ${performedBy}` : ''}`)

    // Optionally, you could log this to audit log
    // await createAuditLog({ ... })
  } catch (error) {
    console.error(`[Session] Failed to invalidate sessions for user ${userId}:`, error)
    throw error
  }
}
