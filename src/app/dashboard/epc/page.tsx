"use client"

import { FolderOpen, AlertCircle, Map, Users } from "lucide-react"

export default function EPCDashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">EPC Pipeline Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Engineering, Procurement & Construction</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: FolderOpen,   label: "Available Projects",        value: "—", color: "yellow" },
          { icon: AlertCircle,  label: "Tender Deadlines (7 days)", value: "—", color: "red"    },
          { icon: Map,          label: "Active Corridors",          value: "—", color: "blue"   },
          { icon: Users,        label: "Partner Network",           value: "—", color: "green"  },
        ].map(({ icon: Icon, label, value, color }) => {
          const c = {
            yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
            red:    "bg-red-500/10 border-red-500/20 text-red-400",
            blue:   "bg-blue-500/10 border-blue-500/20 text-blue-400",
            green:  "bg-green-500/10 border-green-500/20 text-green-400",
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline table */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Project Pipeline</h2>
          <p className="text-slate-500 text-sm">No projects available at this time.</p>
        </div>

        {/* Upcoming tenders */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Upcoming Tenders</h2>
          <p className="text-slate-500 text-sm">No active tenders at this time.</p>
        </div>
      </div>
    </div>
  )
}
