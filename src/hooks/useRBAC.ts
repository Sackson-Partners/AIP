/**
 * Role-Based Access Control Hooks
 *
 * Provides convenient hooks for checking user permissions and roles
 * throughout the application.
 */

import { useCallback, useMemo } from 'react';
import { useAzureAuth } from '../context/AzureAuthContext';
import {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  USER_ROLES,
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
} from '../lib/azure-auth';

// ============================================================================
// Role Checking Hooks
// ============================================================================

/**
 * Check if the current user has a specific role
 */
export function useHasRole(role: UserRole): boolean {
  const { role: userRole } = useAzureAuth();
  return userRole === role;
}

/**
 * Check if the current user has any of the specified roles
 */
export function useHasAnyRole(roles: UserRole[]): boolean {
  const { role: userRole } = useAzureAuth();
  return userRole ? roles.includes(userRole) : false;
}

/**
 * Get the current user's role information
 */
export function useRoleInfo() {
  const { role } = useAzureAuth();
  return role ? USER_ROLES[role] : null;
}

// ============================================================================
// Permission Checking Hooks
// ============================================================================

/**
 * Check if the current user has a specific permission
 */
export function useHasPermission(permission: Permission): boolean {
  const { role } = useAzureAuth();
  return role ? checkPermission(role, permission) : false;
}

/**
 * Check if the current user has any of the specified permissions
 */
export function useHasAnyPermission(permissions: Permission[]): boolean {
  const { role } = useAzureAuth();
  return role ? checkAnyPermission(role, permissions) : false;
}

/**
 * Check if the current user has all of the specified permissions
 */
export function useHasAllPermissions(permissions: Permission[]): boolean {
  const { role } = useAzureAuth();
  return role ? checkAllPermissions(role, permissions) : false;
}

/**
 * Get all permissions for the current user
 */
export function usePermissions(): Permission[] {
  const { role } = useAzureAuth();
  return role ? ROLE_PERMISSIONS[role] : [];
}

// ============================================================================
// Feature Access Hooks (based on PRD Role Access Matrix)
// ============================================================================

/**
 * Project access permissions
 */
export function useProjectAccess() {
  const { role, user } = useAzureAuth();

  return useMemo(() => {
    if (!role) {
      return {
        canCreate: false,
        canEdit: false,
        canViewAll: false,
        canViewOwn: false,
        canViewCurated: false,
        canViewApproved: false,
      };
    }

    return {
      canCreate: checkPermission(role, 'create_project'),
      canEdit: checkPermission(role, 'edit_project'),
      canViewAll: checkPermission(role, 'view_all_projects'),
      canViewOwn: checkPermission(role, 'view_own_projects'),
      canViewCurated: checkPermission(role, 'view_curated_projects'),
      canViewApproved: checkPermission(role, 'view_approved_projects'),
      // For roles that can only edit own projects
      isOwnProjectOnly: role === 'gov_partner',
      userId: user?.id,
    };
  }, [role, user]);
}

/**
 * PETFEL access permissions
 */
export function usePETFELAccess() {
  const { role } = useAzureAuth();

  return useMemo(() => {
    if (!role) {
      return {
        canRun: false,
        canViewFull: false,
        canViewSummary: false,
      };
    }

    return {
      canRun: checkPermission(role, 'run_petfel'),
      canViewFull: checkPermission(role, 'view_petfel_full'),
      canViewSummary: checkPermission(role, 'view_petfel_summary'),
    };
  }, [role]);
}

/**
 * EIN access permissions
 */
export function useEINAccess() {
  const { role } = useAzureAuth();

  return useMemo(() => {
    if (!role) {
      return {
        canGenerate: false,
        canEdit: false,
        canViewApproved: false,
        canViewApprovedOnly: false,
      };
    }

    return {
      canGenerate: checkPermission(role, 'generate_ein'),
      canEdit: checkPermission(role, 'edit_ein'),
      canViewApproved: checkPermission(role, 'view_approved_ein'),
      canViewApprovedOnly: checkPermission(role, 'view_ein_approved_only'),
    };
  }, [role]);
}

/**
 * Document access permissions
 */
export function useDocumentAccess() {
  const { role, user } = useAzureAuth();

  return useMemo(() => {
    if (!role) {
      return {
        canUpload: false,
        canUploadOwn: false,
        isOwnOnly: false,
      };
    }

    return {
      canUpload: checkPermission(role, 'upload_documents'),
      canUploadOwn: checkPermission(role, 'upload_own_documents'),
      isOwnOnly: role === 'gov_partner' || role === 'epc',
      userId: user?.id,
    };
  }, [role, user]);
}

/**
 * Investment Committee access permissions
 */
export function useICAccess() {
  const { role } = useAzureAuth();

  return useMemo(() => {
    if (!role) {
      return {
        canVote: false,
        canViewCommittees: false,
      };
    }

    return {
      canVote: checkPermission(role, 'vote_ic'),
      canViewCommittees: role === 'admin' || role === 'analyst' || role === 'ic_member',
    };
  }, [role]);
}

