import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (
    !session?.user ||
    (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ANALYST")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [
    usersByRole,
    usersByStatus,
    projectsByStatus,
    projectsBySector,
    pendingUsers,
    pendingProjects,
    recentActivity,
    totalUsers,
    totalProjects,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.groupBy({ by: ["status"], _count: true }),
    prisma.project.groupBy({ by: ["status"], _count: true }),
    prisma.project.groupBy({ by: ["sector"], _count: true }),
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.project.count({ where: { status: "SUBMITTED" } }),
    prisma.activityLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.user.count(),
    prisma.project.count(),
  ])

  return NextResponse.json({
    usersByRole: Object.fromEntries(
      usersByRole.map((r) => [r.role, r._count])
    ),
    usersByStatus: Object.fromEntries(
      usersByStatus.map((r) => [r.status, r._count])
    ),
    projectsByStatus: Object.fromEntries(
      projectsByStatus.map((r) => [r.status, r._count])
    ),
    projectsBySector: Object.fromEntries(
      projectsBySector.map((r) => [r.sector ?? "UNKNOWN", r._count])
    ),
    pendingApprovals: pendingUsers + pendingProjects,
    pendingUsers,
    pendingProjects,
    recentActivity,
    totalUsers,
    totalProjects,
  })
}
