"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, RefreshCw, UserPlus, CheckCircle,
  Lock, Unlock, RotateCcw, Shield, Mail, X, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react"

type User = {
  id: string
  email: string
  name: string | null
  firstName: string | null
  lastName: string | null
  role: string
  status: string
  authProvider: string
  organization: string | null
  lastLoginAt: string | null
  createdAt: string
  internalProfile: { employeeId: string; accessLevel: number } | null
}

type Pagination = { page: number; limit: number; total: number; pages: number }

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:           "bg-red-500/10 text-red-400 border-red-500/20",
  ANALYST:               "bg-purple-500/10 text-purple-400 border-purple-500/20",
  GOVERNMENT:            "bg-blue-500/10 text-blue-400 border-blue-500/20",
  SPONSOR_DEVELOPER:     "bg-green-500/10 text-green-400 border-green-500/20",
  EPC_OPERATOR:          "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  INSTITUTIONAL_INVESTOR:"bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
}
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      "bg-green-500/10 text-green-400 border-green-500/20",
  PENDING:     "bg-amber-500/10 text-amber-400 border-amber-500/20",
  SUSPENDED:   "bg-red-500/10 text-red-400 border-red-500/20",
  DEACTIVATED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
}

function Badge({ text, colorClass }: { text: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {text.replace(/_/g, " ")}
    </span>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    email: "", firstName: "", lastName: "",
    role: "ANALYST", department: "", password: "", confirmPassword: "",
    accessLevel: 1, canApprove: false, canPublish: false, canManageUsers: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return }
    setLoading(true); setError(null)
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? "Failed to create user"); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center gap-3 p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-semibold">Create Internal Account</h2>
            <p className="text-slate-500 text-xs">Super Admin or Analyst access</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            {[["firstName","First Name"],["lastName","Last Name"]].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-slate-400 mb-1">{l} *</label>
                <input required value={(form as Record<string,unknown>)[k] as string} onChange={(e) => set(k, e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Role *</label>
              <select value={form.role} onChange={(e) => set("role", e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500 transition">
                <option value="ANALYST">Analyst</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Department</label>
              <input value={form.department} onChange={(e) => set("department", e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[["password","Temp Password"],["confirmPassword","Confirm Password"]].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-slate-400 mb-1">{l} *</label>
                <input type="password" required value={(form as Record<string,unknown>)[k] as string} onChange={(e) => set(k, e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">
              Access Level: <span className="text-white font-medium">{form.accessLevel}</span>
            </label>
            <input type="range" min="1" max="10" value={form.accessLevel}
              onChange={(e) => set("accessLevel", Number(e.target.value))}
              className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>Read Only</span><span>Full Access</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs text-slate-400">Permissions</label>
            {([
              ["canApprove","Can Approve Projects"],
              ["canPublish","Can Publish Content"],
              ["canManageUsers","Can Manage Users"],
            ] as [string, string][]).map(([k, l]) => (
              <label key={k} className="flex items-center gap-3 bg-slate-800/40 border border-slate-700 rounded-xl p-3 cursor-pointer hover:border-slate-600 transition">
                <input type="checkbox" checked={(form as Record<string,unknown>)[k] as boolean} onChange={(e) => set(k, e.target.checked)} className="w-4 h-4 accent-blue-500" />
                <span className="text-sm text-slate-300">{l}</span>
              </label>
            ))}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-400 text-xs">
            Password must be 12+ chars with uppercase, lowercase, number, and special character. User must change on first login.
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 })
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [role, setRole]         = useState("")
  const [status, setStatus]     = useState("")
  const [showCreate, setShowCreate] = useState(false)

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: "20" })
    if (search) params.set("search", search)
    if (role)   params.set("role", role)
    if (status) params.set("status", status)
    const res  = await fetch(`/api/admin/users?${params}`)
    const data = await res.json()
    setUsers(data.users ?? [])
    setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, pages: 0 })
    setLoading(false)
  }, [search, role, status])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function updateStatus(id: string, newStatus: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchUsers(pagination.page)
  }

  async function resetPassword(id: string) {
    await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" })
    alert("Password reset email sent")
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-400 text-sm mt-1">{pagination.total} total users</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition text-sm">
          <UserPlus className="w-4 h-4" /> Create Internal Account
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-3 text-slate-300 text-sm focus:outline-none focus:border-blue-500 transition">
          <option value="">All Roles</option>
          {["SUPER_ADMIN","ANALYST","GOVERNMENT","SPONSOR_DEVELOPER","EPC_OPERATOR","INSTITUTIONAL_INVESTOR"].map((r) => (
            <option key={r} value={r}>{r.replace(/_/g," ")}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-3 text-slate-300 text-sm focus:outline-none focus:border-blue-500 transition">
          <option value="">All Statuses</option>
          {["PENDING","ACTIVE","SUSPENDED","DEACTIVATED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => fetchUsers(pagination.page)}
          className="flex items-center gap-2 px-3 py-2.5 border border-slate-700 text-slate-400 hover:text-white rounded-xl text-sm transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["User","Role","Status","Provider","Organisation","Last Login","Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No users found</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{user.firstName ? `${user.firstName} ${user.lastName}` : user.name ?? "—"}</p>
                    <p className="text-slate-500 text-xs">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={user.role} colorClass={ROLE_COLORS[user.role] ?? ""} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge text={user.status} colorClass={STATUS_COLORS[user.status] ?? ""} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{user.authProvider}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{user.organization ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {user.status === "PENDING" && (
                        <button onClick={() => updateStatus(user.id, "ACTIVE")} title="Approve"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-green-400 hover:bg-green-500/10 transition">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {user.status === "ACTIVE" && (
                        <button onClick={() => updateStatus(user.id, "SUSPENDED")} title="Suspend"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
                          <Lock className="w-4 h-4" />
                        </button>
                      )}
                      {user.status === "SUSPENDED" && (
                        <button onClick={() => updateStatus(user.id, "ACTIVE")} title="Unsuspend"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-green-400 hover:bg-green-500/10 transition">
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}
                      {user.authProvider === "INTERNAL" && (
                        <button onClick={() => resetPassword(user.id)} title="Reset Password"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <span className="text-slate-500 text-xs">
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1}
                onClick={() => fetchUsers(pagination.page - 1)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={pagination.page >= pagination.pages}
                onClick={() => fetchUsers(pagination.page + 1)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); fetchUsers() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
