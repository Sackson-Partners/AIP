import { UserRole } from '@prisma/client'

/**
 * API Response Sanitization
 *
 * Removes sensitive fields from API responses based on user role and context.
 * Prevents information disclosure by ensuring users only see data they're authorized to view.
 */

// Fields that should NEVER be exposed in any API response
const ALWAYS_HIDDEN_FIELDS = [
  'passwordHash',
  'twoFactorSecret',
  'resetToken',
  'resetTokenExpiry',
  'verificationToken',
  'apiKey',
  'secretKey',
  'privateKey',
]

// User fields visible to different roles
const USER_FIELD_VISIBILITY = {
  // Fields visible to the user themselves
  self: [
    'id', 'email', 'name', 'firstName', 'lastName', 'image', 'phone',
    'jobTitle', 'organization', 'country', 'timezone', 'role', 'status',
    'emailNotifications', 'dashboardLayout', 'createdAt', 'lastLoginAt',
    'loginCount', 'twoFactorEnabled', 'mustChangePass',
  ],

  // Fields visible to admins viewing other users
  admin: [
    'id', 'email', 'name', 'firstName', 'lastName', 'image', 'phone',
    'jobTitle', 'organization', 'country', 'timezone', 'role', 'status',
    'authProvider', 'createdAt', 'updatedAt', 'lastLoginAt', 'lastLoginIp',
    'loginCount', 'failedLoginAttempts', 'lockedUntil', 'emailVerified',
    'twoFactorEnabled', 'mustChangePass', 'createdBy', 'sessionVersion',
  ],

  // Fields visible to regular users viewing other users (public profile)
  public: [
    'id', 'name', 'firstName', 'lastName', 'image', 'jobTitle', 'organization',
  ],
}

// Project fields visible to different roles
const PROJECT_FIELD_VISIBILITY = {
  // Internal users (staff) see all fields
  internal: 'all' as const,

  // External partners only see published project fields
  external: [
    'id', 'code', 'title', 'description', 'country', 'region', 'sector',
    'projectType', 'dealStage', 'totalCost', 'equityRequired', 'debtRequired',
    'location', 'latitude', 'longitude', 'startDate', 'estimatedCompletionDate',
    'irr', 'paybackPeriod', 'esgRating', 'carbonFootprint', 'jobsCreated',
    'riskRating', 'createdAt', 'updatedAt',
  ],
}

// Investor fields - sensitive financial data requires permission
const INVESTOR_FIELD_VISIBILITY = {
  // Own investor profile
  own: 'all' as const,

  // Admins/analysts see most fields
  internal: [
    'id', 'name', 'email', 'phone', 'type', 'status', 'organizationType',
    'countryOfOrigin', 'sectorFocus', 'countryFocus', 'stageFocus',
    'instruments', 'minTicket', 'maxTicket', 'aum', 'targetIRR',
    'esgConstraints', 'description', 'website', 'verified', 'verifiedAt',
    'profileComplete', 'createdAt', 'updatedAt',
  ],

  // External users see limited public info
  external: [
    'id', 'name', 'organizationType', 'countryOfOrigin', 'sectorFocus',
    'countryFocus', 'stageFocus', 'description', 'website',
  ],
}

/**
 * Sanitize user object based on viewer role and context
 */
export function sanitizeUser(
  user: Record<string, any>,
  viewerRole: UserRole,
  isSelf: boolean
): Record<string, any> {
  // Always remove sensitive fields first
  const cleaned = removeFields(user, ALWAYS_HIDDEN_FIELDS)

  // Determine which fields to include
  let allowedFields: string[]

  if (isSelf) {
    allowedFields = USER_FIELD_VISIBILITY.self
  } else if (isInternalRole(viewerRole)) {
    allowedFields = USER_FIELD_VISIBILITY.admin
  } else {
    allowedFields = USER_FIELD_VISIBILITY.public
  }

  return pickFields(cleaned, allowedFields)
}

/**
 * Sanitize project object based on viewer role
 */
