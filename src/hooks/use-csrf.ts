"use client";

import { useSession } from "next-auth/react";

/**
 * Hook to get the CSRF token from the current session
 *
 * Usage:
 * ```typescript
 * const csrfToken = useCsrfToken();
 *
 * await fetch('/api/projects', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-CSRF-Token': csrfToken,
 *   },
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export function useCsrfToken(): string {
  const { data: session } = useSession();
  return (session as any)?.csrfToken ?? "";
}
