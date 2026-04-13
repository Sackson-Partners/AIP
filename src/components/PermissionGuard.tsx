'use client';

import { ReactNode } from 'react';
import { useRBAC, Permission } from '@/hooks/useRBAC';

interface PermissionGuardProps {
  /** Render children only if user has ALL of these permissions */
  require?: Permission | Permission[];
  /** Render children if user has ANY of these permissions */
  requireAny?: Permission[];
  /** What to render when the user lacks permission (default: nothing) */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children based on the current user's permissions.
 *
 * Usage:
 *   <PermissionGuard require="edit_project">
 *     <button>Edit</button>
 *   </PermissionGuard>
 */
export function PermissionGuard({
  require,
  requireAny,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { canAny, canAll } = useRBAC();

  let allowed = true;

  if (require) {
    const perms = Array.isArray(require) ? require : [require];
    allowed = canAll(perms);
  } else if (requireAny) {
    allowed = canAny(requireAny);
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
}
