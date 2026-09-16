import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import crypto from "crypto";

const CSRF_HEADER = "x-csrf-token";
const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still run timingSafeEqual to maintain constant time
    crypto.timingSafeEqual(
      Buffer.from(a.padEnd(64, "0")),
      Buffer.from(b.padEnd(64, "0"))
    );
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Validate CSRF token on state-changing requests
 *
 * Returns null if validation passes, NextResponse error if validation fails
 */
export async function validateCsrf(req: NextRequest): Promise<NextResponse | null> {
  // Skip CSRF check for safe methods
  if (CSRF_SAFE_METHODS.has(req.method)) {
    return null;
  }

  const session = await getServerSession(authOptions);

  // If not authenticated, let the route handler deal with auth
  if (!session?.user) {
    return null;
  }

  const csrfTokenFromHeader = req.headers.get(CSRF_HEADER);

  if (!csrfTokenFromHeader) {
    return NextResponse.json(
      {
        error: "CSRF token missing. Include X-CSRF-Token header.",
        code: "CSRF_TOKEN_MISSING"
      },
      { status: 403 }
    );
  }

  // Get CSRF token from session
  const sessionCsrfToken = (session as any).csrfToken as string | undefined;

  if (!sessionCsrfToken) {
    return NextResponse.json(
      {
        error: "Session CSRF token not found. Please re-authenticate.",
        code: "CSRF_SESSION_TOKEN_MISSING"
      },
      { status: 403 }
    );
  }

  // Constant-time comparison
  if (!safeCompare(csrfTokenFromHeader, sessionCsrfToken)) {
    return NextResponse.json(
      { error: "Invalid CSRF token.", code: "CSRF_TOKEN_INVALID" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Higher-order function to wrap route handlers with CSRF protection
 *
 * Usage:
 * ```typescript
 * import { withCsrf } from "@/lib/csrf";
 *
 * async function handlePost(req: NextRequest) {
 *   // Your logic here
 * }
 *
 * export const POST = withCsrf(handlePost);
 * ```
 */
export function withCsrf<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    const csrfError = await validateCsrf(req);
    if (csrfError) return csrfError;
    return handler(req, context);
  };
}
