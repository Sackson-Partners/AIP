'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PublicClientApplication, AccountInfo, EventType, EventMessage, AuthenticationResult } from '@azure/msal-browser';
import {
  getMsalInstance,
  initializeMsal,
  loginRequest,
  b2cPolicies,
  parseUserFromAccount,
  acquireAccessToken,
  AzureB2CUser,
  UserRole,
  Permission,
  hasPermission,
  hasAnyPermission,
  canAccessFeature,
  USER_ROLES,
} from '../lib/azure-auth';

// ============================================================================
// Auth Context Types
// ============================================================================

interface AuthContextType {
  // User state
  user: AzureB2CUser | null;
  account: AccountInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Auth actions
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loginWithRedirect: () => Promise<void>;

  // Token management
  getAccessToken: () => Promise<string | null>;

  // Role-based access
  role: UserRole | null;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  canAccess: (feature: string) => boolean;
  requiresMFA: boolean;

  // Profile actions
  editProfile: () => Promise<void>;
  resetPassword: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Auth Provider Component
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AzureAuthProvider({ children }: AuthProviderProps) {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [user, setUser] = useState<AzureB2CUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize MSAL on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const instance = await initializeMsal();
        setMsalInstance(instance);

        // Get current account
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0) {
          const currentAccount = accounts[0];
          setAccount(currentAccount);
          setUser(parseUserFromAccount(currentAccount));
        }

        // Set up event callbacks
        instance.addEventCallback((event: EventMessage) => {
          if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
            const payload = event.payload as AuthenticationResult;
            const account = payload.account;
            setAccount(account);
            setUser(parseUserFromAccount(account));
          }

          if (event.eventType === EventType.LOGOUT_SUCCESS) {
            setAccount(null);
            setUser(null);
          }

          if (event.eventType === EventType.LOGIN_FAILURE) {
            const errorMessage = (event.error as Error)?.message || 'Login failed';
            // Check for password reset flow
            if (errorMessage.includes('AADB2C90118')) {
              // User clicked "Forgot password" - redirect to password reset
              instance.loginRedirect({
                authority: b2cPolicies.authorities.passwordReset.authority,
                scopes: loginRequest.scopes,
              });
            } else {
              setError(errorMessage);
            }
          }
        });
      } catch (err) {
        console.error('MSAL initialization failed:', err);
        setError('Authentication initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login with popup
  const login = useCallback(async () => {
    if (!msalInstance) return;
    setError(null);

    try {
      const response = await msalInstance.loginPopup(loginRequest);
      setAccount(response.account);
      setUser(parseUserFromAccount(response.account));
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('AADB2C90118')) {
        // Password reset requested
        await msalInstance.loginPopup({
          authority: b2cPolicies.authorities.passwordReset.authority,
          scopes: loginRequest.scopes,
        });
      } else {
        setError(errorMessage);
        throw err;
      }
    }
  }, [msalInstance]);

  // Login with redirect
  const loginWithRedirect = useCallback(async () => {
    if (!msalInstance) return;
    setError(null);

    try {
      await msalInstance.loginRedirect(loginRequest);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [msalInstance]);

  // Logout
  const logout = useCallback(async () => {
    if (!msalInstance || !account) return;

    try {
      await msalInstance.logoutPopup({
        account,
        postLogoutRedirectUri: window.location.origin,
      });
      setAccount(null);
      setUser(null);
    } catch (err) {
      // Fallback to redirect logout
      await msalInstance.logoutRedirect({
        account,
        postLogoutRedirectUri: window.location.origin,
      });
    }
  }, [msalInstance, account]);

  // Get access token for API calls
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!msalInstance) return null;
    return acquireAccessToken(msalInstance);
  }, [msalInstance]);

  // Edit profile
  const editProfile = useCallback(async () => {
    if (!msalInstance) return;

    try {
      await msalInstance.loginPopup({
        authority: b2cPolicies.authorities.editProfile.authority,
        scopes: loginRequest.scopes,
      });
      // Refresh user data
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setUser(parseUserFromAccount(accounts[0]));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [msalInstance]);

  // Reset password
  const resetPassword = useCallback(async () => {
    if (!msalInstance) return;

    try {
      await msalInstance.loginRedirect({
        authority: b2cPolicies.authorities.passwordReset.authority,
        scopes: loginRequest.scopes,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }, [msalInstance]);

  // Role-based access helpers
  const role = user?.role || null;

  const checkPermission = useCallback((permission: Permission): boolean => {
    if (!role) return false;
    return hasPermission(role, permission);
  }, [role]);

  const checkAnyPermission = useCallback((permissions: Permission[]): boolean => {
    if (!role) return false;
    return hasAnyPermission(role, permissions);
  }, [role]);

  const checkFeatureAccess = useCallback((feature: string): boolean => {
    if (!role) return false;
    return canAccessFeature(role, feature);
  }, [role]);

  const requiresMFA = role ? USER_ROLES[role].requiresMFA : false;

  const value: AuthContextType = {
    user,
    account,
    isAuthenticated: !!account,
    isLoading,
    error,
    login,
    logout,
    loginWithRedirect,
    getAccessToken,
    role,
    hasPermission: checkPermission,
    hasAnyPermission: checkAnyPermission,
    canAccess: checkFeatureAccess,
    requiresMFA,
    editProfile,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Auth Hook
// ============================================================================

export function useAzureAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAzureAuth must be used within an AzureAuthProvider');
  }
  return context;
}

// ============================================================================
// Role-Based Access Hooks
// ============================================================================

export function useRole(): UserRole | null {
  const { role } = useAzureAuth();
  return role;
}

export function usePermission(permission: Permission): boolean {
  const { hasPermission } = useAzureAuth();
  return hasPermission(permission);
}

export function useFeatureAccess(feature: string): boolean {
  const { canAccess } = useAzureAuth();
  return canAccess(feature);
}

// ============================================================================
// Protected Route Component
// ============================================================================

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: Permission[];
  requiredFeature?: string;
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  requiredFeature,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission, hasAnyPermission, canAccess } = useAzureAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please sign in to access this page.</p>
        </div>
      </div>
    );
  }

  // Check permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAccess = requiredPermissions.length === 1
      ? hasPermission(requiredPermissions[0])
      : hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      return fallback || (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
  }

  // Check feature access
  if (requiredFeature && !canAccess(requiredFeature)) {
    return fallback || (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have access to this feature.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================================================
// Role Guard Component
// ============================================================================

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { role, isAuthenticated, isLoading } = useAzureAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !role || !allowedRoles.includes(role)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}

// ============================================================================
// Permission Guard Component
// ============================================================================

interface PermissionGuardProps {
  children: ReactNode;
  permission: Permission | Permission[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

export function PermissionGuard({ children, permission, requireAll = false, fallback }: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, isAuthenticated, isLoading } = useAzureAuth();

  if (isLoading) {
    return null;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = requireAll
    ? permissions.every((p) => hasPermission(p))
    : hasAnyPermission(permissions);

  if (!isAuthenticated || !hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
