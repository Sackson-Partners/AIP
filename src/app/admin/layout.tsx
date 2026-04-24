import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import Link from "next/link"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  BarChart3,
  ClipboardList,
  Settings2,
} from "lucide-react"
import { AdminSignOut } from "./admin-sign-out"

async function getPendingCount() {
  return prisma.user.count({ where: { status: "PENDING" } })
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/unauthorized")
  }

  const pendingCount = await getPendingCount()

  const navItems = [
    { label: "Overview",  href: "/admin",          icon: LayoutDashboard },
    { label: "Users",     href: "/admin/users",     icon: Users, badge: pendingCount },
    { label: "Projects",  href: "/dashboard/projects",  icon: FolderOpen },
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "Audit Log", href: "/admin/audit",     icon: ClipboardList },
    { label: "Settings",  href: "/admin/settings",  icon: Settings2 },
  ]

  const initials =
    (
      (session.user.firstName?.[0] ?? "") +
      (session.user.lastName?.[0] ?? "") ||
      session.user.email?.[0]?.toUpperCase()
    ) ?? "A"

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-slate-950 border-r border-slate-800/50">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-lg tracking-tight">AIP</span>
            <span className="bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Admin
            </span>
          </div>
          <p className="text-slate-600 text-xs mt-0.5">Africa Infrastructure Pipeline</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, href, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition group"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-slate-800/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {session.user.firstName
                  ? `${session.user.firstName} ${session.user.lastName ?? ""}`
                  : session.user.email}
              </p>
              <p className="text-slate-500 text-[10px]">Super Admin</p>
            </div>
          </div>
          <AdminSignOut />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-900">{children}</main>
    </div>
  )
}
