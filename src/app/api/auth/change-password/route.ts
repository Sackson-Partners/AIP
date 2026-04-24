import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[@$!%*?&]/, "Must contain a special character (@$!%*?&)"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.authProvider !== "INTERNAL") {
    return NextResponse.json(
      { error: "Password change is only available for internal accounts" },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Account error" }, { status: 400 })
  }

  const valid = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash
  )
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    )
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 14)

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hash, mustChangePass: false },
  })

  await createAuditLog({
    userId: session.user.id,
    email: session.user.email ?? undefined,
    action: "PASSWORD_CHANGE",
    tableName: "User",
    recordId: session.user.id,
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
  })

  return NextResponse.json({ success: true })
}
