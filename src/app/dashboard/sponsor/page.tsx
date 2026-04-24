"use client"

import { useSession } from "next-auth/react"
import { FolderOpen, Activity, DollarSign, FileText } from "lucide-react"
import Link from "next/link"

const QUICK_ACTIONS = [
  { label: "Run PETFEL Analysis",  href: "/dashboard/petfel",   color: "blue"   },
  { label: "Generate EIN",         href: "/dashboard/ein",      color: "green"  },
  { label: "Open Deal Room",       href: "/dashboard/dealroom", color: "purple" },
  { label: "Invite Investors",     href: "/dashboard/capital",  color: "amber"  },
]

export default function SponsorDashboardPage() {
  const { data: session } = useSession()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Sponsor Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          {session?.user?.organization ?? "Project Developer"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: FolderOpen, label: "Active Projects",    value: "—", color: "green"  },
          { icon: Activity,   label: "Avg PETFEL Score",   value: "—", color: "blue"   },
          { icon: DollarSign, label: "Capital Raised",     value: "—", color: "purple" },
          { icon: FileText,   label: "EIN Reports",        value: "—", color: "amber"  },
        ].map(({ icon: Icon, label, value, color }) => {
          const c = {
            blue:   "bg-blue-500/10 border-blue-500/20 text-blue-400",
            green:  "bg-green-500/10 border-green-500/20 text-green-400",
            purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
            amber:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
          }[color]
          return (
            <div key={label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">{label}</p>
                  <p className="text-white text-2xl font-bold">{value}</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${c}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map(({ label, href, color }) => {
            const c = {
              blue:   "border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
              green:  "border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20",
              purple: "border-purple-500/20 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
              amber:  "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
            }[color]
            return (
              <Link key={label} href={href}
                className={`flex items-center justify-center p-4 rounded-xl border font-medium text-sm transition ${c}`}>
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Portfolio placeholder */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Project Portfolio</h2>
        <p className="text-slate-500 text-sm">No projects yet.</p>
        <Link href="/dashboard/projects/new"
          className="inline-block mt-3 text-green-400 hover:text-green-300 text-sm">
          Submit your first project →
        </Link>
      </div>
    </div>
  )
}
