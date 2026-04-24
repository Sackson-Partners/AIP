import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth/auth.config"
import { authRateLimit } from "@/lib/rate-limit"
import { NextRequest } from "next/server"

async function handler(
  req: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params
  // Rate-limit credential sign-in attempts only
  const isCreds = params.nextauth.join('/') === 'signin/internal-credentials'
  if (req.method === 'POST' && isCreds) {
    const limited = await authRateLimit(req)
    if (limited) return limited
  }
  return (NextAuth(authOptions) as any)(req, { params })
}

export { handler as GET, handler as POST }
