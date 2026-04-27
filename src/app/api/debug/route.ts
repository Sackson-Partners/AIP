import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Temporary diagnostics endpoint — excluded from auth middleware
// Remove once sign-in is confirmed working
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")

  try {
    // Basic connectivity check
    const userCount = await prisma.user.count()

    if (!email) {
      return NextResponse.json({ status: "ok", dbConnection: "success", userCount })
    }

    // Full query that mirrors the JWT callback
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        authProvider: true,
        mustChangePass: true,
        passwordHash: true,
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

    if (!user) {
      return NextResponse.json({ status: "ok", dbConnection: "success", userCount, user: null })
    }

    return NextResponse.json({
      status: "ok",
      dbConnection: "success",
      userCount,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        authProvider: user.authProvider,
        mustChangePass: user.mustChangePass,
        hasPasswordHash: !!user.passwordHash,
        hasInternalProfile: !!user.internalProfile,
        internalProfile: user.internalProfile,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[/api/debug] error:", err)
    return NextResponse.json({ status: "error", error: message }, { status: 500 })
  }
}
