import { z } from 'zod'
import { UserRole, UserStatus } from '@prisma/client'

/**
 * User-safe profile fields (what users can modify about themselves)
 */
export const UserSelfPatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  organization: z.string().max(200).optional(),
  jobTitle: z.string().max(100).optional(),
  bio: z.string().max(1000).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  avatarUrl: z.string().url().optional(),
  // Notification preferences
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
})

/**
 * Admin-only user fields (what admins can modify)
 * Regular users CANNOT change role, status, or other users' data
 */
export const AdminUserPatchSchema = UserSelfPatchSchema.extend({
  // Restricted fields - only admins can modify these
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  email: z.string().email().optional(),
  emailVerified: z.coerce.date().optional(),
  suspended: z.boolean().optional(),
  suspendedAt: z.coerce.date().optional(),
  suspendedById: z.string().optional(),
  suspensionReason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(), // Internal admin notes
})

/**
 * Get the appropriate schema based on context
 * @param userRole Current user's role
 * @param isSelf Whether user is modifying their own profile
 * @returns Appropriate Zod schema for validation
 */
export function getUserPatchSchema(userRole: UserRole, isSelf: boolean) {
  const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN]

  // Admins can modify any user with admin schema
  if (adminRoles.includes(userRole)) {
    return AdminUserPatchSchema
  }

  // Regular users can only modify their own profile with self schema
  if (isSelf) {
    return UserSelfPatchSchema
  }

  // Users cannot modify other users
  return null
}
