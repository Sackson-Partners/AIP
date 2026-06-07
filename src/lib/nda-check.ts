import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

// Internal staff bypass NDA requirement
const INTERNAL_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

/**
 * Check if user has signed NDA for a specific deal room
 */
export async function hasSignedNDA(userId: string, dealRoomId: string): Promise<boolean> {
  const member = await prisma.dealRoomMember.findFirst({
    where: {
      userId,
      dealRoomId,
    },
  })

  return member?.ndaSigned === true
}

/**
 * Check if user needs to sign NDA (external partners only)
 */
export function requiresNDA(userRole: string): boolean {
  return !INTERNAL_ROLES.includes(userRole as UserRole)
}

/**
 * Get user's NDA status for a deal room
 */
export async function getNDAStatus(userId: string, dealRoomId: string) {
  const member = await prisma.dealRoomMember.findFirst({
    where: {
      userId,
      dealRoomId,
    },
  })

  if (!member) {
    return {
      isMember: false,
      ndaSigned: false,
      ndaSignedAt: null,
    }
  }

  return {
    isMember: true,
    ndaSigned: member.ndaSigned,
    ndaSignedAt: member.ndaSignedAt,
    memberId: member.id,
  }
}

/**
 * Check if user can access deal room
 * - Internal staff: always allowed
 * - External partners: must be member AND have signed NDA
 */
export async function canAccessDealRoom(
  userId: string,
  userRole: string,
  dealRoomId: string
): Promise<{ allowed: boolean; reason?: string; memberId?: string }> {
  // Internal staff bypass
  if (INTERNAL_ROLES.includes(userRole as UserRole)) {
    return { allowed: true, reason: 'Internal staff' }
  }

  // Check if user is a member
  const member = await prisma.dealRoomMember.findFirst({
    where: { userId, dealRoomId },
  })

  if (!member) {
    return { allowed: false, reason: 'Not a member of this deal room' }
  }

  // Check NDA status
  if (!member.ndaSigned) {
    return {
      allowed: false,
      reason: 'NDA not signed',
      memberId: member.id,
    }
  }

  return { allowed: true, memberId: member.id }
}
