import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import crypto from 'crypto'

// Internal staff bypass NDA + access code requirement
const INTERNAL_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

/**
 * Check if user has signed NDA and has valid access code for a data room
 */
export async function hasDataRoomAccess(userId: string, projectId: string): Promise<boolean> {
  const access = await prisma.dataRoomAccess.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  })

  return access?.ndaSigned === true && !!access.accessCode
}

/**
 * Check if user requires NDA + access code (external partners only)
 */
export function requiresDataRoomNDA(userRole: string): boolean {
  return !INTERNAL_ROLES.includes(userRole as UserRole)
}

/**
 * Get user's data room access status
 */
export async function getDataRoomAccessStatus(userId: string, projectId: string) {
  const access = await prisma.dataRoomAccess.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  })

  if (!access) {
    return {
      hasAccess: false,
      ndaSigned: false,
      accessCode: null,
      ndaSignedAt: null,
    }
  }

  return {
    hasAccess: access.ndaSigned && !!access.accessCode,
    ndaSigned: access.ndaSigned,
    accessCode: access.accessCode,
    ndaSignedAt: access.ndaSignedAt,
    accessId: access.id,
  }
}

/**
 * Check if user can access data room documents
 * - Internal staff: always allowed
 * - External partners: must have signed NDA AND have valid access code
 */
export async function canAccessDataRoom(
  userId: string,
  userRole: string,
  projectId: string
): Promise<{ allowed: boolean; reason?: string; accessId?: string; requiresNDA?: boolean }> {
  // Internal staff bypass
  if (INTERNAL_ROLES.includes(userRole as UserRole)) {
    return { allowed: true, reason: 'Internal staff' }
  }

  // Check if access record exists
  const access = await prisma.dataRoomAccess.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  })

  if (!access) {
    return {
      allowed: false,
      reason: 'No access granted. Please contact admin to request access.',
      requiresNDA: true,
    }
  }

  // Check NDA status
  if (!access.ndaSigned) {
    return {
      allowed: false,
      reason: 'NDA_REQUIRED',
      accessId: access.id,
      requiresNDA: true,
    }
  }

  // Check access code
  if (!access.accessCode) {
    return {
      allowed: false,
      reason: 'Access code not issued',
      accessId: access.id,
    }
  }

  // Check expiration
  if (access.expiresAt && access.expiresAt < new Date()) {
    return {
      allowed: false,
      reason: 'Access expired',
      accessId: access.id,
    }
  }

  return { allowed: true, accessId: access.id }
}

/**
 * Generate 6-digit access code
 */
export function generateAccessCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Grant data room access to a user
 */
export async function grantDataRoomAccess(
  projectId: string,
  userId: string,
  email: string,
  grantedBy?: string
) {
  return await prisma.dataRoomAccess.upsert({
    where: {
      projectId_userId: { projectId, userId },
    },
    create: {
      projectId,
      userId,
      email,
      grantedBy,
    },
    update: {
      grantedBy,
    },
  })
}

/**
 * Sign NDA and issue access code
 */
export async function signNDAAndIssueCode(accessId: string) {
  const accessCode = generateAccessCode()

  return await prisma.dataRoomAccess.update({
    where: { id: accessId },
    data: {
      ndaSigned: true,
      ndaSignedAt: new Date(),
      accessCode,
      codeIssuedAt: new Date(),
    },
  })
}
