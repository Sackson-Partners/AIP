import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { JWT } from "next-auth/jwt"

// ── Admin-only dashboard routes ────────────────────────────────────────────────
const ADMIN_ONLY_ROUTES = [
  '/dashboard/admin',
  '/dashboard/users',
  '/dashboard/integrations',
]

// ── Feature route → required permission ───────────────────────────────────────
const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: '/dashboard/verifications',  permission: 'view_verifications'        },
  { prefix: '/dashboard/deal-rooms',     permission: 'view_deal_room'            },
  { prefix: '/dashboard/data-rooms',     permission: 'view_data_room'            },
  { prefix: '/dashboard/ein',            permission: 'view_ein_reports'          },
  { prefix: '/dashboard/analytics',      permission: 'view_analytic_reports'     },
  { prefix: '/dashboard/investors',      permission: 'view_partners'             },
  { prefix: '/dashboard/pipeline',       permission: 'view_pipeline'             },
  { prefix: '/dashboard/ic',             permission: 'vote_ic'                   },
  { prefix: '/dashboard/petfel',         permission: 'run_petfel'                },
  { prefix: '/dashboard/pestel',         permission: 'run_petfel'                },
  { prefix: '/dashboard/events',         permission: 'view_events'               },
  { prefix: '/dashboard/messages',       permission: 'message_partners_internal' },
]

// ── Permissions per role (dashboard route guards only) ─────────────────────────
const ROLE_ROUTE_PERMISSIONS: Record<string, Set<string>> = {
  SUPER_ADMIN: new Set([
    'view_verifications', 'view_deal_room', 'view_data_room', 'view_ein_reports',
    'view_analytic_reports', 'view_partners', 'view_pipeline', 'vote_ic',
    'run_petfel', 'view_events', 'manage_users',
  ]),
  ADMIN: new Set([
    'view_verifications', 'view_deal_room', 'view_data_room', 'view_ein_reports',
    'view_analytic_reports', 'view_partners', 'view_pipeline', 'vote_ic',
    'run_petfel', 'view_events', 'manage_users',
  ]),
  ANALYST: new Set([
    'view_verifications', 'view_deal_room', 'view_data_room', 'view_ein_reports',
    'view_analytic_reports', 'view_partners', 'view_pipeline', 'vote_ic',
    'run_petfel', 'view_events',
  ]),
  GOVERNMENT: new Set([
    'view_verifications', 'view_deal_room', 'view_data_room', 'view_ein_reports',
    'view_analytic_reports', 'view_partners', 'view_pipeline', 'view_events',
    'message_partners_internal',
  ]),
  SPONSOR_DEVELOPER: new Set([
    'view_verifications', 'view_deal_room', 'view_data_room', 'view_ein_reports',
    'view_analytic_reports', 'view_partners', 'view_pipeline', 'view_events',
    'message_partners_internal',
  ]),
  EPC_OPERATOR: new Set([
    'view_verifications', 'view_deal_room', 'view_data_room', 'view_ein_reports',
    'view_analytic_reports', 'view_partners', 'view_pipeline', 'view_events',
    'message_partners_internal',
  ]),
  INSTITUTIONAL_INVESTOR: new Set([
    'view_verifications', 'view_deal_room', 'view_data_room', 'view_ein_reports',
    'view_analytic_reports', 'view_partners', 'view_pipeline', 'view_events',
    'message_partners_internal',
  ]),
}

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN'])

// ── Legacy top-level role routes ───────────────────────────────────────────────
const ROLE_ROUTES: Record<string, string[]> = {
  "/admin":   ["SUPER_ADMIN"],
  "/analyst": ["ANALYST", "SUPER_ADMIN"],
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
    const role  = (token?.role as string | undefined) ?? ''

    // ── Pending users ──────────────────────────────────────────────────────────
    if (token?.status === "PENDING" && pathname !== "/auth/pending" && !pathname.startsWith("/api/")) {
      const url = req.nextUrl.clone()
      url.pathname = "/auth/pending"
      return addSecurityHeaders(NextResponse.redirect(url))
    }

    // ── Force password change ──────────────────────────────────────────────────
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

    // ── Dashboard: admin-only routes ───────────────────────────────────────────
    if (ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
      if (!ADMIN_ROLES.has(role)) {
        return addSecurityHeaders(NextResponse.redirect(new URL('/unauthorized', req.url)))
      }
      return addSecurityHeaders(NextResponse.next())
    }

    // ── Dashboard: feature-level route guards ──────────────────────────────────
    if (pathname.startsWith('/dashboard/')) {
      const routeRule = ROUTE_PERMISSIONS.find(r => pathname.startsWith(r.prefix))
      if (routeRule) {
        const allowed = ROLE_ROUTE_PERMISSIONS[role]?.has(routeRule.permission) ?? false
        if (!allowed) {
          return addSecurityHeaders(NextResponse.redirect(new URL('/unauthorized', req.url)))
        }
      }
    }

    // ── Legacy role-based prefixes ─────────────────────────────────────────────
    for (const [prefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
      if (pathname.startsWith(prefix)) {
        if (!role || !allowedRoles.includes(role)) {
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
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$|api/auth|api/debug|auth/pending|unauthorized).*)",
  ],
}
