import type { NextAuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { verifyTOTP } from "@/lib/auth/totp"
import { logActivity } from "@/lib/audit"

// Known Account schema fields — strips any extra Azure AD token fields (e.g. not_before, client_info, foci)
const KNOWN_ACCOUNT_FIELDS = new Set([
  'userId', 'type', 'provider', 'providerAccountId', 'refresh_token',
  'access_token', 'expires_at', 'token_type', 'scope', 'id_token',
  'session_state', 'ext_expires_in',
])

const baseAdapter = PrismaAdapter(prisma) as any
const safeAdapter = {
  ...baseAdapter,
  async linkAccount(account: Record<string, unknown>) {
    const clean = Object.fromEntries(
      Object.entries(account).filter(([k]) => KNOWN_ACCOUNT_FIELDS.has(k))
    )
    return baseAdapter.linkAccount(clean)
  },
}

export const authOptions: NextAuthOptions = {
  adapter: safeAdapter as any,

  // Explicit cookie config required for Next.js 15+ async cookies() API on localhost
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 900 },
    },
    state: {
      name: 'next-auth.state',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 900 },
    },
  },

  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
          prompt: "select_account",
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profile(profile: any) {
        return {
          id: profile.oid ?? profile.sub ?? "",
          name: profile.name ?? null,
          email: profile.email ?? profile.preferred_username ?? null,
          image: null,
          azureOid: profile.oid ?? null,
          firstName: profile.given_name ?? null,
          lastName: profile.family_name ?? null,
          jobTitle: profile.jobTitle ?? null,
          organization: null,
          internalProfile: null,
          role: "INSTITUTIONAL_INVESTOR" as const,
          status: "PENDING" as const,
          authProvider: "AZURE_AD" as const,
          mustChangePass: false,
        }
      },
    }),

    CredentialsProvider({
      id: "internal-credentials",
      name: "Internal Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "TOTP Code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("EMAIL_PASSWORD_REQUIRED")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { internalProfile: true },
        })

        if (!user) throw new Error("INVALID_CREDENTIALS")

        if (user.authProvider === "AZURE_AD") throw new Error("USE_AZURE_LOGIN")

        if (!user.passwordHash) throw new Error("INVALID_CREDENTIALS")

        const passwordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )
        if (!passwordValid) throw new Error("INVALID_CREDENTIALS")

        if (user.status === "SUSPENDED") throw new Error("ACCOUNT_SUSPENDED")
        if (user.status === "DEACTIVATED") throw new Error("ACCOUNT_DEACTIVATED")
        if (user.status === "PENDING") throw new Error("ACCOUNT_PENDING")

        if (user.twoFactorEnabled) {
          if (!credentials.totp) throw new Error("TOTP_REQUIRED")
          if (!user.twoFactorSecret) throw new Error("INVALID_TOTP")
          if (!verifyTOTP(credentials.totp, user.twoFactorSecret)) {
            throw new Error("INVALID_TOTP")
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ip = (req as any)?.headers?.["x-forwarded-for"] ?? "unknown"
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: typeof ip === "string" ? ip.split(",")[0].trim() : "unknown",
            loginCount: { increment: 1 },
          },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          // Custom fields — picked up by jwt callback
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // CredentialsProvider — all validation already done in authorize
      if (account?.provider === "internal-credentials") return true

      // Azure AD — find or create user
      if (account?.provider === "azure-ad") {
        const email = user.email
        if (!email) return false

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const azureOid = (user as any).azureOid as string | null | undefined
        const existing = await prisma.user.findFirst({
          where: {
            OR: [
              { email },
              // Only match by azureOid if it's a non-null value — null would match all users without an OID
              ...(azureOid ? [{ azureOid }] : []),
            ],
          },
        })

        if (existing) {
          if (
            existing.status === "SUSPENDED" ||
            existing.status === "DEACTIVATED"
          ) {
            return "/auth/error?error=AccountBlocked"
          }
          await prisma.user.update({
            where: { id: existing.id },
            data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
          })
          user.id = existing.id
          return true
        }

        // New Azure AD user — create as PENDING
        const created = await prisma.user.create({
          data: {
            email,
            name: user.name,
            image: user.image,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            azureOid: (user as any).azureOid,
            status: "PENDING",
            role: "INSTITUTIONAL_INVESTOR",
            authProvider: "AZURE_AD",
            emailVerified: new Date(),
            lastLoginAt: new Date(),
            loginCount: 1,
          },
        })
        user.id = created.id

        // Notify all active super admins
        const admins = await prisma.user.findMany({
          where: { role: "SUPER_ADMIN", status: "ACTIVE" },
          select: { id: true },
        })
        if (admins.length > 0) {
          await prisma.notification.createMany({
            data: admins.map((a: { id: string }) => ({
              userId: a.id,
              type: "SYSTEM_ALERT" as const,
              title: "New User Registration",
              message: `${email} has registered and is pending approval.`,
              link: "/admin/users",
            })),
          })
        }

        return true
      }

      return true
    },

    async redirect({ url, baseUrl }) {
      // Allow relative URLs to safe destinations (including /auth/* for error/pending/etc)
      if (url.startsWith('/')) {
        const safe =
          url.startsWith('/dashboard') ||
          url.startsWith('/auth/') ||
          url.startsWith('/unauthorized')
        return safe ? `${baseUrl}${url}` : `${baseUrl}/dashboard`
      }
      // Allow same-origin absolute URLs
      if (url.startsWith(baseUrl)) return url
      return `${baseUrl}/dashboard`
    },

    async jwt({ token, user, trigger }) {
      // On every sign-in, fetch fresh data from DB
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { internalProfile: true },
        })
        if (dbUser) {
          token.userId = dbUser.id
          token.role = dbUser.role as unknown as never
          token.status = dbUser.status as unknown as never
          token.authProvider = dbUser.authProvider as unknown as never
          token.mustChangePass = dbUser.mustChangePass
          token.firstName = dbUser.firstName
          token.lastName = dbUser.lastName
          token.organization = dbUser.organization
          token.internalProfile = dbUser.internalProfile
            ? {
                employeeId: dbUser.internalProfile.employeeId,
                accessLevel: dbUser.internalProfile.accessLevel,
                canApprove: dbUser.internalProfile.canApprove,
                canPublish: dbUser.internalProfile.canPublish,
                canManageUsers: dbUser.internalProfile.canManageUsers,
              }
            : null
        }
      }

      // On manual session update (e.g. after password change) — re-fetch
      if (trigger === "update" && token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          include: { internalProfile: true },
        })
        if (dbUser) {
          token.role = dbUser.role as unknown as never
          token.status = dbUser.status as unknown as never
          token.mustChangePass = dbUser.mustChangePass
          token.firstName = dbUser.firstName
          token.lastName = dbUser.lastName
          token.organization = dbUser.organization
          token.internalProfile = dbUser.internalProfile
            ? {
                employeeId: dbUser.internalProfile.employeeId,
                accessLevel: dbUser.internalProfile.accessLevel,
                canApprove: dbUser.internalProfile.canApprove,
                canPublish: dbUser.internalProfile.canPublish,
                canManageUsers: dbUser.internalProfile.canManageUsers,
              }
            : null
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string
        session.user.role = token.role as never
        session.user.status = token.status as never
        session.user.authProvider = token.authProvider as never
        session.user.mustChangePass = token.mustChangePass as boolean
        session.user.firstName = token.firstName as string | null
        session.user.lastName = token.lastName as string | null
        session.user.organization = token.organization as string | null
        session.user.internalProfile = token.internalProfile as never
      }
      return session
    },
  },

  events: {
    async signOut({ token }) {
      if (token?.userId) {
        await logActivity({
          userId: token.userId as string,
          action: "SIGN_OUT",
          resource: "auth",
        })
      }
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    newUser: "/auth/complete-profile",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,   // 8 hours
    updateAge: 60 * 60,    // 1 hour
  },
}
