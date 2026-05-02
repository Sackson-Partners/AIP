"use client"

/**
 * useRBAC-new — NextAuth RBAC hook
 *
 * Permission matrix (aligned to product roadmap RBAC-001):
 *
 * Feature           SUPER_ADMIN  ANALYST  EPC_OPERATOR  GOVERNMENT  SPONSOR_DEV  INST_INVESTOR
 * Verification      Full         Full     View          View        View         View
 * Events            Full         C/E      View          View        View         View
 * Analytics         Full         Full     View          View        View         View
 * Partners Match    Full         View     View/Apply    View/Apply  View         View/Apply
 * Data Room         Full         Full     Upload/View   Upload/View View         View/Upload
 * EIN Notes         Full         Full     View          View        View/Comment View/Comment
 * Deal Room         Full         Manage   View/Request  View        Full         Full
 * Analytic Reports  Full         C/E      View          View        View         View
 * Messenger         Full         Full     P+I           G+I         P+I          P+I
 */

import { useSession } from "next-auth/react"
import type { UserRole } from "@prisma/client"

// ── Canonical permission names ────────────────────────────────────────────────
export type Permission =
  // Projects
  | "view_projects"
  | "create_project"
  | "edit_project"
  | "delete_project"
  | "submit_project"
  | "approve_project"
  | "reject_project"
  | "publish_project"
  // Verifications
  | "view_verifications"
  | "manage_verifications"
  // Events
  | "view_events"
  | "create_event"
  | "edit_event"
  | "delete_event"
  // Analytics & Reports
  | "view_analytics"
  | "view_analytic_reports"
  | "create_analytic_report"
  | "edit_analytic_report"
  // Partners / Investors Matching
  | "view_partners"
  | "manage_partners"
  | "apply_partner_match"
  // Data Room
  | "view_data_room"
  | "upload_to_data_room"
  | "manage_data_room"
  | "manage_data_room_access"
  // EIN Notes
  | "view_ein_reports"
  | "create_ein_report"
  | "comment_ein"
  | "approve_ein"
  // Deal Room
  | "view_deal_room"
  | "request_deal_room_access"
  | "create_deal_room"
  | "manage_deal_rooms"
  | "participate_deal_room"
  // Messenger
  | "message_all"
  | "message_partners_internal"
  | "message_gov_internal"
  // Admin
  | "manage_users"
  | "manage_settings"
  | "view_audit_log"
  | "manage_integrations"
  // IC / Pipeline
  | "view_pipeline"
  | "move_pipeline"
  | "vote_ic"
  | "manage_ic"
  // Watchlist
  | "view_watchlist"
  | "manage_watchlist"
  // PETFEL
  | "run_petfel"
  // PIS
  | "create_pis_report"
  | "view_pis_reports"

