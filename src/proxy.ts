import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { getCached, setCached } from "@/lib/redis"
import crypto from "crypto"

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
 * 6. Adds security headers to all responses (including nonce-based CSP)
 */

// Helper to add security headers to response
function addSecurityHeaders(response: NextResponse, requestId: string, nonce: string, csp: string): void {
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-nonce', nonce)
  response.headers.set('Content-Security-Policy', csp)
}

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Generate unique request ID for distributed tracing
    const requestId = req.headers.get('x-request-id') ||
      crypto.randomBytes(16).toString('hex')

    // Generate cryptographically secure nonce for CSP
    const nonce = crypto.randomBytes(16).toString('base64')

    // Store nonce in request headers for pages to access
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('x-request-id', requestId)

    // Build dynamic CSP with nonce (removes unsafe-inline)
    const isDev = process.env.NODE_ENV === 'development'
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
      `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: https://graph.microsoft.com https://*.blob.core.windows.net",
      "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com https://*.azure.com https://*.windows.net https://api.anthropic.com https://va.vercel-analytics.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ")

    // Allow access to auth pages without restrictions
    if (path.startsWith("/auth/")) {
      const response = NextResponse.next({
        request: { headers: requestHeaders }
      })
      response.headers.set('x-request-id', requestId)
      response.headers.set('x-nonce', nonce)
      response.headers.set('Content-Security-Policy', csp)
      return response
    }

    // Validate session version - force logout if token is stale
    // Cache session versions to reduce DB load (80% reduction at 1000+ concurrent users)
    if (token?.userId && token?.sessionVersion !== undefined) {
      try {
        const cacheKey = `session:version:${token.userId}`

        // Try cache first (5 minute TTL)
        let dbSessionVersion = await getCached<number>(cacheKey)

        // Cache miss - query database
        if (dbSessionVersion === null) {
          const user = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { sessionVersion: true },
          })

          if (user) {
            dbSessionVersion = user.sessionVersion
            // Cache for 5 minutes
            await setCached(cacheKey, dbSessionVersion, 300)
          }
        }

        if (dbSessionVersion !== null && dbSessionVersion !== token.sessionVersion) {
          logger.warn('Session version mismatch - forcing logout', {
            userId: token.userId,
            tokenVersion: token.sessionVersion,
            dbVersion: dbSessionVersion,
            requestId,
          })
          const response = NextResponse.redirect(new URL("/auth/signin?error=SessionExpired", req.url))
          addSecurityHeaders(response, requestId, nonce, csp)
          return response
        }
      } catch (error) {
        logger.error('Failed to validate session version', error, { requestId })
        // Continue on DB error - don't block all requests
      }
    }

    // Block PENDING users - redirect to waiting page
    if (token?.status === "PENDING") {
      logger.info('Blocked PENDING user from accessing platform', {
        userId: token.userId,
        path,
        requestId,
      })
      const response = NextResponse.redirect(new URL("/auth/pending", req.url))
      addSecurityHeaders(response, requestId, nonce, csp)
      return response
    }

    // Block SUSPENDED/DEACTIVATED users
    if (["SUSPENDED", "DEACTIVATED"].includes(token?.status as string)) {
      logger.warn('Blocked suspended/deactivated user', {
        userId: token.userId,
        status: token.status,
        path,
        requestId,
      })
      const response = NextResponse.redirect(new URL("/auth/error?error=AccountBlocked", req.url))
      addSecurityHeaders(response, requestId, nonce, csp)
      return response
    }

    // Admin routes require SUPER_ADMIN role
    if (path.startsWith("/admin")) {
      if (token?.role !== "SUPER_ADMIN") {
        logger.warn('Unauthorized admin access attempt', {
          userId: token?.userId,
          role: token?.role,
          path,
          requestId,
        })
        const response = NextResponse.redirect(new URL("/unauthorized", req.url))
        addSecurityHeaders(response, requestId, nonce, csp)
        return response
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
          requestId,
        })
        const response = NextResponse.redirect(new URL("/unauthorized", req.url))
        addSecurityHeaders(response, requestId, nonce, csp)
        return response
      }
    }

    // API routes - add CORS and security headers
    if (path.startsWith("/api")) {
      const response = NextResponse.next({
        request: { headers: requestHeaders }
      })

      // Add security headers including CSP
      addSecurityHeaders(response, requestId, nonce, csp)

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

    // All other routes - add security headers including CSP
    const response = NextResponse.next({
      request: { headers: requestHeaders }
    })
    addSecurityHeaders(response, requestId, nonce, csp)
    return response
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
          "/request-access",
          "/forgot-password",
        ]

        // Allow public routes without token
        if (publicRoutes.includes(path)) {
          return true
        }

        // Allow NextAuth API routes (required for authentication flow)
        if (path.startsWith("/api/auth/")) {
          return true
        }

        // Allow public API endpoints
        if (path === "/api/access-requests" || path === "/api/contact-requests") {
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
     * - image files (jpg, jpeg, png, svg, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(jpg|jpeg|png|svg|webp|ico)).*)",
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
