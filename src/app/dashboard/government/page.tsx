"use client"

import { useSession } from "next-auth/react"
import { FolderOpen, DollarSign, Users, Shield, PlusCircle } from "lucide-react"
import Link from "next/link"

export default function GovernmentDashboardPage() {
  const { data: session } = useSession()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Government Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {session?.user?.organization ?? "Ministry / PPP Unit"}
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition text-sm"
        >
          <PlusCircle className="w-4 h-4" /> Submit New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: FolderOpen, label: "Active Projects",     value: "—", color: "blue"   },
          { icon: DollarSign, label: "Total Investment",    value: "—", color: "green"  },
          { icon: Users,      label: "Investor Inquiries", value: "—", color: "purple" },
          { icon: Shield,     label: "Compliance Score",   value: "—", color: "amber"  },
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

      {/* Compliance checklist placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Active Projects</h2>
          <p className="text-slate-500 text-sm">No projects submitted yet.</p>
          <Link href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 mt-4 text-blue-400 hover:text-blue-300 text-sm">
            <PlusCircle className="w-4 h-4" /> Submit your first project
          </Link>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Compliance Checklist</h2>
          <div className="space-y-3">
            {[
              "Environmental clearance",
              "Financial close documents",
              "Legal agreements",
              "Reporting schedule",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm">
                <div className="w-4 h-4 rounded border border-slate-600" />
                <span className="text-slate-400">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