// ── Per-role permission sets ──────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    // Projects
    "view_projects", "create_project", "edit_project", "delete_project",
    "submit_project", "approve_project", "reject_project", "publish_project",
    // Verifications
    "view_verifications", "manage_verifications",
    // Events
    "view_events", "create_event", "edit_event", "delete_event",
    // Analytics
    "view_analytics", "view_analytic_reports", "create_analytic_report", "edit_analytic_report",
    // Partners
    "view_partners", "manage_partners", "apply_partner_match",
    // Data Room
    "view_data_room", "upload_to_data_room", "manage_data_room", "manage_data_room_access",
    // EIN
    "view_ein_reports", "create_ein_report", "comment_ein", "approve_ein",
    // Deal Room
    "view_deal_room", "create_deal_room", "manage_deal_rooms", "participate_deal_room", "request_deal_room_access",
    // Messenger
    "message_all", "message_partners_internal", "message_gov_internal",
    // Admin
    "manage_users", "manage_settings", "view_audit_log", "manage_integrations",
    // IC / Pipeline
    "view_pipeline", "move_pipeline", "vote_ic", "manage_ic",
    // Watchlist
    "view_watchlist", "manage_watchlist",
    // PETFEL
    "run_petfel",
    // PIS
    "create_pis_report", "view_pis_reports",
  ],

  ADMIN: [
    // Same as SUPER_ADMIN
    "view_projects", "create_project", "edit_project", "delete_project",
    "submit_project", "approve_project", "reject_project", "publish_project",
    "view_verifications", "manage_verifications",
    "view_events", "create_event", "edit_event", "delete_event",
    "view_analytics", "view_analytic_reports", "create_analytic_report", "edit_analytic_report",
    "view_partners", "manage_partners", "apply_partner_match",
    "view_data_room", "upload_to_data_room", "manage_data_room", "manage_data_room_access",
    "view_ein_reports", "create_ein_report", "comment_ein", "approve_ein",
    "view_deal_room", "create_deal_room", "manage_deal_rooms", "participate_deal_room", "request_deal_room_access",
    "message_all", "message_partners_internal", "message_gov_internal",
    "manage_users", "manage_settings", "view_audit_log", "manage_integrations",
    "view_pipeline", "move_pipeline", "vote_ic", "manage_ic",
    "view_watchlist", "manage_watchlist",
    "run_petfel",
    // PIS
    "create_pis_report", "view_pis_reports",
  ],

  ANALYST: [
    // Projects
    "view_projects", "create_project", "edit_project", "submit_project",
    "approve_project", "reject_project", "publish_project",
    // Verifications
    "view_verifications", "manage_verifications",
    // Events
    "view_events", "create_event", "edit_event",
    // Analytics
    "view_analytics", "view_analytic_reports", "create_analytic_report", "edit_analytic_report",
    // Partners
    "view_partners",
    // Data Room
    "view_data_room", "upload_to_data_room", "manage_data_room",
    // EIN
    "view_ein_reports", "create_ein_report", "comment_ein", "approve_ein",
    // Deal Room
    "view_deal_room", "create_deal_room", "manage_deal_rooms",
    // Messenger
    "message_all", "message_partners_internal", "message_gov_internal",
    // IC / Pipeline
    "view_pipeline", "move_pipeline", "vote_ic",
    // Watchlist
    "view_watchlist",
    // PETFEL
    "run_petfel",
    // Audit
    "view_audit_log",
    // PIS
    "create_pis_report", "view_pis_reports",
  ],

  GOVERNMENT: [
    // Projects
    "view_projects", "create_project", "edit_project", "submit_project",
    // Verifications — focal point can co-verify
    "view_verifications", "manage_verifications",
    // Events
    "view_events",
    // Analytics
    "view_analytic_reports",
    // Partners
    "view_partners", "apply_partner_match",
    // Data Room — can view and upload but NOT manage/delete
    "view_data_room", "upload_to_data_room",
    // EIN — view only (no create/edit)
    "view_ein_reports",
    // Deal Room
    "view_deal_room",
    // Messenger
    "message_gov_internal",
    // Pipeline
    "view_pipeline",
    // Watchlist
    "view_watchlist", "manage_watchlist",
    // PIS — can create for their projects
    "create_pis_report", "view_pis_reports",
  ],

  SPONSOR_DEVELOPER: [
    // Projects
    "view_projects", "create_project", "edit_project", "submit_project",
    // Verifications
    "view_verifications",
    // Events
    "view_events",
    // Analytics
    "view_analytic_reports",
    // Partners
    "view_partners",
    // Data Room
    "view_data_room", "upload_to_data_room",
    // EIN
    "view_ein_reports", "comment_ein",
    // Deal Room
    "view_deal_room", "create_deal_room", "participate_deal_room", "request_deal_room_access",
    // Messenger
    "message_partners_internal",
    // Pipeline
    "view_pipeline",
    // Watchlist
    "view_watchlist", "manage_watchlist",
    // PIS — view only
    "view_pis_reports",
  ],

  EPC_OPERATOR: [
    // Projects
    "view_projects",
    // Verifications
    "view_verifications",
    // Events
    "view_events",
    // Analytics
    "view_analytic_reports",
    // Partners
    "view_partners", "apply_partner_match",
    // Data Room
    "view_data_room", "upload_to_data_room",
    // EIN
    "view_ein_reports",
    // Deal Room
    "view_deal_room", "request_deal_room_access",
    // Messenger
    "message_partners_internal",
    // Pipeline
    "view_pipeline",
    // Watchlist
    "view_watchlist",
    // PIS — view only
    "view_pis_reports",
  ],

  INSTITUTIONAL_INVESTOR: [
    // Projects
    "view_projects",
    // Verifications
    "view_verifications",
    // Events
    "view_events",
    // Analytics
    "view_analytics", "view_analytic_reports",
    // Partners
    "view_partners", "apply_partner_match",
    // Data Room
    "view_data_room", "upload_to_data_room",
    // EIN
    "view_ein_reports", "comment_ein",
    // Deal Room
    "view_deal_room", "create_deal_room", "participate_deal_room", "request_deal_room_access",
    // Messenger
    "message_partners_internal",
    // Pipeline
    "view_pipeline",
    // Watchlist
    "view_watchlist", "manage_watchlist",
    // PIS — view only
    "view_pis_reports",
  ],
}

