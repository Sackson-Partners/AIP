import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { sendPasswordResetEmail } from "@/lib/email"

function generateTempPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@$!%*?&"
  return Array.from(randomBytes(16))
    .map((b) => chars[b % chars.length])
    .join("")
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, authProvider: true },
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (user.authProvider !== "INTERNAL") {
    return NextResponse.json(
      { error: "Password reset only applies to internal accounts" },
      { status: 400 }
    )
  }

  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 14)

  await prisma.user.update({
    where: { id: id },
    data: { passwordHash, mustChangePass: true },
  })

  if (user.email) {
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name ?? user.email,
      temporaryPassword: tempPassword,
    }).catch(() => {})
  }

  await createAuditLog({
    userId: session.user.id,
    email: session.user.email ?? undefined,
    action: "RESET_PASSWORD",
    tableName: "User",
    recordId: id,
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
  })

  return NextResponse.json({ success: true })
}
