import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { JWT } from "next-auth/jwt"

// Routes accessible only by specific roles (string literals — no @prisma/client import in Edge runtime)
const ROLE_ROUTES: Record<string, string[]> = {
  "/admin":    ["SUPER_ADMIN"],
  "/analyst":  ["ANALYST", "SUPER_ADMIN"],
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  return response
}

export default withAuth(
  function middleware(req: NextRequest & { nextauth: { token: JWT | null } }) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // ── Pending users ────────────────────────────────────────────────────────────
    if (token?.status === "PENDING" && pathname !== "/auth/pending" && !pathname.startsWith("/api/")) {
      const url = req.nextUrl.clone()
      url.pathname = "/auth/pending"
      return addSecurityHeaders(NextResponse.redirect(url))
    }

    // ── Force password change ────────────────────────────────────────────────────
    if (
      token?.mustChangePass === true &&
      pathname !== "/auth/change-password" &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/auth/")
    ) {
      const url = req.nextUrl.clone()
      url.pathname = "/auth/change-password"
      return addSecurityHeaders(NextResponse.redirect(url))
    }

    // ── Role-based route protection ──────────────────────────────────────────────
    for (const [prefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
      if (pathname.startsWith(prefix)) {
        const userRole = token?.role as string | undefined
        if (!userRole || !allowedRoles.includes(userRole)) {
          const url = req.nextUrl.clone()
          url.pathname = "/unauthorized"
          return addSecurityHeaders(NextResponse.redirect(url))
        }
        break
      }
    }

    return addSecurityHeaders(NextResponse.next())
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token
      },
    },
    pages: {
      signIn: "/auth/signin",
      error:  "/auth/error",
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static assets)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - public image/font files
     * - auth routes (handled by NextAuth)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$|api/auth|api/debug|auth/pending|unauthorized).*)",
  ],
}
