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

/**
 * Inline "View Only" badge — place next to a page title when the user
 * can see but not modify a feature.
 */
export function ViewOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      View Only
    </span>
  );
}

/**
 * Full-width banner shown at the top of a restricted section.
 */
export function ViewOnlyBanner({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2.5 rounded-lg mb-4">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
      </svg>
      {message ?? "You have view-only access to this section. Contact an administrator to request additional permissions."}
    </div>
  );
}