// ── Legacy alias map ──────────────────────────────────────────────────────────
const LEGACY_ALIASES: Record<string, Permission> = {
  // Old Supabase-era names
  manage_users:            "manage_users",
  approve_projects:        "approve_project",
  reject_projects:         "reject_project",
  publish_projects:        "publish_project",
  create_projects:         "create_project",
  edit_projects:           "edit_project",
  delete_projects:         "delete_project",
  view_deals:              "view_deal_room",
  create_deals:            "create_deal_room",
  view_reports:            "view_ein_reports",
  create_reports:          "create_ein_report",
  // Old sidebar permission names
  view_all_projects:       "view_projects",
  view_own_projects:       "view_projects",
  view_curated_projects:   "view_projects",
  view_approved_projects:  "view_projects",
  run_pestel:              "run_petfel",
  view_pestel_full:        "run_petfel",
  view_pestel_summary:     "run_petfel",
  generate_ein:            "create_ein_report",
  edit_ein:                "create_ein_report",
  view_approved_ein:       "view_ein_reports",
  view_ein_approved_only:  "view_ein_reports",
  view_pipeline:           "view_pipeline",
  move_pipeline:           "move_pipeline",
  vote_ic:                 "vote_ic",
  manage_ic:               "manage_ic",
  upload_documents:        "upload_to_data_room",
  upload_own_documents:    "upload_to_data_room",
  view_analytics:          "view_analytics",
  manage_integrations:     "manage_integrations",
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

  function canAny(perms: string[]): boolean {
    return perms.some(p => can(p))
  }

  function canAll(perms: string[]): boolean {
    return perms.every(p => can(p))
  }

  function hasRole(...roles: string[]): boolean {
    if (!role) return false
    return roles.includes(role)
  }

  const isInternalAdmin = role === "SUPER_ADMIN" || role === "ADMIN"

  return {
    // State
    isLoading,
    role,
    permissions,

    // Checkers
    can,
    canAny,
    canAll,
    hasRole,

    // Convenience flags
    isSuperAdmin:             role === "SUPER_ADMIN",
    isAdmin:                  isInternalAdmin,
    isAnalyst:                role === "ANALYST",
    isGovernment:             role === "GOVERNMENT",
    isSponsorDeveloper:       role === "SPONSOR_DEVELOPER",
    isEPCOperator:            role === "EPC_OPERATOR",
    isInstitutionalInvestor:  role === "INSTITUTIONAL_INVESTOR",
    isInternalUser:           isInternalAdmin || role === "ANALYST",
    isExternalUser:           role !== null && !isInternalAdmin && role !== "ANALYST",

    // View-only: user can see but not write to a feature
    isViewOnly: (feature: "verifications" | "events" | "analytics" | "partners" | "data_room" | "ein" | "deal_room" | "analytic_reports" | "pis") => {
      if (!role) return true
      const writePerms: Record<string, Permission> = {
        verifications:    "manage_verifications",
        events:           "create_event",
        analytics:        "view_analytics",
        partners:         "manage_partners",
        data_room:        "manage_data_room",
        ein:              "create_ein_report",
        deal_room:        "manage_deal_rooms",
        analytic_reports: "create_analytic_report",
        pis:              "create_pis_report",
      }
      return !permissions.includes(writePerms[feature])
    },
  }
}

export { ROLE_PERMISSIONS }
export default useRBAC
