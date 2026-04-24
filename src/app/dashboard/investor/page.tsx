"use client"

import { useSession } from "next-auth/react"
import { TrendingUp, Bookmark, Activity, DollarSign } from "lucide-react"

const SECTORS = ["ENERGY","TRANSPORT","WATER","DIGITAL","HEALTHCARE","EDUCATION","AGRICULTURE","OTHER"]

export default function InvestorDashboardPage() {
  const { data: session } = useSession()
  const investorType = (session?.user as Record<string, unknown> | undefined)?.investorType as string | undefined

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Investment Dashboard</h1>
          {investorType && (
            <span className="inline-flex items-center mt-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs px-3 py-1 rounded-full font-medium">
              {investorType.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Bookmark,    label: "Watchlist",         value: "—", color: "cyan"   },
          { icon: TrendingUp,  label: "New Deals (7d)",    value: "—", color: "green"  },
          { icon: Activity,    label: "Avg PETFEL Score",  value: "—", color: "blue"   },
          { icon: DollarSign,  label: "Portfolio Value",   value: "—", color: "purple" },
        ].map(({ icon: Icon, label, value, color }) => {
          const c = {
            cyan:   "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
            green:  "bg-green-500/10 border-green-500/20 text-green-400",
            blue:   "bg-blue-500/10 border-blue-500/20 text-blue-400",
            purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
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

      {/* Filters */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-slate-400 text-sm font-medium shrink-0">Filter:</span>
          <div className="flex flex-wrap gap-2">
            {SECTORS.slice(0, 5).map((s) => (
              <button key={s} className="px-3 py-1 rounded-lg text-xs border border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-400 transition">
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deal cards */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Deal Flow</h2>
        <div className="text-center py-12 text-slate-500">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No deals available yet.</p>
          <p className="text-xs mt-1">Check back once projects are approved and published.</p>
        </div>
      </div>
    </div>
  )
}
