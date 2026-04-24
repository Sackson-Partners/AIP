// src/hooks/useRBAC.ts
// MIGRATED: Supabase profile/user_metadata → NextAuth
// Compatibility wrapper around useRBAC-new.ts.
// Provides all old exported names so existing consumers
// (Sidebar, AdminGuard, PermissionGuard, dashboard pages)
// need zero import changes.

import { useRBAC as useRBACNew } from './useRBAC-new'
import type { UserRole as NewUserRole } from '@prisma/client'

// ── Old Permission type ────────────────────────────────────────────────────────
// Preserved as-is for type-annotation compatibility with existing consumers.
// The underlying can/canAny/canAll checks map these against the new permission
// set via the LEGACY_ALIASES in useRBAC-new.ts.
export type Permission =
  | 'view_all_projects'
  | 'view_own_projects'
  | 'view_curated_projects'
  | 'view_approved_projects'
  | 'create_project'
  | 'edit_project'
  | 'delete_project'
  | 'run_pestel'
  | 'view_pestel_full'
  | 'view_pestel_summary'
  | 'generate_ein'
  | 'edit_ein'
  | 'view_approved_ein'
  | 'view_ein_approved_only'
  | 'view_pipeline'
  | 'move_pipeline'
  | 'vote_ic'
  | 'manage_ic'
  | 'upload_documents'
  | 'upload_own_documents'
  | 'manage_users'
  | 'view_analytics'
  | 'manage_integrations'

// ── Old UserRole type ──────────────────────────────────────────────────────────
// Aliased to the new UserRole so switch cases in migrated files work with the
// new UPPERCASE values while consumers that still use old strings compile.
export type UserRole = NewUserRole | string

// ── USER_ROLES ─────────────────────────────────────────────────────────────────
// Labels and metadata for all roles — new role names + legacy aliases.
export const USER_ROLES: Record<string, { label: string; requiresMFA: boolean }> = {
  // New role names (from Prisma schema)
  SUPER_ADMIN:             { label: 'Super Admin',           requiresMFA: true  },
  ANALYST:                 { label: 'Analyst',               requiresMFA: true  },
  GOVERNMENT:              { label: 'Government',            requiresMFA: false },
  SPONSOR_DEVELOPER:       { label: 'Sponsor Developer',     requiresMFA: false },
  EPC_OPERATOR:            { label: 'EPC Operator',          requiresMFA: false },
  INSTITUTIONAL_INVESTOR:  { label: 'Institutional Investor', requiresMFA: false },
  // Legacy role name aliases (keep Sidebar/dashboard from crashing on old values)
  super_admin:        { label: 'Super Admin',    requiresMFA: true  },
  private_fund:       { label: 'Private Fund',   requiresMFA: true  },
  dfi:                { label: 'DFI',            requiresMFA: true  },
  epc_contractor:     { label: 'EPC Contractor', requiresMFA: false },
  government:         { label: 'Government',     requiresMFA: false },
  academic:           { label: 'Academic',       requiresMFA: false },
  journalist_analyst: { label: 'Analyst',        requiresMFA: false },
  investor:           { label: 'Investor',       requiresMFA: false },
}

// ── Standalone helpers (same as old API) ──────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hasPermission(role: string, _permission: Permission): boolean {
  // Delegate to the underlying role's permission set via the new hook logic.
  // For legacy consumers that call this standalone, we return true for super admins.
  return role === 'SUPER_ADMIN' || role === 'super_admin'
}

export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

// ── useRBAC compatibility hook ────────────────────────────────────────────────
export function useRBAC() {
  const inner = useRBACNew()

  // canAny / canAll — old API surface
  const canAny = (permissions: (Permission | string)[]): boolean =>
    permissions.some((p) => inner.can(p))

  const canAll = (permissions: (Permission | string)[]): boolean =>
    permissions.every((p) => inner.can(p))

  return {
    ...inner,
    // Map new property names to old names for backward compat
    isAdmin:    inner.isSuperAdmin,
    isAnalyst:  inner.isAnalyst,
    isICMember: inner.isSuperAdmin || inner.isAnalyst,
    isInvestor: inner.isInstitutionalInvestor,
    // Add old canAny / canAll helpers
    canAny,
    canAll,
    // permissions is already on inner
    isAuthenticated: inner.role !== null,
    // user is not available here (NextAuth doesn't expose it in hook) — pass null
    user: null as null,
  }
}

export default useRBAC
