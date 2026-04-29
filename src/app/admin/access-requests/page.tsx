'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface AccessRequest {
  id: string
  email: string
  fullName: string
  organization?: string | null
  roleRequested: string
  message?: string | null
  status: string
  createdAt: string
}

interface ReviewResult {
  id: string
  status: string
  temp_password?: string
  message?: string
}

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, ReviewResult>>({})

  const load = async () => {
    setIsLoading(true)
    try {
      const res = await api.get<{ data: AccessRequest[] }>('/admin/access-requests')
      setRequests(res.data.data ?? [])
    } catch {
      setError('Failed to load access requests.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const review = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setReviewing(id)
    try {
      const res = await api.patch<ReviewResult>(`/admin/access-requests/${id}`, { status })
      setResults(prev => ({ ...prev, [id]: res.data }))
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch {
      alert('Failed to process request. Please try again.')
    } finally {
      setReviewing(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Partner Access Requests</h1>
        <p className="text-slate-400 text-sm mt-1">Review and approve or reject partner registration requests</p>
      </div>

      {/* Approval results */}
      {Object.entries(results).length > 0 && (
        <div className="mb-6 space-y-3">
          {Object.entries(results).map(([id, r]) => (
            <div key={id} className={`rounded-xl border p-4 text-sm ${
              r.status === 'APPROVED'
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              <p className="font-medium">{r.status === 'APPROVED' ? 'Approved' : 'Rejected'}</p>
              {r.temp_password && (
                <p className="mt-1 font-mono bg-black/20 rounded px-2 py-1 inline-block">
                  Temp password: {r.temp_password}
                </p>
              )}
              {r.message && <p className="mt-1 text-xs opacity-75">{r.message}</p>}
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">{error}</div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-8 text-center">
          <p className="text-slate-400">No pending access requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-white font-semibold">{req.fullName}</p>
                    <span className="bg-slate-600 text-slate-300 px-2 py-0.5 rounded text-xs">{req.roleRequested}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      req.status === 'PENDING'   ? 'bg-amber-500/20 text-amber-400' :
                      req.status === 'APPROVED'  ? 'bg-green-500/20 text-green-400' :
                                                   'bg-red-500/20 text-red-400'
                    }`}>{req.status}</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">{req.email}</p>
                  {req.organization && (
                    <p className="text-slate-500 text-xs mt-0.5">{req.organization}</p>
                  )}
                  {req.message && (
                    <p className="text-slate-400 text-sm mt-3 bg-slate-700/40 rounded-lg p-3">{req.message}</p>
                  )}
                  <p className="text-slate-600 text-xs mt-2">
                    Submitted {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
                {req.status === 'PENDING' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => review(req.id, 'APPROVED')}
                      disabled={reviewing === req.id}
                      className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      {reviewing === req.id ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => review(req.id, 'REJECTED')}
                      disabled={reviewing === req.id}
                      className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {reviewing === req.id ? '…' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
