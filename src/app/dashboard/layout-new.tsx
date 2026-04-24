/**
 * layout-new.tsx — NEW role-aware dashboard layout (NextAuth-based)
 *
 * Per Decision 7: created as layout-new.tsx. Swap to layout.tsx with approval.
 *
 * Differences from existing layout.tsx:
 * - Uses getServerSession(authOptions) instead of Supabase
 * - Loads role-specific nav from ROLE_DASHBOARD_CONFIG
 * - Includes notifications bell and user avatar menu
 */
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth.config"
import { ROLE_DASHBOARD_CONFIG } from "@/lib/auth/role-dashboard"
import { prisma } from "@/lib/prisma"
import { DashboardShell } from "@/components/layout/DashboardShell"

async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } })
}

export default async function DashboardLayoutNew({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) redirect("/auth/signin")
  if (session.user.status === "PENDING") redirect("/auth/pending")
  if (session.user.mustChangePass) redirect("/auth/change-password")

  const roleConfig = ROLE_DASHBOARD_CONFIG[
    session.user.role as keyof typeof ROLE_DASHBOARD_CONFIG
  ]
  if (!roleConfig) redirect("/auth/signin")

  const unreadCount = await getUnreadCount(session.user.id)

  return (
    <DashboardShell
      session={session}
      roleConfig={roleConfig}
      unreadCount={unreadCount}
    >
      {children}
    </DashboardShell>
  )
}
