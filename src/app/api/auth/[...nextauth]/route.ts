import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth/auth.config"

// NextAuth v4 compatibility shim for Next.js 15+ async params/cookies API
async function handler(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params
  return (NextAuth(authOptions) as any)(req, { params })
}

export { handler as GET, handler as POST }
