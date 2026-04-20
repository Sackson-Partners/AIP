/**
 * Azure AD B2C Authentication Configuration
 *
 * This module provides MSAL configuration for Azure AD B2C authentication
 * with support for the 6 user roles defined in the PRD.
 */

import { Configuration, LogLevel, PublicClientApplication, AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';

// ============================================================================
// Azure AD B2C Configuration
// ============================================================================

// These values should be set in environment variables
const B2C_TENANT_NAME = process.env.NEXT_PUBLIC_B2C_TENANT_NAME || 'aipplatform';
const B2C_CLIENT_ID = process.env.NEXT_PUBLIC_B2C_CLIENT_ID || '';
const B2C_POLICY_SIGN_IN = process.env.NEXT_PUBLIC_B2C_POLICY_SIGN_IN || 'B2C_1_SignUpSignIn';
const B2C_POLICY_PASSWORD_RESET = process.env.NEXT_PUBLIC_B2C_POLICY_PASSWORD_RESET || 'B2C_1_PasswordReset';
const B2C_POLICY_EDIT_PROFILE = process.env.NEXT_PUBLIC_B2C_POLICY_EDIT_PROFILE || 'B2C_1_EditProfile';
const B2C_API_SCOPE = process.env.NEXT_PUBLIC_B2C_API_SCOPE || `https://${B2C_TENANT_NAME}.onmicrosoft.com/api/access`;

// B2C Authority URLs
const B2C_AUTHORITY_DOMAIN = `${B2C_TENANT_NAME}.b2clogin.com`;
const B2C_AUTHORITY_BASE = `https://${B2C_AUTHORITY_DOMAIN}/${B2C_TENANT_NAME}.onmicrosoft.com`;

export const b2cPolicies = {
  names: {
    signUpSignIn: B2C_POLICY_SIGN_IN,
    passwordReset: B2C_POLICY_PASSWORD_RESET,
    editProfile: B2C_POLICY_EDIT_PROFILE,
  },
  authorities: {
    signUpSignIn: {
      authority: `${B2C_AUTHORITY_BASE}/${B2C_POLICY_SIGN_IN}`,
    },
    passwordReset: {
      authority: `${B2C_AUTHORITY_BASE}/${B2C_POLICY_PASSWORD_RESET}`,
    },
    editProfile: {
      authority: `${B2C_AUTHORITY_BASE}/${B2C_POLICY_EDIT_PROFILE}`,
    },
  },
  authorityDomain: B2C_AUTHORITY_DOMAIN,
};

// ============================================================================
// MSAL Configuration
// ============================================================================

export const msalConfig: Configuration = {
  auth: {
    clientId: B2C_CLIENT_ID,
    authority: b2cPolicies.authorities.signUpSignIn.authority,
    knownAuthorities: [b2cPolicies.authorityDomain],
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
    postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

// API scopes for token requests
export const apiScopes = {
  read: [B2C_API_SCOPE],
  write: [B2C_API_SCOPE],
};

// Login request configuration
export const loginRequest = {
  scopes: apiScopes.read,
};

// ============================================================================
// User Roles (from PRD Section 10.2)
// ============================================================================

export type UserRole = 'admin' | 'analyst' | 'ic_member' | 'gov_partner' | 'epc' | 'investor';

export interface UserRoleInfo {
  role: UserRole;
  displayName: string;
  description: string;
  requiresMFA: boolean;
}

export const USER_ROLES: Record<UserRole, UserRoleInfo> = {
  admin: {
    role: 'admin',
    displayName: 'Administrator',
    description: 'Full system access, user management',
    requiresMFA: true,
  },
  analyst: {
    role: 'analyst',
    displayName: 'Analyst',
    description: 'Project analysis, PETFEL scoring, EIN generation',
    requiresMFA: true,
  },
  ic_member: {
    role: 'ic_member',
    displayName: 'IC Member',
    description: 'Investment Committee voting member',
    requiresMFA: true,
  },
  gov_partner: {
    role: 'gov_partner',
    displayName: 'Government/Partner',
    description: 'Own project access only',
    requiresMFA: false,
  },
  epc: {
    role: 'epc',
    displayName: 'EPC Contractor',
    description: 'Document upload for own projects',
    requiresMFA: false,
  },
  investor: {
    role: 'investor',
    displayName: 'Investor',
    description: 'Curated project and EIN access',
    requiresMFA: false,
  },
};

// ============================================================================
// Role-Based Access Control Matrix (PRD Section 10.2)
// ============================================================================

export type Permission =
  | 'create_project'
  | 'edit_project'
  | 'view_all_projects'
  | 'view_own_projects'
  | 'view_curated_projects'
  | 'view_approved_projects'
  | 'run_petfel'
  | 'view_petfel_full'
  | 'view_petfel_summary'
  | 'generate_ein'
  | 'edit_ein'
  | 'view_approved_ein'
  | 'view_ein_approved_only'
  | 'upload_documents'
  | 'upload_own_documents'
  | 'vote_ic'
  | 'manage_users'
  | 'view_pipeline'
  | 'move_pipeline';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'create_project',
    'edit_project',
    'view_all_projects',
    'run_petfel',
    'view_petfel_full',
    'generate_ein',
    'edit_ein',
    'view_approved_ein',
    'upload_documents',
    'manage_users',
    'view_pipeline',
    'move_pipeline',
  ],
  analyst: [
    'create_project',
    'edit_project',
    'view_all_projects',
    'run_petfel',
    'view_petfel_full',
    'generate_ein',
    'edit_ein',
    'view_approved_ein',
    'upload_documents',
    'view_pipeline',
    'move_pipeline',
  ],
  ic_member: [
    'view_approved_projects',
    'view_petfel_full',
    'view_approved_ein',
    'vote_ic',
    'view_pipeline',
  ],
  gov_partner: [
    'view_own_projects',
    'edit_project', // Own only - enforced at API level
    'view_petfel_full', // Own project only
    'upload_own_documents',
  ],
  epc: [
    'upload_own_documents',
  ],
  investor: [
    'view_curated_projects',
    'view_petfel_summary',
    'view_ein_approved_only',
  ],
};

// ============================================================================
// Permission Checking Utilities
// ============================================================================

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function canAccessFeature(role: UserRole, feature: string): boolean {
  const featurePermissionMap: Record<string, Permission[]> = {
    projects: ['view_all_projects', 'view_own_projects', 'view_curated_projects', 'view_approved_projects'],
    petfel: ['run_petfel', 'view_petfel_full', 'view_petfel_summary'],
    ein: ['generate_ein', 'edit_ein', 'view_approved_ein', 'view_ein_approved_only'],
    pipeline: ['view_pipeline', 'move_pipeline'],
    datarooms: ['upload_documents', 'upload_own_documents'],
    ic: ['vote_ic'],
    users: ['manage_users'],
  };

  const requiredPermissions = featurePermissionMap[feature];
  if (!requiredPermissions) return true; // No restrictions

  return hasAnyPermission(role, requiredPermissions);
}

// ============================================================================
// Azure AD B2C User Claims
// ============================================================================

export interface AzureB2CUser {
  id: string;
  email: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  role: UserRole;
  organization?: string;
  mfaEnabled: boolean;
  createdAt?: string;
}

export function parseUserFromAccount(account: AccountInfo | null): AzureB2CUser | null {
  if (!account) return null;

  const idTokenClaims = account.idTokenClaims as Record<string, unknown> | undefined;

  return {
    id: account.localAccountId,
    email: (idTokenClaims?.emails as string[])?.[0] || account.username,
    displayName: idTokenClaims?.name as string || account.name || '',
    givenName: idTokenClaims?.given_name as string,
    surname: idTokenClaims?.family_name as string,
    role: (idTokenClaims?.extension_Role as UserRole) || 'investor', // Default to most restrictive
    organization: idTokenClaims?.extension_Organization as string,
    mfaEnabled: (idTokenClaims?.extension_MFAEnabled as boolean) || false,
    createdAt: idTokenClaims?.auth_time ? new Date((idTokenClaims.auth_time as number) * 1000).toISOString() : undefined,
  };
}

// ============================================================================
// MSAL Instance (singleton)
// ============================================================================

let msalInstance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (!msalInstance && typeof window !== 'undefined') {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance!;
}

export async function initializeMsal(): Promise<PublicClientApplication> {
  const instance = getMsalInstance();
  await instance.initialize();

  // Handle redirect promise (for redirect flow)
  await instance.handleRedirectPromise();

  return instance;
}

// ============================================================================
// Token Acquisition
// ============================================================================

export async function acquireAccessToken(instance: PublicClientApplication): Promise<string | null> {
  const accounts = instance.getAllAccounts();
  if (accounts.length === 0) return null;

  const account = accounts[0];

  try {
    const response = await instance.acquireTokenSilent({
      scopes: apiScopes.read,
      account,
    });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Token expired or interaction required, redirect to login
      await instance.acquireTokenRedirect({
        scopes: apiScopes.read,
        account,
      });
      return null;
    }
    console.error('Token acquisition failed:', error);
    return null;
  }
}

// ============================================================================
// JWT Token Utilities (15-minute TTL as per PRD)
// ============================================================================

export interface TokenInfo {
  accessToken: string;
  expiresAt: Date;
  isExpired: boolean;
  timeUntilExpiry: number; // seconds
}

export function parseTokenExpiry(token: string): TokenInfo | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    const expiresAt = new Date(payload.exp * 1000);
    const now = new Date();
    const timeUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    return {
      accessToken: token,
      expiresAt,
      isExpired: timeUntilExpiry <= 0,
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
    };
  } catch {
    return null;
  }
}
