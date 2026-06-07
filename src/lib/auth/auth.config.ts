import type { NextAuthOptions } from "next-auth"
import type { Adapter } from "next-auth/adapters"
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

// PrismaAdapter returns @auth/core's Adapter; next-auth v4 expects next-auth/adapters Adapter.
// These are structurally incompatible (different AdapterAccount types across packages).
// Bridge via unknown — this is intentional, not a lazy cast.
const baseAdapter = PrismaAdapter(prisma) as unknown as Adapter
const safeAdapter = {
  ...baseAdapter,
  async linkAccount(account: Record<string, unknown>) {
    const clean = Object.fromEntries(
      Object.entries(account).filter(([k]) => KNOWN_ACCOUNT_FIELDS.has(k))
    )
    const fn = baseAdapter.linkAccount as unknown as (a: Record<string, unknown>) => Promise<unknown>
    try {
      return await fn?.(clean)
    } catch (err) {
      console.error('[linkAccount] failed to link Azure AD account: %o', err)
      // Don't block sign-in if account linking fails — user row already exists
      return
    }
  },
}

export const authOptions: NextAuthOptions = {
  adapter: safeAdapter as unknown as Adapter,

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
    // Azure AD provider — only enabled if credentials are configured
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
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
        ]
      : []),

    CredentialsProvider({
      id: "internal-credentials",
      name: "Internal Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "TOTP Code", type: "text" },
      },
      async authorize(credentials, req) {
        const MAX_ATTEMPTS = 10
        const LOCKOUT_MINUTES = 15

        if (!credentials?.email || !credentials?.password) {
          throw new Error("EMAIL_PASSWORD_REQUIRED")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { internalProfile: true },
        })

        if (!user) throw new Error("INVALID_CREDENTIALS")

        if (user.authProvider === "AZURE_AD") throw new Error("USE_AZURE_LOGIN")

        // Check lockout before doing any expensive work
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED")
        }

        if (!user.passwordHash) throw new Error("INVALID_CREDENTIALS")

        const passwordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!passwordValid) {
          const attempts = user.failedLoginAttempts + 1
          const shouldLock = attempts >= MAX_ATTEMPTS
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              ...(shouldLock && {
                lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
              }),
            },
          })
          throw new Error(shouldLock ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS")
        }

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
            failedLoginAttempts: 0,
            lockedUntil: null,
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
        console.log('[signIn azure-ad] email=%s oid=%s', email, user.azureOid)
        if (!email) {
          console.error('[signIn azure-ad] no email on token')
          return false
        }

        const azureOid = user.azureOid
        let existing = null
        try {
          existing = await prisma.user.findFirst({
            where: {
              OR: [
                { email },
                ...(azureOid ? [{ azureOid }] : []),
              ],
            },
          })
        } catch (err) {
          console.error('[signIn azure-ad] DB lookup failed: %o', err)
          return false
        }

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
            azureOid: user.azureOid,
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
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              role: true,
              status: true,
              authProvider: true,
              mustChangePass: true,
              firstName: true,
              lastName: true,
              organization: true,
              internalProfile: {
                select: {
                  employeeId: true,
                  accessLevel: true,
                  canApprove: true,
                  canPublish: true,
                  canManageUsers: true,
                },
              },
            },
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
            token.internalProfile = dbUser.internalProfile ?? null
          }
        } catch (err) {
          console.error('[JWT callback] prisma.user.findUnique failed for id=%s: %o', user.id, err)
          // Still populate token with basic info so the sign-in doesn't fail completely
          token.userId = user.id
        }
      }

      // On manual session update (e.g. after password change) — re-fetch
      if (trigger === "update" && token.userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: {
              role: true,
              status: true,
              mustChangePass: true,
              firstName: true,
              lastName: true,
              organization: true,
              internalProfile: {
                select: {
                  employeeId: true,
                  accessLevel: true,
                  canApprove: true,
                  canPublish: true,
                  canManageUsers: true,
                },
              },
            },
          })
          if (dbUser) {
            token.role = dbUser.role as unknown as never
            token.status = dbUser.status as unknown as never
            token.mustChangePass = dbUser.mustChangePass
            token.firstName = dbUser.firstName
            token.lastName = dbUser.lastName
            token.organization = dbUser.organization
            token.internalProfile = dbUser.internalProfile ?? null
          }
        } catch (err) {
          console.error('[JWT callback] prisma.user.findUnique (update trigger) failed: %o', err)
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
