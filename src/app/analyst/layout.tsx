import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import Link from "next/link"
import { authOptions } from "@/lib/auth/auth.config"
import {
  LayoutDashboard, FolderSearch, Activity, FileText, Brain,
} from "lucide-react"
import { AnalystSignOut } from "./analyst-sign-out"

export default async function AnalystLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (
    !session?.user ||
    (session.user.role !== "ANALYST" && session.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/unauthorized")
  }

  const navItems = [
    { label: "Dashboard",   href: "/analyst",          icon: LayoutDashboard },
    { label: "Projects",    href: "/analyst/projects",  icon: FolderSearch },
    { label: "PETFEL",      href: "/analyst/petfel",    icon: Activity },
    { label: "EIN Reports", href: "/analyst/ein",       icon: FileText },
    { label: "AI Memos",    href: "/analyst/memos",     icon: Brain },
  ]

  const initials =
    (
      (session.user.firstName?.[0] ?? "") +
      (session.user.lastName?.[0] ?? "") ||
      session.user.email?.[0]?.toUpperCase()
    ) ?? "A"

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col bg-slate-950 border-r border-slate-800/50">
        <div className="px-5 py-5 border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-lg tracking-tight">AIP</span>
            <span className="bg-purple-500/20 text-purple-400 border border-purple-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Analyst
            </span>
          </div>
          <p className="text-slate-600 text-xs mt-0.5">Africa Infrastructure Pipeline</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {session.user.firstName
                  ? `${session.user.firstName} ${session.user.lastName ?? ""}`
                  : session.user.email}
              </p>
              <p className="text-slate-500 text-[10px]">
                {session.user.internalProfile?.employeeId ?? "Analyst"}
              </p>
            </div>
          </div>
          <AnalystSignOut />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-900">{children}</main>
    </div>
  )
}
