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
  type AppHandler = (req: NextRequest, ctx: { params: Record<string, string[]> }) => Promise<Response>
  return (NextAuth(authOptions) as unknown as AppHandler)(req, { params })
}

export { handler as GET, handler as POST }