/**
 * Pipeline access permissions
 */
export function usePipelineAccess() {
  const { role } = useAzureAuth();

  return useMemo(() => {
    if (!role) {
      return {
        canView: false,
        canMove: false,
      };
    }

    return {
      canView: checkPermission(role, 'view_pipeline'),
      canMove: checkPermission(role, 'move_pipeline'),
    };
  }, [role]);
}

/**
 * User management access permissions
 */
export function useUserManagementAccess() {
  const { role } = useAzureAuth();

  return useMemo(() => {
    if (!role) {
      return {
        canManage: false,
        canViewUsers: false,
      };
    }

    return {
      canManage: checkPermission(role, 'manage_users'),
      canViewUsers: role === 'admin',
    };
  }, [role]);
}

// ============================================================================
// Navigation Visibility Hook
// ============================================================================

export interface NavigationItem {
  name: string;
  href: string;
  visible: boolean;
  icon?: string;
}

export function useNavigationVisibility() {
  const { role, isAuthenticated } = useAzureAuth();

  return useCallback(
    (items: { name: string; href: string; feature?: string }[]): NavigationItem[] => {
      if (!isAuthenticated || !role) {
        return items.map((item) => ({ ...item, visible: false }));
      }

      const featurePermissionMap: Record<string, Permission[]> = {
        projects: ['view_all_projects', 'view_own_projects', 'view_curated_projects', 'view_approved_projects'],
        pis: ['view_all_projects', 'view_own_projects', 'view_curated_projects', 'view_approved_projects'],
        petfel: ['run_petfel', 'view_petfel_full', 'view_petfel_summary'],
        ein: ['generate_ein', 'edit_ein', 'view_approved_ein', 'view_ein_approved_only'],
        pipeline: ['view_pipeline'],
        investors: ['view_all_projects', 'view_curated_projects'],
        verifications: ['view_all_projects', 'run_petfel'],
        'data-rooms': ['upload_documents', 'upload_own_documents'],
        'deal-rooms': ['view_all_projects', 'view_approved_projects'],
        analytics: ['view_all_projects'],
        events: ['view_all_projects'],
        integrations: ['manage_users'],
        users: ['manage_users'],
      };

      return items.map((item) => {
        const feature = item.feature || item.href.split('/').pop() || '';
        const requiredPermissions = featurePermissionMap[feature];

        let visible = true;
        if (requiredPermissions) {
          visible = checkAnyPermission(role, requiredPermissions);
        }

        return { ...item, visible };
      });
    },
    [role, isAuthenticated]
  );
}

// ============================================================================
// Action Permission Hook
// ============================================================================

export interface ActionPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canSubmit: boolean;
}

export function useActionPermissions(resourceType: string): ActionPermissions {
  const { role } = useAzureAuth();

  return useMemo(() => {
    if (!role) {
      return {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canSubmit: false,
      };
    }

    // Resource-specific permission mappings
    const permissionMappings: Record<string, ActionPermissions> = {
      project: {
        canView: checkAnyPermission(role, ['view_all_projects', 'view_own_projects', 'view_curated_projects', 'view_approved_projects']),
        canCreate: checkPermission(role, 'create_project'),
        canEdit: checkPermission(role, 'edit_project'),
        canDelete: role === 'admin',
        canApprove: role === 'admin' || role === 'analyst',
        canSubmit: checkPermission(role, 'create_project'),
      },
      petfel: {
        canView: checkAnyPermission(role, ['view_petfel_full', 'view_petfel_summary']),
        canCreate: checkPermission(role, 'run_petfel'),
        canEdit: checkPermission(role, 'run_petfel'),
        canDelete: role === 'admin',
        canApprove: role === 'admin',
        canSubmit: checkPermission(role, 'run_petfel'),
      },
      ein: {
        canView: checkAnyPermission(role, ['view_approved_ein', 'view_ein_approved_only']),
        canCreate: checkPermission(role, 'generate_ein'),
        canEdit: checkPermission(role, 'edit_ein'),
        canDelete: role === 'admin',
        canApprove: role === 'admin',
        canSubmit: checkPermission(role, 'generate_ein'),
      },
      document: {
        canView: true, // Controlled by document-level access
        canCreate: checkAnyPermission(role, ['upload_documents', 'upload_own_documents']),
        canEdit: checkPermission(role, 'upload_documents'),
        canDelete: role === 'admin' || role === 'analyst',
        canApprove: false,
        canSubmit: checkAnyPermission(role, ['upload_documents', 'upload_own_documents']),
      },
      user: {
        canView: checkPermission(role, 'manage_users'),
        canCreate: checkPermission(role, 'manage_users'),
        canEdit: checkPermission(role, 'manage_users'),
        canDelete: checkPermission(role, 'manage_users'),
        canApprove: checkPermission(role, 'manage_users'),
        canSubmit: false,
      },
    };

    return permissionMappings[resourceType] || {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
      canSubmit: false,
    };
  }, [role, resourceType]);
}
