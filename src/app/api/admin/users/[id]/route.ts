import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { sendActivationEmail, sendSuspensionEmail } from "@/lib/email"

const userInclude = {
  internalProfile: true,
  investorProfile: true,
  governmentProfile: true,
  sponsorProfile: true,
  ePCProfile: true,
  activityLogs: { orderBy: { createdAt: "desc" as const }, take: 10 },
  _count: { select: { ownedProjects: true } },
}

// ─── GET /api/admin/users/[id] ────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: userInclude,
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...safeUser } = user as Record<string, unknown> & {
    passwordHash?: string
  }
  return NextResponse.json({ user: safeUser })
}

// ─── PATCH /api/admin/users/[id] ──────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { internalProfile: true },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const allowed = ["role", "status", "organization", "country", "jobTitle"]
  const userUpdate: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) userUpdate[key] = body[key]
  }

  const updated = await prisma.user.update({
    where: { id: id },
    data: userUpdate,
    include: userInclude,
  })

  // Update internal profile permissions if provided
  if (body.internalProfile && existing.internalProfile) {
    const { canApprove, canPublish, canManageUsers, accessLevel } =
      body.internalProfile as Record<string, unknown>
    await prisma.internalProfile.update({
      where: { userId: id },
      data: {
        ...(canApprove !== undefined && { canApprove: Boolean(canApprove) }),
        ...(canPublish !== undefined && { canPublish: Boolean(canPublish) }),
        ...(canManageUsers !== undefined && {
          canManageUsers: Boolean(canManageUsers),
        }),
        ...(accessLevel !== undefined && {
          accessLevel: Number(accessLevel),
        }),
      },
    })
  }

  // Side effects on status change
  if (body.status && body.status !== existing.status) {
    if (body.status === "ACTIVE" && existing.email) {
      await sendActivationEmail({
        email: existing.email,
        name: existing.name ?? existing.email,
      }).catch(() => {})
    }
    if (body.status === "SUSPENDED" && existing.email) {
      await sendSuspensionEmail({
        email: existing.email,
        name: existing.name ?? existing.email,
        reason: body.reason as string | undefined,
      }).catch(() => {})
    }
  }

  await createAuditLog({
    userId: session.user.id,
    email: session.user.email ?? undefined,
    action: "UPDATE_USER",
    tableName: "User",
    recordId: id,
    oldValues: userUpdate
      ? Object.fromEntries(
          Object.keys(userUpdate).map((k) => [
            k,
            (existing as Record<string, unknown>)[k],
          ])
        )
      : undefined,
    newValues: userUpdate,
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash2, ...safeUser } = updated as Record<string, unknown> & {
    passwordHash?: string
  }
  return NextResponse.json({ user: safeUser })
}

// ─── DELETE /api/admin/users/[id] — soft delete ───────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Never hard-delete — set status to DEACTIVATED
  await prisma.user.update({
    where: { id: id },
    data: { status: "DEACTIVATED" },
  })

  await createAuditLog({
    userId: session.user.id,
    email: session.user.email ?? undefined,
    action: "DEACTIVATE_USER",
    tableName: "User",
    recordId: id,
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
  })

  return NextResponse.json({ message: "User deactivated" })
}