export function sanitizeProject(
  project: Record<string, any>,
  viewerRole: UserRole
): Record<string, any> {
  const cleaned = removeFields(project, ALWAYS_HIDDEN_FIELDS)

  if (isInternalRole(viewerRole)) {
    // Internal users see all fields except always-hidden
    return cleaned
  }

  // External users only see published project fields
  return pickFields(cleaned, PROJECT_FIELD_VISIBILITY.external)
}

/**
 * Sanitize investor object based on viewer role and ownership
 */
export function sanitizeInvestor(
  investor: Record<string, any>,
  viewerRole: UserRole,
  isOwn: boolean
): Record<string, any> {
  const cleaned = removeFields(investor, ALWAYS_HIDDEN_FIELDS)

  if (isOwn) {
    // Own profile - see everything
    return cleaned
  }

  if (isInternalRole(viewerRole)) {
    // Internal staff see most fields
    return pickFields(cleaned, INVESTOR_FIELD_VISIBILITY.internal)
  }

  // External users see limited public info
  return pickFields(cleaned, INVESTOR_FIELD_VISIBILITY.external)
}

/**
 * Sanitize array of objects
 */
export function sanitizeList<T extends Record<string, any>>(
  items: T[],
  sanitizer: (item: T) => Record<string, any>
): Record<string, any>[] {
  return items.map(item => sanitizer(item))
}

/**
 * Remove specified fields from object
 */
function removeFields(
  obj: Record<string, any>,
  fieldsToRemove: string[]
): Record<string, any> {
  const result = { ...obj }

  for (const field of fieldsToRemove) {
    delete result[field]
  }

  return result
}

/**
 * Pick only specified fields from object
 */
function pickFields(
  obj: Record<string, any>,
  fieldsToPick: string[]
): Record<string, any> {
  const result: Record<string, any> = {}

  for (const field of fieldsToPick) {
    if (field in obj) {
      result[field] = obj[field]
    }
  }

  return result
}

/**
 * Check if role is internal (staff)
 */
function isInternalRole(role: UserRole): boolean {
  return [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST].includes(role)
}

/**
 * Sanitize nested relations in an object
 */
export function sanitizeNested(
  obj: Record<string, any>,
  viewerRole: UserRole,
  config: {
    userFields?: string[]  // Field names that contain User objects
    projectFields?: string[]  // Field names that contain Project objects
    investorFields?: string[]  // Field names that contain Investor objects
  }
): Record<string, any> {
  const result = { ...obj }

  // Sanitize user relations
  if (config.userFields) {
    for (const field of config.userFields) {
      if (result[field]) {
        result[field] = sanitizeUser(result[field], viewerRole, false)
      }
    }
  }

  // Sanitize project relations
  if (config.projectFields) {
    for (const field of config.projectFields) {
      if (result[field]) {
        result[field] = sanitizeProject(result[field], viewerRole)
      }
    }
  }

  // Sanitize investor relations
  if (config.investorFields) {
    for (const field of config.investorFields) {
      if (result[field]) {
        result[field] = sanitizeInvestor(result[field], viewerRole, false)
      }
    }
  }

  return result
}

/**
 * Sanitize API response wrapper
 * Handles both single objects and arrays
 */
export function sanitizeResponse<T extends Record<string, any>>(
  data: T | T[],
  type: 'user' | 'project' | 'investor',
  viewerRole: UserRole,
  context?: {
    isSelf?: boolean
    isOwn?: boolean
  }
): any {
  const isSelf = context?.isSelf ?? false
  const isOwn = context?.isOwn ?? false

  if (Array.isArray(data)) {
    return data.map(item => sanitizeSingle(item, type, viewerRole, isSelf, isOwn))
  }

  return sanitizeSingle(data, type, viewerRole, isSelf, isOwn)
}

function sanitizeSingle(
  item: Record<string, any>,
  type: 'user' | 'project' | 'investor',
  viewerRole: UserRole,
  isSelf: boolean,
  isOwn: boolean
): Record<string, any> {
  switch (type) {
    case 'user':
      return sanitizeUser(item, viewerRole, isSelf)
    case 'project':
      return sanitizeProject(item, viewerRole)
    case 'investor':
      return sanitizeInvestor(item, viewerRole, isOwn)
    default:
      return removeFields(item, ALWAYS_HIDDEN_FIELDS)
  }
}
