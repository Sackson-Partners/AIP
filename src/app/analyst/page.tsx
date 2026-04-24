import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"
import { FolderSearch, Activity, FileText, Brain } from "lucide-react"

async function getAnalystStats() {
  const [pendingProjects, pendingEIN] = await Promise.all([
    prisma.project.count({ where: { status: "SUBMITTED" } }),
    prisma.project.count({ where: { status: "APPROVED", einReport: null } }),
  ])
  return { pendingProjects, pendingEIN }
}

async function getWorkQueue() {
  return prisma.project.findMany({
    where: { status: "SUBMITTED" },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { owner: { select: { email: true, name: true, organization: true } } },
  })
}

function QueueCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  const colorMap: Record<string, string> = {
    amber:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
    blue:   "bg-blue-500/10 border-blue-500/20 text-blue-400",
    green:  "bg-green-500/10 border-green-500/20 text-green-400",
    purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{label}</p>
          <p className="text-white text-3xl font-bold">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl border ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export default async function AnalystDashboardPage() {
  const session = await getServerSession(authOptions)
  const [stats, queue] = await Promise.all([getAnalystStats(), getWorkQueue()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Analyst Dashboard</h1>
          {session?.user?.internalProfile?.employeeId && (
            <span className="inline-flex items-center gap-1.5 mt-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs px-3 py-1 rounded-full font-medium">
              {session.user.internalProfile.employeeId}
            </span>
          )}
        </div>
      </div>

      {/* Queue cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <QueueCard icon={FolderSearch} label="Projects Pending Review" value={stats.pendingProjects} color="amber" />
        <QueueCard icon={Activity}    label="PETFEL Analyses Due"      value={stats.pendingProjects} color="blue" />
        <QueueCard icon={FileText}    label="EIN Reports to Generate"  value={stats.pendingEIN}      color="green" />
        <QueueCard icon={Brain}       label="AI Memos Pending"         value={0}                     color="purple" />
      </div>

      {/* Work queue table */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-white font-semibold">Work Queue</h2>
          <p className="text-slate-400 text-xs mt-0.5">Projects assigned for review</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["Code","Title","Sector","Submitted By","Date","Action"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-500">No projects in queue</td></tr>
              ) : queue.map((p) => (
                <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                  <td className="px-4 py-3 font-mono text-slate-300 text-xs">{p.code}</td>
                  <td className="px-4 py-3 text-white text-sm max-w-[200px] truncate">{p.title}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.sector?.replace(/_/g," ") ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.owner.email}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <a href={`/analyst/projects/${p.id}`}
                      className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 text-xs rounded-lg transition">
                      Review
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
