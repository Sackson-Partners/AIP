"use client"

/**
 * useRBAC-new — NextAuth version of the RBAC hook
 *
 * Matches the existing `useRBAC` API (can / role / isInternalUser / isSuperAdmin /
 * isAnalyst / etc.) so consumers can swap the import without changing call sites.
 *
 * Legacy permission name mapping is preserved — callers that pass old Supabase-era
 * string constants ("manage_users", "approve_projects" …) still work.
 */

import { useSession } from "next-auth/react"
import type { UserRole } from "@prisma/client"

// ── Canonical permission names ────────────────────────────────────────────────
export type Permission =
  | "view_projects"
  | "create_project"
  | "edit_project"
  | "delete_project"
  | "submit_project"
  | "approve_project"
  | "reject_project"
  | "publish_project"
  | "view_analytics"
  | "manage_users"
  | "manage_settings"
  | "view_audit_log"
  | "view_deal_room"
  | "create_deal_room"
  | "view_ein_reports"
  | "create_ein_report"
  | "run_petfel"
  | "view_watchlist"
  | "manage_watchlist"

// ── Per-role permission sets ──────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    "view_projects", "create_project", "edit_project", "delete_project",
    "submit_project", "approve_project", "reject_project", "publish_project",
    "view_analytics", "manage_users", "manage_settings", "view_audit_log",
    "view_deal_room", "create_deal_room", "view_ein_reports", "create_ein_report",
    "run_petfel", "view_watchlist", "manage_watchlist",
  ],
  ANALYST: [
    "view_projects", "edit_project", "submit_project", "approve_project",
    "reject_project", "publish_project", "view_analytics", "view_audit_log",
    "view_deal_room", "view_ein_reports", "create_ein_report", "run_petfel",
  ],
  GOVERNMENT: [
    "view_projects", "create_project", "edit_project", "submit_project",
    "view_deal_room", "view_watchlist", "manage_watchlist",
  ],
  SPONSOR_DEVELOPER: [
    "view_projects", "create_project", "edit_project", "submit_project",
    "view_deal_room", "create_deal_room", "view_watchlist", "manage_watchlist",
  ],
  EPC_OPERATOR: [
    "view_projects", "view_deal_room", "view_watchlist",
  ],
  INSTITUTIONAL_INVESTOR: [
    "view_projects", "view_analytics", "view_deal_room", "view_ein_reports",
    "view_watchlist", "manage_watchlist",
  ],
}

// ── Legacy alias map (Supabase-era names → canonical names) ──────────────────
const LEGACY_ALIASES: Record<string, Permission> = {
  manage_users:     "manage_users",
  approve_projects: "approve_project",
  reject_projects:  "reject_project",
  publish_projects: "publish_project",
  create_projects:  "create_project",
  edit_projects:    "edit_project",
  delete_projects:  "delete_project",
  view_deals:       "view_deal_room",
  create_deals:     "create_deal_room",
  view_reports:     "view_ein_reports",
  create_reports:   "create_ein_report",
}

function resolvePermission(perm: string): Permission {
  return (LEGACY_ALIASES[perm] ?? perm) as Permission
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useRBAC() {
  const { data: session, status } = useSession()

  const isLoading = status === "loading"
  const role = (session?.user?.role ?? null) as UserRole | null

  const permissions: Permission[] = role ? (ROLE_PERMISSIONS[role] ?? []) : []

  function can(permission: string): boolean {
    if (!role) return false
    const canonical = resolvePermission(permission)
    return permissions.includes(canonical)
  }

  function hasRole(...roles: string[]): boolean {
    if (!role) return false
    return roles.includes(role)
  }

  return {
    // State
    isLoading,
    role,
    permissions,

    // Checkers
    can,
    hasRole,

    // Convenience flags (mirror legacy useRBAC API)
    isSuperAdmin:          role === "SUPER_ADMIN",
    isAnalyst:             role === "ANALYST",
    isGovernment:          role === "GOVERNMENT",
    isSponsorDeveloper:    role === "SPONSOR_DEVELOPER",
    isEPCOperator:         role === "EPC_OPERATOR",
    isInstitutionalInvestor: role === "INSTITUTIONAL_INVESTOR",
    isInternalUser:        role === "SUPER_ADMIN" || role === "ANALYST",
    isExternalUser:        role !== null && role !== "SUPER_ADMIN" && role !== "ANALYST",
  }
}

export default useRBAC
