"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { NavItem } from "@/lib/auth/role-dashboard"

interface Props {
  navItems: NavItem[]
  color: string
  pendingCount?: number
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const COLOR_ACTIVE: Record<string, string> = {
  red:    "bg-red-600/10 text-red-400 border-r-2 border-red-500",
  purple: "bg-purple-600/10 text-purple-400 border-r-2 border-purple-500",
  blue:   "bg-blue-600/10 text-blue-400 border-r-2 border-blue-500",
  green:  "bg-green-600/10 text-green-400 border-r-2 border-green-500",
  yellow: "bg-yellow-600/10 text-yellow-400 border-r-2 border-yellow-500",
  cyan:   "bg-cyan-600/10 text-cyan-400 border-r-2 border-cyan-500",
}

export function Sidebar({ navItems, color, pendingCount = 0, collapsed = false }: Props) {
  const pathname = usePathname()
  const activeClass = COLOR_ACTIVE[color] ?? COLOR_ACTIVE.blue

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {navItems.map(({ label, href, badge }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/")
        const showBadge = badge === "pending" && pendingCount > 0

        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
              isActive ? activeClass : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            {!collapsed && <span className="flex-1">{label}</span>}
            {showBadge && (
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {pendingCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
