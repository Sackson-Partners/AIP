"use client"

/**
 * AzureAuthContext — compatibility shim
 *
 * Wraps NextAuth `useSession()` to expose the same `useAuth()` API surface
 * that the existing codebase uses via `AuthContext.tsx`. Existing consumers
 * call `useAuth()` unchanged; only the import path needs to be updated in
 * Phase 4 (one file at a time with green-light approval).
 */

import { useSession, signOut, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import type { UserRole, UserStatus, AuthProvider } from "@prisma/client"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  firstName: string | null
  lastName: string | null
  role: UserRole
  status: UserStatus
  authProvider: AuthProvider
  mustChangePass: boolean
  organization?: string | null
  internalProfile?: {
    employeeId: string
    accessLevel: number
    canApprove: boolean
    canPublish: boolean
    canManageUsers: boolean
  } | null
}

export interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string, totp?: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  /** Refreshes the session token — use after profile updates */
  refresh: () => Promise<void>
}

export function useAzureAuth(): AuthContextValue {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const isLoading = status === "loading"
  const isAuthenticated = status === "authenticated"

  const user: AuthUser | null =
    session?.user
      ? {
          id:              session.user.id,
          email:           session.user.email ?? "",
          name:            session.user.name ?? null,
          firstName:       session.user.firstName ?? null,
          lastName:        session.user.lastName ?? null,
          role:            session.user.role,
          status:          session.user.status,
          authProvider:    session.user.authProvider,
          mustChangePass:  session.user.mustChangePass ?? false,
          organization:    session.user.organization ?? null,
          internalProfile: session.user.internalProfile ?? null,
        }
      : null

  async function handleSignIn(
    email: string,
    password: string,
    totp?: string
  ): Promise<{ error?: string }> {
    const result = await signIn("internal-credentials", {
      redirect: false,
      email,
      password,
      totp: totp ?? "",
    })
    if (result?.error) {
      return { error: result.error }
    }
    return {}
  }

  async function handleSignOut(): Promise<void> {
    await signOut({ callbackUrl: "/auth/signin" })
  }

  async function refresh(): Promise<void> {
    await update()
    router.refresh()
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    signIn:  handleSignIn,
    signOut: handleSignOut,
    refresh,
  }
}

/**
 * AzureAuthProvider — passthrough wrapper.
 * Session context is provided by SessionProvider in layout.tsx.
 * This component exists so AuthContext.tsx can re-export it as AuthProvider
 * for zero-change compatibility with existing consumers.
 */
export function AzureAuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// Export as `useAuth` so existing call sites need zero changes
export const useAuth = useAzureAuth
export default useAzureAuth
