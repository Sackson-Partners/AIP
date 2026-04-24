"use client"

import { type Session } from "next-auth"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { RoleDashboardConfig } from "@/lib/auth/role-dashboard"
import { LogOut } from "lucide-react"

interface Props {
  session: Session
  roleConfig: RoleDashboardConfig
  unreadCount: number
  children: React.ReactNode
}

const COLOR_CLASSES: Record<string, { active: string; badge: string; avatar: string }> = {
  red:    { active: "bg-red-600/10 text-red-400 border-r-2 border-red-500",     badge: "bg-red-500/20 text-red-400 border-red-500/20",     avatar: "bg-red-600/20 border-red-500/30 text-red-400" },
  purple: { active: "bg-purple-600/10 text-purple-400 border-r-2 border-purple-500", badge: "bg-purple-500/20 text-purple-400 border-purple-500/20", avatar: "bg-purple-600/20 border-purple-500/30 text-purple-400" },
  blue:   { active: "bg-blue-600/10 text-blue-400 border-r-2 border-blue-500",  badge: "bg-blue-500/20 text-blue-400 border-blue-500/20",   avatar: "bg-blue-600/20 border-blue-500/30 text-blue-400" },
  green:  { active: "bg-green-600/10 text-green-400 border-r-2 border-green-500", badge: "bg-green-500/20 text-green-400 border-green-500/20", avatar: "bg-green-600/20 border-green-500/30 text-green-400" },
  yellow: { active: "bg-yellow-600/10 text-yellow-400 border-r-2 border-yellow-500", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/20", avatar: "bg-yellow-600/20 border-yellow-500/30 text-yellow-400" },
  cyan:   { active: "bg-cyan-600/10 text-cyan-400 border-r-2 border-cyan-500",  badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/20",   avatar: "bg-cyan-600/20 border-cyan-500/30 text-cyan-400" },
}

export function DashboardShell({ session, roleConfig, unreadCount, children }: Props) {
  const pathname = usePathname()
  const colors = COLOR_CLASSES[roleConfig.color] ?? COLOR_CLASSES.blue
  const user = session.user

  const initials =
    (
      (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "") ||
      user.email?.[0]?.toUpperCase()
    ) ?? "U"

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-slate-950 border-r border-slate-800/50">
        <div className="px-5 py-5 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-lg tracking-tight">AIP</span>
            <span className={`border text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${colors.badge}`}>
              {roleConfig.label}
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {roleConfig.navItems.map(({ label, href }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? colors.active
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800/50">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${colors.avatar}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {user.firstName ? `${user.firstName} ${user.lastName ?? ""}` : user.email}
              </p>
              <p className="text-slate-500 text-[10px]">{roleConfig.label}</p>
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-lg text-xs transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-900">{children}</main>
    </div>
  )
}
