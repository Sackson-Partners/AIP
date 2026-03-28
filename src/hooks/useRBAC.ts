import { useAuth } from '@/context/AuthContext';

// These values must match exactly what is stored in Supabase user_metadata.role
export type UserRole =
  | 'super_admin'
  | 'private_fund'
  | 'dfi'
  | 'epc_contractor'
  | 'government'
  | 'academic'
  | 'journalist_analyst'
  | 'investor';

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
  super_admin: [
    'view_all_projects', 'create_project', 'edit_project', 'delete_project',
    'run_pestel', 'view_pestel_full', 'generate_ein', 'edit_ein',
    'view_approved_ein', 'view_pipeline', 'move_pipeline', 'vote_ic',
    'manage_ic', 'upload_documents', 'manage_users', 'view_analytics',
    'manage_integrations', 'view_curated_projects', 'view_approved_projects',
  ],
  private_fund: [
    'view_all_projects', 'create_project', 'edit_project',
    'run_pestel', 'view_pestel_full', 'generate_ein', 'edit_ein',
    'view_approved_ein', 'view_pipeline', 'move_pipeline', 'vote_ic',
    'upload_documents', 'view_analytics',
    'view_curated_projects', 'view_approved_projects',
  ],
  dfi: [
    'view_all_projects', 'create_project', 'edit_project',
    'run_pestel', 'view_pestel_full', 'generate_ein', 'edit_ein',
    'view_approved_ein', 'view_pipeline', 'move_pipeline', 'vote_ic', 'manage_ic',
    'upload_documents', 'view_analytics',
    'view_curated_projects', 'view_approved_projects',
  ],
  epc_contractor: [
    'view_own_projects', 'create_project', 'edit_project',
    'view_pestel_summary', 'view_pipeline', 'upload_own_documents',
  ],
  government: [
    'view_curated_projects', 'view_approved_projects',
    'view_pestel_summary', 'view_ein_approved_only',
    'view_pipeline', 'upload_own_documents',
  ],
  academic: [
    'view_approved_projects', 'view_pestel_summary', 'view_analytics',
  ],
  journalist_analyst: [
    'view_approved_projects', 'view_pestel_summary',
  ],
  investor: [
    'view_approved_projects', 'view_curated_projects',
    'view_pestel_summary', 'view_ein_approved_only',
  ],
};

export const USER_ROLES: Record<UserRole, { label: string; requiresMFA: boolean }> = {
  super_admin:        { label: 'Super Admin',    requiresMFA: true  },
  private_fund:       { label: 'Private Fund',   requiresMFA: true  },
  dfi:                { label: 'DFI',            requiresMFA: true  },
  epc_contractor:     { label: 'EPC Contractor', requiresMFA: false },
  government:         { label: 'Government',     requiresMFA: false },
  academic:           { label: 'Academic',       requiresMFA: false },
  journalist_analyst: { label: 'Analyst',        requiresMFA: false },
  investor:           { label: 'Investor',       requiresMFA: false },
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
  const rawRole = user?.user_metadata?.role as string | undefined;
  // Fall back to journalist_analyst (most restricted) for unknown roles
  const role: UserRole = (rawRole && rawRole in USER_ROLES)
    ? rawRole as UserRole
    : 'journalist_analyst';

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
    isAdmin:    role === 'super_admin',
    isAnalyst:  role === 'private_fund' || role === 'dfi',
    isICMember: role === 'dfi' || role === 'private_fund',
    isInvestor: role === 'investor',
    permissions: ROLE_PERMISSIONS[role] ?? [],
  };
}

export default useRBAC;
