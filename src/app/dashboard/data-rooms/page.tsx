'use client'

import { useCallback, useEffect, useState } from 'react'
import { dataRoomsApi } from '@/lib/api'
import { PermissionGuard, ViewOnlyBadge } from '@/components/PermissionGuard'
import { FileUploader } from '@/components/FileUploader'
import { useRBAC } from '@/hooks/useRBAC'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DataRoomSummary {
  projectId: string
  projectTitle: string
  projectCountry: string | null
  projectSector: string | null
  documentCount: number
  lastUploadAt: string | null
}

interface DocEntry {
  id: string
  name: string
  type: string
  mime_type: string | null
  size: number | null
  blob_url: string | null
  version: number
  is_confidential: boolean
  uploaded_at: string
  uploader_name: string
}

interface Folder {
  type: string
  documents: DocEntry[]
}

interface RoomDetail {
  project: {
    id: string
    title: string
    country: string | null
    sector: string | null
  }
  folders: Folder[]
}

interface AccessLogEntry {
  id: string
  userId: string | null
  email: string | null
  action: string
  ipAddress: string | null
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  FEASIBILITY_STUDY:    'Feasibility Study',
  ENVIRONMENTAL_IMPACT: 'Environmental Impact',
  FINANCIAL_MODEL:      'Financial Model',
  LEGAL_AGREEMENT:      'Legal Agreement',
  TECHNICAL_SPECS:      'Technical Specs',
  EIN_REPORT:           'EIN Report',
  PETFEL_REPORT:        'PETFEL Report',
  COMPLIANCE_REPORT:    'Compliance Report',
  OTHER:                'Other',
}

const DOC_TYPE_COLORS: Record<string, string> = {
  FEASIBILITY_STUDY:    'bg-blue-100 text-blue-800',
  ENVIRONMENTAL_IMPACT: 'bg-green-100 text-green-800',
  FINANCIAL_MODEL:      'bg-yellow-100 text-yellow-800',
  LEGAL_AGREEMENT:      'bg-purple-100 text-purple-800',
  TECHNICAL_SPECS:      'bg-indigo-100 text-indigo-800',
  EIN_REPORT:           'bg-orange-100 text-orange-800',
  PETFEL_REPORT:        'bg-pink-100 text-pink-800',
  COMPLIANCE_REPORT:    'bg-teal-100 text-teal-800',
  OTHER:                'bg-gray-100 text-gray-700',
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function FolderIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  )
}

function DocumentIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function ArrowDownTrayIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function EyeIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DataRoomsPage() {
  const { isAdmin, can } = useRBAC()
  const canUpload = can('upload_to_data_room') || isAdmin
  const canDelete = isAdmin

  const [rooms, setRooms] = useState<DataRoomSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  // Selected room detail
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RoomDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Upload panel
  const [showUpload, setShowUpload] = useState(false)

  // Access log
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([])
  const [logLoading, setLogLoading] = useState(false)

  // Stats
  const totalProjects = rooms.length
  const totalDocuments = rooms.reduce((sum, r) => sum + r.documentCount, 0)
  const allDocs = detail?.folders.flatMap(f => f.documents) ?? []
  const confidentialCount = allDocs.filter(d => d.is_confidential).length

  // Load data room list
  const fetchRooms = useCallback(async () => {
    setIsLoading(true)
    try {
      const raw = await dataRoomsApi.list() as unknown as DataRoomSummary[]
      setRooms(raw ?? [])
    } catch {
      // silently skip on auth errors — interceptor handles redirects
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  // Load detail for a project
  const openRoom = async (projectId: string) => {
    setSelectedProjectId(projectId)
    setDetail(null)
    setAccessLog([])
    setShowUpload(false)
    setDetailLoading(true)
    try {
      const res = await dataRoomsApi.get(projectId) as RoomDetail
      setDetail(res)
    } catch {
      // ignore
    } finally {
      setDetailLoading(false)
    }
  }

  const closeRoom = () => {
    setSelectedProjectId(null)
    setDetail(null)
    setShowUpload(false)
    setAccessLog([])
  }

  // Fetch access log for a document
  const loadAccessLog = async (documentId: string) => {
    if (!selectedProjectId) return
    setLogLoading(true)
    try {
      const res = await fetch(`/api/data-rooms/${selectedProjectId}/${documentId}`)
      const json = await res.json()
      // The GET on [documentId] logs VIEW and returns the doc — for the log we
      // separately query the server; for now surface the returned doc's info.
      setAccessLog(prev => [
        ...prev,
        {
          id: documentId + '-' + Date.now(),
          userId: null,
          email: null,
          action: 'VIEW',
          ipAddress: null,
          createdAt: new Date().toISOString(),
          ...json?.data,
        },
      ])
    } finally {
      setLogLoading(false)
    }
  }

  // Delete a document
  const handleDelete = async (documentId: string, docName: string) => {
    if (!selectedProjectId) return
    if (!confirm(`Delete "${docName}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/data-rooms/${selectedProjectId}/${documentId}`, { method: 'DELETE' })
      if (res.ok) {
        // Refresh detail
        await openRoom(selectedProjectId)
      } else {
        const err = await res.json()
        alert(err.error ?? 'Delete failed')
      }
    } catch {
      alert('Delete failed')
    }
  }

  // After upload success — refresh detail
  const handleUploaded = async () => {
    if (selectedProjectId) {
      await openRoom(selectedProjectId)
      await fetchRooms()
      setShowUpload(false)
    }
  }

  // Filter rooms for the list view
  const filteredRooms = rooms.filter(r => {
    const q = search.toLowerCase()
    return (
      r.projectTitle?.toLowerCase().includes(q) ||
      r.projectCountry?.toLowerCase().includes(q) ||
      r.projectSector?.toLowerCase().includes(q)
    )
  })

  // Filter documents by type in the detail view
  const filteredFolders = (detail?.folders ?? []).filter(f =>
    !typeFilter || f.type === typeFilter
  )

  const allTypes = Array.from(new Set((detail?.folders ?? []).map(f => f.type)))

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Data Rooms</h1>
          <PermissionGuard require="manage_data_room" fallback={<ViewOnlyBadge />}>
            <span />
          </PermissionGuard>
        </div>
        <p className="text-sm text-gray-500">Secure document repository for due diligence</p>
      </div>

      {/* Access Control Notice */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <ShieldIcon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-red-900 mb-1 flex items-center gap-2">
            🔒 Premium Access Required
            <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded-full">NDA + Credential Code</span>
          </h3>
          <p className="text-xs text-red-800">
            <strong>External Partners:</strong> To access data room documents, you must:
          </p>
          <ol className="text-xs text-red-800 ml-4 mt-1 space-y-1 list-decimal">
            <li>Be invited to the project by an administrator</li>
            <li>Sign the Non-Disclosure Agreement (NDA)</li>
            <li>Receive your unique 6-digit <strong>access code</strong></li>
            <li>Enter the code to unlock documents</li>
          </ol>
          <p className="text-xs text-red-700 mt-2 flex items-center gap-1">
            <strong>✓ Current:</strong> Project visibility enforced (published projects only)
            <br />
            <strong>⏳ Coming Soon:</strong> Full NDA workflow with credential codes
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="p-2 bg-brand-navy/10 rounded-lg">
            <FolderIcon className="w-5 h-5 text-brand-navy" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalProjects}</p>
            <p className="text-xs text-gray-500">Projects</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="p-2 bg-brand-gold/10 rounded-lg">
            <DocumentIcon className="w-5 h-5 text-brand-gold" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalDocuments}</p>
            <p className="text-xs text-gray-500">Total Documents</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-lg">
            <ShieldIcon className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {selectedProjectId ? confidentialCount : '—'}
            </p>
            <p className="text-xs text-gray-500">Confidential</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <input
          type="text"
          placeholder="Search by project name, country, or sector…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50 focus:outline-none text-sm"
        />
      </div>

      {/* Two-column layout: list + detail panel */}
      <div className="flex gap-6">
        {/* Project card list */}
        <div className={`shrink-0 ${selectedProjectId ? 'w-80' : 'w-full'}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center">
              <FolderIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {search ? 'No projects match your search.' : 'No projects with documents yet.'}
              </p>
            </div>
          ) : (
            <div className={`grid gap-4 ${selectedProjectId ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
              {filteredRooms.map(room => (
                <button
                  key={room.projectId}
                  onClick={() => selectedProjectId === room.projectId ? closeRoom() : openRoom(room.projectId)}
                  className={`text-left bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition border-2 ${
                    selectedProjectId === room.projectId
                      ? 'border-brand-gold'
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-brand-navy/10 rounded-lg">
                      <FolderIcon className="w-5 h-5 text-brand-navy" />
                    </div>
                    <ChevronRightIcon className={`w-4 h-4 text-gray-400 transition ${selectedProjectId === room.projectId ? 'rotate-90' : ''}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate mb-1">{room.projectTitle}</h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {room.projectCountry && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{room.projectCountry}</span>
                    )}
                    {room.projectSector && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">{room.projectSector}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <span>{room.documentCount} document{room.documentCount !== 1 ? 's' : ''}</span>
                    <span>{room.lastUploadAt ? fmtDate(room.lastUploadAt) : 'No uploads'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedProjectId && (
          <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {detail?.project.title ?? 'Loading…'}
                </h2>
                {detail?.project && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[detail.project.country, detail.project.sector].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <PermissionGuard requireAny={['manage_data_room', 'upload_to_data_room']}>
                  <button
                    onClick={() => setShowUpload(v => !v)}
                    className="bg-brand-gold text-brand-navy px-3 py-1.5 rounded-lg hover:bg-brand-gold-dark text-sm font-medium transition"
                  >
                    {showUpload ? 'Cancel Upload' : 'Upload'}
                  </button>
                </PermissionGuard>
                <button
                  onClick={closeRoom}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Upload panel */}
                {showUpload && canUpload && (
                  <div className="border border-dashed border-brand-gold/40 rounded-xl p-4 bg-brand-gold/5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">Upload Documents</h3>
                    <FileUploader
                      uploadUrl={`/api/data-rooms/${selectedProjectId}/upload`}
                      maxFiles={20}
                      maxSizeMb={50}
                      onUploaded={handleUploaded}
                    />
                  </div>
                )}

                {/* Type filter */}
                {allTypes.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setTypeFilter('')}
                      className={`px-3 py-1 text-xs rounded-full border transition ${
                        !typeFilter
                          ? 'bg-brand-navy text-white border-brand-navy'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      All types
                    </button>
                    {allTypes.map(t => (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                        className={`px-3 py-1 text-xs rounded-full border transition ${
                          typeFilter === t
                            ? 'bg-brand-navy text-white border-brand-navy'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {DOC_TYPE_LABELS[t] ?? t}
                      </button>
                    ))}
                  </div>
                )}

                {/* Folder sections */}
                {filteredFolders.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <DocumentIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No documents uploaded yet.</p>
                    {canUpload && (
                      <button
                        onClick={() => setShowUpload(true)}
                        className="mt-3 text-brand-gold text-sm hover:underline"
                      >
                        Upload the first document
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredFolders.map(folder => (
                      <FolderSection
                        key={folder.type}
                        folder={folder}
                        projectId={selectedProjectId}
                        canDelete={canDelete}
                        onDelete={handleDelete}
                        onView={loadAccessLog}
                      />
                    ))}
                  </div>
                )}

                {/* Access log */}
                {accessLog.length > 0 && (
                  <div className="border-t border-gray-100 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <EyeIcon className="w-4 h-4 text-gray-400" />
                      Recent Access
                    </h3>
                    {logLoading ? (
                      <div className="text-xs text-gray-400">Loading…</div>
                    ) : (
                      <div className="space-y-2">
                        {accessLog.map(entry => (
                          <div key={entry.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="font-medium">{entry.email ?? entry.userId ?? 'Unknown'}</span>
                            <span className={`px-2 py-0.5 rounded-full ${entry.action === 'DOWNLOAD' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                              {entry.action}
                            </span>
                            <span className="text-gray-400">{fmtDate(entry.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Folder Section ───────────────────────────────────────────────────────────

function FolderSection({
  folder,
  projectId,
  canDelete,
  onDelete,
  onView,
}: {
  folder: Folder
  projectId: string
  canDelete: boolean
  onDelete: (documentId: string, name: string) => void
  onView: (documentId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const label = DOC_TYPE_LABELS[folder.type] ?? folder.type
  const colorClass = DOC_TYPE_COLORS[folder.type] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <div className="flex items-center gap-2">
          <FolderIcon className="w-4 h-4 text-gray-500" />
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${colorClass}`}>{label}</span>
          <span className="text-xs text-gray-400">{folder.documents.length} file{folder.documents.length !== 1 ? 's' : ''}</span>
        </div>
        <ChevronRightIcon className={`w-4 h-4 text-gray-400 transition ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 bg-white border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Size</th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Version</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Uploaded</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">By</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {folder.documents.map(doc => (
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <DocumentIcon className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-900 truncate max-w-50" title={doc.name}>
                        {doc.name}
                      </span>
                      {doc.is_confidential && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 shrink-0">
                          Confidential
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatBytes(doc.size)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">v{doc.version}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{fmtDate(doc.uploaded_at)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell truncate max-w-30">{doc.uploader_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {doc.blob_url && (
                        <a
                          href={doc.blob_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={doc.name}
                          onClick={() => onView(doc.id)}
                          className="p-1.5 text-gray-400 hover:text-brand-navy rounded-lg hover:bg-gray-100 transition"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                        </a>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => onDelete(doc.id, doc.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
