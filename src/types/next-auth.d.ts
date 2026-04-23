import type { DefaultSession, DefaultUser } from "next-auth"
import type { JWT as DefaultJWT } from "next-auth/jwt"

type UserRole =
  | "SUPER_ADMIN"
  | "ANALYST"
  | "GOVERNMENT"
  | "SPONSOR_DEVELOPER"
  | "EPC_OPERATOR"
  | "INSTITUTIONAL_INVESTOR"

type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED"
type AuthProvider = "AZURE_AD" | "INTERNAL"

interface InternalProfile {
  employeeId: string
  accessLevel: number
  canApprove: boolean
  canPublish: boolean
  canManageUsers: boolean
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      status: UserStatus
      authProvider: AuthProvider
      mustChangePass: boolean
      firstName: string | null
      lastName: string | null
      organization: string | null
      internalProfile: InternalProfile | null
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    azureOid?: string | null
    role: UserRole
    status: UserStatus
    authProvider: AuthProvider
    mustChangePass: boolean
    firstName: string | null
    lastName: string | null
    organization: string | null
    internalProfile: InternalProfile | null
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId: string
    role: UserRole
    status: UserStatus
    authProvider: AuthProvider
    mustChangePass: boolean
    firstName: string | null
    lastName: string | null
    organization: string | null
    internalProfile: InternalProfile | null
  }
}
