import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

/**
 * Global middleware for authentication and authorization
 * Runs at the edge before any page or API route handler
 *
 * This middleware:
 * 1. Checks authentication on all protected routes
 * 2. Validates session version (forces logout on password/role change)
 * 3. Blocks PENDING users from accessing the platform
 * 4. Blocks SUSPENDED/DEACTIVATED users
 * 5. Enforces role-based access to admin routes
 * 6. Adds security headers to all responses
 */

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Allow access to auth pages without restrictions
    if (path.startsWith("/auth/")) {
      return NextResponse.next()
    }

    // Validate session version - force logout if token is stale
    if (token?.userId && token?.sessionVersion !== undefined) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { sessionVersion: true },
        })

        if (user && user.sessionVersion !== token.sessionVersion) {
          logger.warn('Session version mismatch - forcing logout', {
            userId: token.userId,
            tokenVersion: token.sessionVersion,
            dbVersion: user.sessionVersion,
          })
          return NextResponse.redirect(new URL("/auth/signin?error=SessionExpired", req.url))
        }
      } catch (error) {
        logger.error('Failed to validate session version', error)
        // Continue on DB error - don't block all requests
      }
    }

    // Block PENDING users - redirect to waiting page
    if (token?.status === "PENDING") {
      logger.info('Blocked PENDING user from accessing platform', {
        userId: token.userId,
        path,
      })
      return NextResponse.redirect(new URL("/auth/pending", req.url))
    }

    // Block SUSPENDED/DEACTIVATED users
    if (["SUSPENDED", "DEACTIVATED"].includes(token?.status as string)) {
      logger.warn('Blocked suspended/deactivated user', {
        userId: token.userId,
        status: token.status,
        path,
      })
      return NextResponse.redirect(new URL("/auth/error?error=AccountBlocked", req.url))
    }

    // Admin routes require SUPER_ADMIN role
    if (path.startsWith("/admin")) {
      if (token?.role !== "SUPER_ADMIN") {
        logger.warn('Unauthorized admin access attempt', {
          userId: token?.userId,
          role: token?.role,
          path,
        })
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }
    }

    // Analyst routes require ADMIN or ANALYST
    if (path.startsWith("/analytics") || path.startsWith("/reports")) {
      const allowedRoles = ["SUPER_ADMIN", "ADMIN", "ANALYST"]
      if (!allowedRoles.includes(token?.role as string)) {
        logger.warn('Unauthorized analytics access attempt', {
          userId: token?.userId,
          role: token?.role,
          path,
        })
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }
    }

    // API routes - add CORS and security headers
    if (path.startsWith("/api")) {
      const response = NextResponse.next()

      // Add security headers to all API responses
      response.headers.set("X-Content-Type-Options", "nosniff")
      response.headers.set("X-Frame-Options", "DENY")
      response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

      // CORS headers for allowed origins
      const origin = req.headers.get("origin")
      const allowedOrigins = [
        "https://app.africa-infra.com",
        "https://www.africa-infra.com",
        ...(process.env.NODE_ENV === "development"
          ? ["http://localhost:3000", "http://localhost:3005"]
          : []
        ),
      ]

      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin)
        response.headers.set("Access-Control-Allow-Credentials", "true")
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
      }

      return response
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Require authentication for all routes except public pages
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname

        // Public routes that don't require auth
        const publicRoutes = [
          "/",
          "/auth/signin",
          "/auth/signup",
          "/auth/error",
          "/auth/pending",
          "/unauthorized",
        ]

        // Allow public routes without token
        if (publicRoutes.includes(path)) {
          return true
        }

        // All other routes require authentication
        return !!token
      },
    },
  }
)

// Configure which routes this middleware protects
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}

/**
 * Handle preflight OPTIONS requests for CORS
 * This is a separate export because withAuth doesn't handle OPTIONS
 */
export function middleware(req: NextRequest) {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 })

    const origin = req.headers.get("origin")
    const allowedOrigins = [
      "https://app.africa-infra.com",
      "https://www.africa-infra.com",
      ...(process.env.NODE_ENV === "development"
        ? ["http://localhost:3000", "http://localhost:3005"]
        : []
      ),
    ]

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin)
      response.headers.set("Access-Control-Allow-Credentials", "true")
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
      response.headers.set("Access-Control-Max-Age", "86400")
    }

    return response
  }

  // All other requests go through withAuth
  return NextResponse.next()
}
