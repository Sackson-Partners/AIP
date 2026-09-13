import { ProjectStatus, UserRole } from '@prisma/client'

/**
 * Project State Machine
 * Enforces valid status transitions and role-based permissions
 */

// Define valid transitions from each status
const STATE_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  // Draft can be submitted for review
  DRAFT: [ProjectStatus.SUBMITTED, ProjectStatus.DRAFT],

  // Submitted projects go under review
  SUBMITTED: [ProjectStatus.UNDER_REVIEW, ProjectStatus.DRAFT],

  // Under review can be approved or rejected
  UNDER_REVIEW: [ProjectStatus.APPROVED, ProjectStatus.REJECTED, ProjectStatus.UNDER_REVIEW],

  // Approved projects can be activated (published)
  APPROVED: [ProjectStatus.ACTIVE, ProjectStatus.UNDER_REVIEW],

  // Rejected projects can be revised and resubmitted
  REJECTED: [ProjectStatus.DRAFT],

  // Active projects can progress through lifecycle
  ACTIVE: [ProjectStatus.FUNDED, ProjectStatus.ON_HOLD, ProjectStatus.CLOSED],

  // Funded projects can be put on hold or closed
  FUNDED: [ProjectStatus.ON_HOLD, ProjectStatus.CLOSED],

  // On hold projects can be reactivated or closed
  ON_HOLD: [ProjectStatus.ACTIVE, ProjectStatus.CLOSED],

  // Closed is terminal (can reopen to active if needed)
  CLOSED: [ProjectStatus.ACTIVE],
}

// Roles that can perform each transition
const TRANSITION_PERMISSIONS: Record<string, UserRole[]> = {
  // Owner/analyst can submit for review
  'DRAFT->SUBMITTED': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST],

  // Can return to draft for edits
  'SUBMITTED->DRAFT': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST],
  'UNDER_REVIEW->DRAFT': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Admins move to review
  'SUBMITTED->UNDER_REVIEW': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Only admins can approve/reject
  'UNDER_REVIEW->APPROVED': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'UNDER_REVIEW->REJECTED': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Admins can reopen rejected for revision
  'REJECTED->DRAFT': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Publishing requires admin approval
  'APPROVED->ACTIVE': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Admins can unpublish if needed
  'APPROVED->UNDER_REVIEW': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Lifecycle transitions (admins + analysts)
  'ACTIVE->FUNDED': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST],
  'ACTIVE->ON_HOLD': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST],
  'ACTIVE->CLOSED': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  'FUNDED->ON_HOLD': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  'FUNDED->CLOSED': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  'ON_HOLD->ACTIVE': [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST],
  'ON_HOLD->CLOSED': [UserRole.SUPER_ADMIN, UserRole.ADMIN],

  // Reopening closed projects requires admin
  'CLOSED->ACTIVE': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  from: ProjectStatus,
  to: ProjectStatus
): boolean {
  // Same status is always valid (no change)
  if (from === to) return true

  const allowedTransitions = STATE_TRANSITIONS[from] || []
  return allowedTransitions.includes(to)
}

/**
 * Check if a user has permission to perform a status transition
 */
export function canUserTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  userRole: UserRole
): boolean {
  // Same status requires no permission
  if (from === to) return true

  const transitionKey = `${from}->${to}`
  const allowedRoles = TRANSITION_PERMISSIONS[transitionKey] || []

  return allowedRoles.includes(userRole)
}

/**
 * Validate a status transition and return error if invalid
 */
export function validateTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  userRole: UserRole
): { valid: boolean; error?: string } {
  // Check if transition is valid
  if (!isValidTransition(from, to)) {
    return {
      valid: false,
      error: `Invalid status transition: ${from} → ${to}. Allowed transitions from ${from}: ${STATE_TRANSITIONS[from]?.join(', ') || 'none'}`,
    }
  }

  // Check if user has permission
  if (!canUserTransition(from, to, userRole)) {
    const transitionKey = `${from}->${to}`
    const allowedRoles = TRANSITION_PERMISSIONS[transitionKey] || []
    return {
      valid: false,
      error: `Insufficient permissions: ${userRole} cannot perform ${from} → ${to}. Required roles: ${allowedRoles.join(', ')}`,
    }
  }

  return { valid: true }
}

/**
 * Get all valid next states for a given status
 */
export function getNextStates(
  currentStatus: ProjectStatus,
  userRole?: UserRole
): ProjectStatus[] {
  const allTransitions = STATE_TRANSITIONS[currentStatus] || []

  // If no role specified, return all valid transitions
  if (!userRole) return allTransitions

  // Filter by user permissions
  return allTransitions.filter(nextStatus =>
    canUserTransition(currentStatus, nextStatus, userRole)
  )
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted for Review',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    ACTIVE: 'Active (Published)',
    FUNDED: 'Funded',
    ON_HOLD: 'On Hold',
    CLOSED: 'Closed',
  }
  return labels[status] || status
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    DRAFT: 'gray',
    SUBMITTED: 'blue',
    UNDER_REVIEW: 'yellow',
    APPROVED: 'green',
    REJECTED: 'red',
    ACTIVE: 'green',
    FUNDED: 'purple',
    ON_HOLD: 'orange',
    CLOSED: 'gray',
  }
  return colors[status] || 'gray'
}

/**
 * Check if status is published (visible to external partners)
 */
export function isPublishedStatus(status: ProjectStatus): boolean {
  return [ProjectStatus.ACTIVE, ProjectStatus.FUNDED, ProjectStatus.CLOSED].includes(status)
}

/**
 * Check if status is terminal (end of lifecycle)
 */
export function isTerminalStatus(status: ProjectStatus): boolean {
  return [ProjectStatus.CLOSED, ProjectStatus.REJECTED].includes(status)
}

/**
 * Get workflow stage for a status
 */
export function getWorkflowStage(status: ProjectStatus): 'draft' | 'review' | 'published' | 'completed' {
  if ([ProjectStatus.DRAFT].includes(status)) return 'draft'
  if ([ProjectStatus.SUBMITTED, ProjectStatus.UNDER_REVIEW, ProjectStatus.APPROVED].includes(status)) return 'review'
  if ([ProjectStatus.ACTIVE, ProjectStatus.FUNDED, ProjectStatus.ON_HOLD].includes(status)) return 'published'
  return 'completed'
}
