import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { sendWelcomeEmail } from "@/lib/email"
import { generateEmployeeId } from "@/lib/utils/ids"

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["ANALYST", "SUPER_ADMIN"]),
  password: z
    .string()
    .min(12)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[@$!%*?&]/),
  department: z.string().optional(),
  accessLevel: z.number().int().min(1).max(10).default(1),
  canApprove: z.boolean().default(false),
  canPublish: z.boolean().default(false),
  canManageUsers: z.boolean().default(false),
})

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)))
  const search = searchParams.get("search") ?? ""
  const role = searchParams.get("role") ?? ""
  const status = searchParams.get("status") ?? ""

  const where = {
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
            { organization: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role ? { role: role as never } : {}),
    ...(status ? { status: status as never } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        authProvider: true,
        organization: true,
        lastLoginAt: true,
        createdAt: true,
        internalProfile: { select: { employeeId: true, accessLevel: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}

// ─── POST /api/admin/users ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    )
  }

  const {
    email,
    firstName,
    lastName,
    role,
    password,
    department,
    accessLevel,
    canApprove,
    canPublish,
    canManageUsers,
  } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    )
  }

  const [passwordHash, employeeId] = await Promise.all([
    bcrypt.hash(password, 14),
    generateEmployeeId(),
  ])

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        role: role as never,
        status: "ACTIVE",
        authProvider: "INTERNAL",
        passwordHash,
        mustChangePass: true,
        emailVerified: new Date(),
        createdBy: session.user.id,
      },
    })
    await tx.internalProfile.create({
      data: {
        userId: u.id,
        employeeId,
        department,
        accessLevel,
        canApprove,
        canPublish,
        canManageUsers,
      },
    })
    return u
  })

  // Best-effort email — don't fail the request if SMTP is not configured
  await sendWelcomeEmail({
    email,
    name: `${firstName} ${lastName}`,
    role,
    temporaryPassword: password,
    employeeId,
  }).catch(() => {})

  await createAuditLog({
    userId: session.user.id,
    email: session.user.email ?? undefined,
    action: "CREATE_INTERNAL_USER",
    tableName: "User",
    recordId: user.id,
    newValues: { email, role, employeeId },
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
  })

  // Return without passwordHash
  const { ...safeUser } = user as Record<string, unknown>
  delete safeUser.passwordHash

  return NextResponse.json({ user: safeUser }, { status: 201 })
}
