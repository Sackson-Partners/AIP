import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth.config"
import { prisma } from "@/lib/prisma"
import { Users, FolderOpen, Clock, DollarSign, Mail } from "lucide-react"

async function getStats() {
  try {
    const [
      usersByRole, usersByStatus, projectsByStatus,
      pendingUsers, pendingProjects, recentActivity,
      totalUsers, totalProjects, pendingAccessRequests,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.user.groupBy({ by: ['status'], _count: true }),
      prisma.project.groupBy({ by: ['status'], _count: true }),
      prisma.user.count({ where: { status: 'PENDING' } }),
      prisma.project.count({ where: { status: 'SUBMITTED' } }),
      prisma.activityLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.user.count(),
      prisma.project.count(),
      prisma.accessRequest.findMany({
        where:   { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take:    20,
      }),
    ])
    return {
      usersByRole:    Object.fromEntries(usersByRole.map(r => [r.role, r._count])),
      usersByStatus:  Object.fromEntries(usersByStatus.map(r => [r.status, r._count])),
      projectsByStatus: Object.fromEntries(projectsByStatus.map(r => [r.status, r._count])),
      pendingUsers, pendingProjects, recentActivity, totalUsers, totalProjects,
      pendingApprovals: pendingUsers + pendingProjects,
      pendingAccessRequests,
    }
  } catch {
    return null
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  subtitle?: string
  color: "blue" | "green" | "amber" | "purple"
}) {
  const colors = {
    blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: "text-blue-400" },
    green:  { bg: "bg-green-500/10",  border: "border-green-500/20",  icon: "text-green-400" },
    amber:  { bg: "bg-amber-500/10",  border: "border-amber-500/20",  icon: "text-amber-400" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", icon: "text-purple-400" },
  }[color]

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{label}</p>
          <p className="text-white text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl border ${colors.bg} ${colors.border}`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
      </div>
    </div>
  )
}

export default async function AdminDashboardPage() {
  await getServerSession(authOptions) // layout already guards
  const stats = await getStats()

  const totalUsers     = stats?.totalUsers ?? 0
  const totalProjects  = stats?.totalProjects ?? 0
  const pendingUsers   = stats?.pendingUsers ?? 0
  const pendingProjects = stats?.pendingProjects ?? 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Platform overview and management</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users}      label="Total Users"     value={totalUsers}    subtitle={`+${pendingUsers} pending approval`}   color="blue" />
        <StatCard icon={FolderOpen} label="Total Projects"  value={totalProjects} subtitle={`${stats?.projectsByStatus?.ACTIVE ?? 0} active deals`} color="green" />
        <StatCard icon={Clock}      label="Pending Reviews" value={pendingUsers + pendingProjects} subtitle="Users + projects"    color="amber" />
        <StatCard icon={Mail}       label="Access Requests" value={stats?.pendingAccessRequests?.length ?? 0} subtitle="Awaiting review" color="purple" />
      </div>

      {/* Pending approvals + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending users */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            Pending User Approvals
            {pendingUsers > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/20">
                {pendingUsers}
              </span>
            )}
          </h2>
          {pendingUsers === 0 ? (
            <p className="text-slate-500 text-sm">No pending approvals</p>
          ) : (
            <p className="text-slate-400 text-sm">
              {pendingUsers} user{pendingUsers !== 1 ? "s" : ""} awaiting approval.{" "}
              <a href="/admin/users?status=PENDING" className="text-blue-400 hover:text-blue-300">
                Review now →
              </a>
            </p>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Recent Activity</h2>
          {!stats?.recentActivity?.length ? (
            <p className="text-slate-500 text-sm">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {(stats.recentActivity as Array<{ action: string; user?: { email: string } | null; createdAt: Date | string }>)
                .slice(0, 10)
                .map((log, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-mono shrink-0">
                      {log.action}
                    </span>
                    <span className="text-slate-400 truncate">
                      {log.user?.email ?? "System"}
                    </span>
                    <span className="text-slate-600 text-xs ml-auto shrink-0">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Partner Access Requests */}
      <div className="mt-6 bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400" />
            Partner Access Requests
            {(stats?.pendingAccessRequests?.length ?? 0) > 0 && (
              <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full border border-amber-500/20">
                {stats!.pendingAccessRequests!.length} pending
              </span>
            )}
          </h2>
          <a href="/admin/access-requests" className="text-blue-400 hover:text-blue-300 text-sm">
            Review all →
          </a>
        </div>
        {(stats?.pendingAccessRequests?.length ?? 0) === 0 ? (
          <p className="text-slate-500 text-sm">No pending access requests</p>
        ) : (
          <div className="space-y-2">
            {(stats!.pendingAccessRequests! as Array<{
              id: string; email: string; fullName: string; organization?: string | null; roleRequested: string;
            }>).slice(0, 5).map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-3 bg-slate-700/40 rounded-lg px-4 py-3 text-sm">
                <div className="min-w-0">
                  <span className="text-white font-medium truncate">{req.fullName}</span>
                  <span className="text-slate-400 ml-2 truncate">{req.email}</span>
                </div>
                <span className="bg-slate-600 text-slate-300 px-2 py-0.5 rounded text-xs shrink-0">{req.roleRequested}</span>
              </div>
            ))}
            {stats!.pendingAccessRequests!.length > 5 && (
              <p className="text-slate-500 text-xs text-center pt-1">
                +{stats!.pendingAccessRequests!.length - 5} more —{" "}
                <a href="/admin/access-requests" className="text-blue-400 hover:text-blue-300">view all</a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
