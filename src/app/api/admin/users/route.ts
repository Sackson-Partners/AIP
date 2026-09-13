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
import { sanitizeUser, sanitizeList } from "@/lib/response-sanitizer"
import { UserRole } from "@prisma/client"
import { logger } from "@/lib/logger"

const createSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["ANALYST", "SUPER_ADMIN", "ADMIN"]),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long"),
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
    }),
    prisma.user.count({ where }),
  ])

  // Sanitize all users (admin viewing other users)
  const sanitizedUsers = sanitizeList(
    users as Record<string, any>[],
    (user) => sanitizeUser(
      user,
      session.user.role as UserRole,
      user.id === session.user.id
    )
  )

  return NextResponse.json({
    users: sanitizedUsers,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}

// ─── POST /api/admin/users ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    return NextResponse.json(
      { error: "Validation failed", details: errors },
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

  let passwordHash, employeeId, user

  try {
    [passwordHash, employeeId] = await Promise.all([
      bcrypt.hash(password, 14),
      generateEmployeeId(),
    ])
  } catch (err) {
    logger.error('Failed to generate password hash or employee ID', err, {
      adminId: session.user.id,
      targetEmail: email,
    })
    return NextResponse.json(
      { error: "Failed to process user data" },
      { status: 500 }
    )
  }

  try {
    user = await prisma.$transaction(async (tx) => {
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

    logger.info('Internal user created successfully', {
      adminId: session.user.id,
      newUserId: user.id,
      newUserEmail: email,
      newUserRole: role,
      employeeId,
    })
  } catch (err) {
    logger.error('User creation transaction failed', err, {
      adminId: session.user.id,
      targetEmail: email,
      targetRole: role,
    })
    return NextResponse.json(
      { error: "Failed to create user in database", details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }

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

  // Sanitize created user
  const sanitizedUser = sanitizeUser(
    user as Record<string, any>,
    session.user.role as UserRole,
    false
  )

  return NextResponse.json({ user: sanitizedUser }, { status: 201 })
}
