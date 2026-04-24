export const Permissions = {
  MANAGE_USERS: "MANAGE_USERS",
  VIEW_USERS: "VIEW_USERS",
  APPROVE_USERS: "APPROVE_USERS",
  CREATE_PROJECT: "CREATE_PROJECT",
  EDIT_PROJECT: "EDIT_PROJECT",
  DELETE_PROJECT: "DELETE_PROJECT",
  APPROVE_PROJECT: "APPROVE_PROJECT",
  PUBLISH_PROJECT: "PUBLISH_PROJECT",
  RUN_PETFEL: "RUN_PETFEL",
  VIEW_PETFEL: "VIEW_PETFEL",
  GENERATE_EIN: "GENERATE_EIN",
  VIEW_EIN: "VIEW_EIN",
  CREATE_DEAL_ROOM: "CREATE_DEAL_ROOM",
  ACCESS_DEAL_ROOM: "ACCESS_DEAL_ROOM",
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
  VIEW_ANALYTICS: "VIEW_ANALYTICS",
} as const

export type Permission = (typeof Permissions)[keyof typeof Permissions]

export type AIPUserRole =
  | "SUPER_ADMIN"
  | "ANALYST"
  | "GOVERNMENT"
  | "SPONSOR_DEVELOPER"
  | "EPC_OPERATOR"
  | "INSTITUTIONAL_INVESTOR"

const ALL_PERMISSIONS = Object.values(Permissions) as Permission[]

export const ROLE_PERMISSIONS: Record<AIPUserRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ANALYST: [
    Permissions.VIEW_USERS,
    Permissions.APPROVE_USERS,
    Permissions.VIEW_PETFEL,
    Permissions.RUN_PETFEL,
    Permissions.VIEW_EIN,
    Permissions.GENERATE_EIN,
    Permissions.APPROVE_PROJECT,
    Permissions.PUBLISH_PROJECT,
    Permissions.VIEW_AUDIT_LOG,
    Permissions.VIEW_ANALYTICS,
  ],
  GOVERNMENT: [
    Permissions.CREATE_PROJECT,
    Permissions.EDIT_PROJECT,
    Permissions.VIEW_PETFEL,
    Permissions.VIEW_EIN,
    Permissions.ACCESS_DEAL_ROOM,
  ],
  SPONSOR_DEVELOPER: [
    Permissions.CREATE_PROJECT,
    Permissions.EDIT_PROJECT,
    Permissions.RUN_PETFEL,
    Permissions.VIEW_PETFEL,
    Permissions.GENERATE_EIN,
    Permissions.VIEW_EIN,
    Permissions.CREATE_DEAL_ROOM,
    Permissions.ACCESS_DEAL_ROOM,
  ],
  EPC_OPERATOR: [
    Permissions.VIEW_PETFEL,
    Permissions.VIEW_EIN,
    Permissions.ACCESS_DEAL_ROOM,
  ],
  INSTITUTIONAL_INVESTOR: [
    Permissions.VIEW_EIN,
    Permissions.VIEW_PETFEL,
    Permissions.ACCESS_DEAL_ROOM,
  ],
}

export function hasPermission(
  session: { user?: { role?: string } } | null,
  permission: Permission
): boolean {
  if (!session?.user?.role) return false
  const role = session.user.role as AIPUserRole
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function requireRole(
  session: { user?: { role?: string } } | null,
  ...roles: AIPUserRole[]
): boolean {
  if (!session?.user?.role) return false
  return roles.includes(session.user.role as AIPUserRole)
}

export function isInternalUser(
  session: { user?: { authProvider?: string } } | null
): boolean {
  return session?.user?.authProvider === "INTERNAL"
}
