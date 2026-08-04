import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Block PENDING users from accessing anything except auth pages
    if (token?.status === "PENDING" && !path.startsWith("/auth/pending")) {
      return NextResponse.redirect(new URL("/auth/pending", req.url))
    }

    // Block SUSPENDED/DEACTIVATED users
    if (
      token?.status &&
      ["SUSPENDED", "DEACTIVATED"].includes(token.status as string) &&
      !path.startsWith("/auth/error")
    ) {
      return NextResponse.redirect(
        new URL("/auth/error?error=AccountBlocked", req.url)
      )
    }

    // Force password change if required
    if (
      token?.mustChangePass &&
      !path.startsWith("/auth/change-password") &&
      !path.startsWith("/api/auth")
    ) {
      return NextResponse.redirect(new URL("/auth/change-password", req.url))
    }

    // Admin routes - only SUPER_ADMIN
    if (path.startsWith("/admin") && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }

    // Analyst routes - SUPER_ADMIN, ADMIN, ANALYST
    const analystRoles = ["SUPER_ADMIN", "ADMIN", "ANALYST"]
    if (
      path.startsWith("/analytics") &&
      !analystRoles.includes(token?.role as string)
    ) {
      return NextResponse.redirect(new URL("/unauthorized", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Public routes that don't require auth
        const publicPaths = ["/", "/auth/signin", "/auth/error", "/auth/signup"]
        if (publicPaths.includes(req.nextUrl.pathname)) {
          return true
        }

        // All other routes require authentication
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
