import { z } from 'zod'
import { UserRole, InvestorStatus, OrganizationType } from '@prisma/client'

/**
 * User-safe investor fields (what investor users can modify about their own profile)
 */
export const InvestorSelfPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(20).optional(),
  logoUrl: z.string().url().optional(),
  // Investment preferences
  sectorFocus: z.array(z.string()).optional(),
  countryFocus: z.array(z.string()).optional(),
  stageFocus: z.array(z.string()).optional(),
  minTicket: z.number().positive().optional(),
  maxTicket: z.number().positive().optional(),
  // Profile information
  teamSize: z.number().int().positive().optional(),
  aum: z.number().positive().optional(), // Assets under management
  yearsActive: z.number().int().positive().optional(),
})

/**
 * Admin-only investor fields
 */
export const AdminInvestorPatchSchema = InvestorSelfPatchSchema.extend({
  // Restricted fields - only admins can modify these
  status: z.nativeEnum(InvestorStatus).optional(),
  organizationType: z.nativeEnum(OrganizationType).optional(),
  verified: z.boolean().optional(),
  verifiedAt: z.coerce.date().optional(),
  verifiedById: z.string().optional(),
  countryOfOrigin: z.string().max(100).optional(),
  userId: z.string().optional(), // Link to user account
  notes: z.string().max(2000).optional(), // Internal admin notes
})

/**
 * Get the appropriate schema based on context
 * @param userRole Current user's role
 * @param isOwn Whether user is modifying their own investor profile
 * @returns Appropriate Zod schema for validation
 */
export function getInvestorPatchSchema(userRole: UserRole, isOwn: boolean) {
  const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]

  // Admins can modify any investor with admin schema
  if (adminRoles.includes(userRole)) {
    return AdminInvestorPatchSchema
  }

  // Investors can only modify their own profile
  if (isOwn) {
    return InvestorSelfPatchSchema
  }

  // Users cannot modify other investors
  return null
}
