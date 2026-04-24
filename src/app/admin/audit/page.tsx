"use client"

import { useEffect, useState, useCallback } from "react"
import { ClipboardList, Loader2, ChevronLeft, ChevronRight } from "lucide-react"

type AuditEntry = {
  id: string
  userId: string | null
  email: string | null
  action: string
  tableName: string | null
  recordId: string | null
  oldValues: string | null
  newValues: string | null
  ipAddress: string | null
  createdAt: string
}

export default function AuditPage() {
  const [logs, setLogs]     = useState<AuditEntry[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [diff, setDiff]     = useState<{ old: string; new: string } | null>(null)

  const LIMIT = 50

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
    if (search) params.set("search", search)
    const res  = await fetch(`/api/admin/audit?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
    }
    setLoading(false)
  }, [search])

  useEffect(() => { fetchLogs(page) }, [fetchLogs, page])

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-slate-400" />
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search by email or action…"
          className="flex-1 bg-slate-800/60 border border-slate-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-blue-500 transition" />
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                {["Timestamp","User","Action","Resource","Record ID","Changes","IP"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No audit logs found</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{log.email ?? "System"}</td>
                  <td className="px-4 py-3">
                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{log.tableName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">{log.recordId?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(log.oldValues || log.newValues) ? (
                      <button
                        onClick={() => setDiff({
                          old: log.oldValues ? JSON.stringify(JSON.parse(log.oldValues), null, 2) : "{}",
                          new: log.newValues ? JSON.stringify(JSON.parse(log.newValues), null, 2) : "{}",
                        })}
                        className="text-blue-400 hover:text-blue-300 text-xs"
                      >
                        View Diff
                      </button>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <span className="text-slate-500 text-xs">{total} total entries</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-slate-400 text-xs px-2 py-1.5">{page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diff modal */}
      {diff && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDiff(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="text-white font-semibold">Change Diff</h3>
              <button onClick={() => setDiff(null)} className="text-slate-500 hover:text-white text-sm">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-0 overflow-y-auto max-h-[calc(80vh-60px)]">
              <div className="p-4 border-r border-slate-800">
                <p className="text-red-400 text-xs font-semibold mb-2 uppercase">Before</p>
                <pre className="text-slate-300 text-xs font-mono whitespace-pre-wrap">{diff.old}</pre>
              </div>
              <div className="p-4">
                <p className="text-green-400 text-xs font-semibold mb-2 uppercase">After</p>
                <pre className="text-slate-300 text-xs font-mono whitespace-pre-wrap">{diff.new}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
