import { z } from 'zod'
import { UserRole, ProjectStatus, ProjectSector, DealStage, ProjectType } from '@prisma/client'

/**
 * User-safe project fields (what regular users can modify)
 * Excludes restricted fields like status, reviewerId, publishedAt
 */
export const UserProjectPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  sector: z.nativeEnum(ProjectSector).optional(),
  dealStage: z.nativeEnum(DealStage).optional(),
  projectType: z.nativeEnum(ProjectType).optional(),
  totalCost: z.number().positive().optional(),
  equityRequired: z.number().nonnegative().optional(),
  debtRequired: z.number().nonnegative().optional(),
  grantRequired: z.number().nonnegative().optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  startDate: z.coerce.date().optional(),
  estimatedCompletionDate: z.coerce.date().optional(),
  // Financial fields (users can update these)
  irr: z.number().min(-100).max(100).optional(), // IRR typically -100% to 100%
  paybackPeriod: z.number().positive().optional(), // In years
  // ESG fields
  esgRating: z.string().max(10).optional(),
  carbonFootprint: z.number().nonnegative().optional(), // Tons of CO2
  jobsCreated: z.number().int().nonnegative().optional(),
  // Strategic notes
  strategicNotes: z.string().max(5000).optional(),
}).refine(
  (data) => {
    // Financial structure validation: equity + debt + grant <= totalCost
    if (!data.totalCost) return true

    const equity = data.equityRequired ?? 0
    const debt = data.debtRequired ?? 0
    const grant = data.grantRequired ?? 0
    const total = equity + debt + grant

    return total <= data.totalCost
  },
  {
    message: 'Total financing (equity + debt + grant) cannot exceed total cost',
    path: ['equityRequired'], // Error will be attached to equityRequired field
  }
).refine(
  (data) => {
    // Date validation: startDate must be before estimatedCompletionDate
    if (!data.startDate || !data.estimatedCompletionDate) return true
    return data.startDate < data.estimatedCompletionDate
  },
  {
    message: 'Start date must be before estimated completion date',
    path: ['estimatedCompletionDate'],
  }
)

/**
 * Admin-only project fields (what admins/super-admins can modify)
 * Includes all user fields PLUS restricted fields
 */
export const AdminProjectPatchSchema = UserProjectPatchSchema.extend({
  // Restricted fields - only admins can modify these
  status: z.nativeEnum(ProjectStatus).optional(),
  reviewerId: z.string().optional(),
  ownerId: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
  archived: z.boolean().optional(),
  archivedAt: z.coerce.date().optional(),
  archivedById: z.string().optional(),
  code: z.string().max(50).optional(),
  riskRating: z.string().max(50).optional(),
  // Admin can force verification status
  verificationStatus: z.string().optional(),
})

/**
 * Get the appropriate schema based on user role
 * @param role User's role from session
 * @returns Appropriate Zod schema for validation
 */
export function getProjectPatchSchema(role: UserRole) {
  const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN]
  return adminRoles.includes(role) ? AdminProjectPatchSchema : UserProjectPatchSchema
}

/**
 * Validate financial field constraints
 * Ensures equity + debt + grant <= totalCost
 *
 * @deprecated Use Zod schema refinement instead (built into UserProjectPatchSchema)
 * This function is kept for backward compatibility with existing code
 */
export function validateFinancialStructure(data: {
  totalCost?: number
  equityRequired?: number
  debtRequired?: number
  grantRequired?: number
}) {
  if (!data.totalCost) return { valid: true }

  const equity = data.equityRequired ?? 0
  const debt = data.debtRequired ?? 0
  const grant = data.grantRequired ?? 0
  const total = equity + debt + grant

  if (total > data.totalCost) {
    return {
      valid: false,
      error: `Total financing (${total.toFixed(2)}) exceeds total cost (${data.totalCost.toFixed(2)}). ` +
             `Breakdown: equity=${equity.toFixed(2)}, debt=${debt.toFixed(2)}, grant=${grant.toFixed(2)}`
    }
  }

  return { valid: true }
}

/**
 * Validate that all financial amounts are in reasonable ranges
 */
export function validateFinancialRanges(data: {
  totalCost?: number
  equityRequired?: number
  debtRequired?: number
  grantRequired?: number
  irr?: number
  paybackPeriod?: number
}) {
  const errors: string[] = []

  // Total cost validation (1 USD to 100 billion USD)
  if (data.totalCost !== undefined) {
    if (data.totalCost < 1) {
      errors.push('Total cost must be at least $1')
    }
    if (data.totalCost > 100_000_000_000) {
      errors.push('Total cost cannot exceed $100 billion')
    }
  }

  // Equity/Debt/Grant cannot be negative
  if (data.equityRequired !== undefined && data.equityRequired < 0) {
    errors.push('Equity required cannot be negative')
  }
  if (data.debtRequired !== undefined && data.debtRequired < 0) {
    errors.push('Debt required cannot be negative')
  }
  if (data.grantRequired !== undefined && data.grantRequired < 0) {
    errors.push('Grant required cannot be negative')
  }

  // IRR validation (-100% to 1000%)
  if (data.irr !== undefined) {
    if (data.irr < -100) {
      errors.push('IRR cannot be less than -100%')
    }
    if (data.irr > 1000) {
      errors.push('IRR cannot exceed 1000%')
    }
  }

  // Payback period validation (0 to 100 years)
  if (data.paybackPeriod !== undefined) {
    if (data.paybackPeriod <= 0) {
      errors.push('Payback period must be positive')
    }
    if (data.paybackPeriod > 100) {
      errors.push('Payback period cannot exceed 100 years')
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}
