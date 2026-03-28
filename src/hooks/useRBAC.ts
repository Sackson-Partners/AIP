import { useAuth } from '@/context/AuthContext';

export type UserRole =
  | 'admin'
  | 'analyst'
  | 'ic_member'
  | 'gov_partner'
  | 'epc'
  | 'investor'
  | 'viewer';

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
  | 'manage_integrations';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view_all_projects', 'create_project', 'edit_project', 'delete_project',
    'run_pestel', 'view_pestel_full', 'generate_ein', 'edit_ein',
    'view_approved_ein', 'view_pipeline', 'move_pipeline', 'vote_ic',
    'manage_ic', 'upload_documents', 'manage_users', 'view_analytics',
    'manage_integrations', 'view_curated_projects', 'view_approved_projects',
  ],
  analyst: [
    'view_all_projects', 'create_project', 'edit_project',
    'run_pestel', 'view_pestel_full', 'generate_ein', 'edit_ein',
    'view_approved_ein', 'view_pipeline', 'move_pipeline',
    'upload_documents', 'view_analytics', 'view_curated_projects', 'view_approved_projects',
  ],
  ic_member: [
    'view_all_projects', 'view_pestel_summary', 'view_approved_ein',
    'view_pipeline', 'vote_ic', 'view_analytics',
    'view_curated_projects', 'view_approved_projects',
  ],
  gov_partner: [
    'view_curated_projects', 'view_approved_projects',
    'view_pestel_summary', 'view_ein_approved_only',
    'view_pipeline', 'upload_own_documents',
  ],
  epc: [
    'view_own_projects', 'create_project', 'edit_project',
    'view_pestel_summary', 'view_pipeline', 'upload_own_documents',
  ],
  investor: [
    'view_approved_projects', 'view_curated_projects',
    'view_pestel_summary', 'view_ein_approved_only',
  ],
  viewer: ['view_approved_projects'],
};

export const USER_ROLES: Record<UserRole, { label: string; requiresMFA: boolean }> = {
  admin:       { label: 'Administrator',  requiresMFA: true  },
  analyst:     { label: 'Analyst',        requiresMFA: true  },
  ic_member:   { label: 'IC Member',      requiresMFA: true  },
  gov_partner: { label: 'Gov. Partner',   requiresMFA: false },
  epc:         { label: 'EPC Contractor', requiresMFA: false },
  investor:    { label: 'Investor',       requiresMFA: false },
  viewer:      { label: 'Viewer',         requiresMFA: false },
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function useRBAC() {
  const { user, isAuthenticated } = useAuth();
  const role = (user?.user_metadata?.role as UserRole) ?? 'viewer';

  const can    = (permission: Permission): boolean =>
    isAuthenticated && hasPermission(role, permission);
  const canAny = (permissions: Permission[]): boolean =>
    isAuthenticated && hasAnyPermission(role, permissions);
  const canAll = (permissions: Permission[]): boolean =>
    isAuthenticated && hasAllPermissions(role, permissions);

  return {
    role,
    user,
    isAuthenticated,
    can,
    canAny,
    canAll,
    isAdmin:    role === 'admin',
    isAnalyst:  role === 'analyst',
    isICMember: role === 'ic_member',
    isInvestor: role === 'investor',
    permissions: ROLE_PERMISSIONS[role] ?? [],
  };
}

export default useRBAC;
