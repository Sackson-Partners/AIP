'use client'

import { useEffect, useState, useCallback } from 'react'
import { pisApi, projectsApi, PISReport, Project } from '@/lib/api'
import { PermissionGuard } from '@/components/PermissionGuard'

// ─── Types ────────────────────────────────────────────────────────────────────

type PISSection = {
  key: keyof PISReport
  label: string
  tab: string
}

const PIS_SECTIONS: PISSection[] = [
  { key: 'executive_summary',    label: 'Executive Summary',    tab: 'Overview'     },
  { key: 'project_background',   label: 'Project Background',   tab: 'Overview'     },
  { key: 'financial_structure',  label: 'Financial Structure',  tab: 'Financial'    },
  { key: 'market_analysis',      label: 'Market Analysis',      tab: 'Market'       },
  { key: 'risk_factors',         label: 'Risk Factors',         tab: 'Risk'         },
  { key: 'investment_highlights',label: 'Investment Highlights', tab: 'Investment'  },
  { key: 'use_of_proceeds',      label: 'Use of Proceeds',      tab: 'Investment'   },
  { key: 'exit_strategy',        label: 'Exit Strategy',        tab: 'Investment'   },
  { key: 'team_background',      label: 'Team Background',      tab: 'Structure'    },
  { key: 'legal_structure',      label: 'Legal Structure',      tab: 'Structure'    },
]

const TABS = ['Overview', 'Financial', 'Market', 'Risk', 'Investment', 'Structure']

const STATUS_OPTIONS = ['DRAFT', 'COMPLETE', 'PUBLISHED'] as const

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  COMPLETE:  'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PISPage() {
  const [pisList, setPisList]         = useState<PISReport[]>([])
  const [selectedPIS, setSelectedPIS] = useState<PISReport | null>(null)
  const [projects, setProjects]       = useState<Project[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving]       = useState(false)
  const [showCreate, setShowCreate]   = useState(false)
  const [newProjectId, setNewProjectId] = useState('')
  const [activeTab, setActiveTab]     = useState('Overview')
  const [draft, setDraft]             = useState<Partial<PISReport>>({})
  const [saveError, setSaveError]     = useState<string | null>(null)

  // IDs of projects that already have a PIS
  const pisProjectIds = new Set(pisList.map((p) => p.project_id))
  const availableProjects = projects.filter((p) => !pisProjectIds.has(String(p.id)))

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [pisData, projectData] = await Promise.allSettled([
        pisApi.list(),
        projectsApi.list(),
      ])
      if (pisData.status === 'fulfilled')     setPisList(pisData.value)
      if (projectData.status === 'fulfilled') setProjects(projectData.value)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Sync draft when selectedPIS changes
  useEffect(() => {
    if (selectedPIS) setDraft({ ...selectedPIS })
    else setDraft({})
  }, [selectedPIS])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelect = (pis: PISReport) => {
    setSelectedPIS(pis)
    setActiveTab('Overview')
    setSaveError(null)
  }

  const handleFieldChange = (key: keyof PISReport, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleStatusChange = (status: string) => {
    setDraft((prev) => ({ ...prev, status }))
  }

  const handleSave = async () => {
    if (!selectedPIS) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const updated = await pisApi.update(selectedPIS.id, draft)
      const merged = { ...selectedPIS, ...updated }
      setSelectedPIS(merged)
      setPisList((prev) => prev.map((p) => (p.id === merged.id ? merged : p)))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedPIS) return
    if (!confirm(`Delete PIS for "${selectedPIS.project_title}"? This cannot be undone.`)) return
    try {
      await pisApi.delete(selectedPIS.id)
      setPisList((prev) => prev.filter((p) => p.id !== selectedPIS.id))
      setSelectedPIS(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleGenerate = async () => {
    if (!selectedPIS) return
    setIsGenerating(true)
    setSaveError(null)
    try {
      const updated = await pisApi.generate(selectedPIS.id)
      const merged = { ...selectedPIS, ...updated }
      setSelectedPIS(merged)
      setDraft({ ...merged })
      setPisList((prev) => prev.map((p) => (p.id === merged.id ? merged : p)))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'AI generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreate = async () => {
    if (!newProjectId) return
    try {
      const created = await pisApi.create({ projectId: newProjectId })
      setPisList((prev) => [created, ...prev])
      setSelectedPIS(created)
      setShowCreate(false)
      setNewProjectId('')
      setActiveTab('Overview')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Create failed')
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold" />
      </div>
    )
  }

  return (
    <PermissionGuard>
      <div className="flex flex-col h-full gap-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Information Sheets</h1>
            <p className="text-gray-500 mt-1">Formal investor documents for each project</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-brand-gold text-brand-navy rounded-lg hover:bg-yellow-400 transition font-medium text-sm"
          >
            + Create PIS
          </button>
        </div>

        {/* Two-Panel Layout */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* ── Left Panel: PIS List ── */}
          <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {pisList.length} Report{pisList.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {pisList.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  No PIS reports yet. Create one to get started.
                </div>
              ) : (
                pisList.map((pis) => (
                  <button
                    key={pis.id}
                    onClick={() => handleSelect(pis)}
                    className={`w-full text-left p-4 border-b hover:bg-gray-50 cursor-pointer transition ${
                      selectedPIS?.id === pis.id ? 'bg-yellow-50 border-l-4 border-l-brand-gold' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900 line-clamp-1">
                        {pis.project_title ?? 'Untitled Project'}
                      </span>
                      {pis.ai_generated && (
                        <span className="shrink-0 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">AI</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {[pis.project_country, pis.project_sector].filter(Boolean).join(' · ') || 'No details'}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[pis.status] ?? STATUS_BADGE.DRAFT}`}>
                      {pis.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right Panel: Editor ── */}
          <div className="flex-1 bg-white rounded-xl shadow-sm flex flex-col min-w-0">
            {selectedPIS ? (
              <>
                {/* Editor Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-gray-900 truncate">
                        {selectedPIS.project_title ?? 'Untitled'}
                      </h2>
                      <div className="text-sm text-gray-500">
                        {[selectedPIS.project_country, selectedPIS.project_sector].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {selectedPIS.ai_generated && (
                      <span className="shrink-0 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">AI Generated</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Status selector */}
                    <select
                      value={draft.status ?? selectedPIS.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-brand-gold/50"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    {/* Generate with AI */}
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 text-sm transition"
                    >
                      {isGenerating ? (
                        <>
                          <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-3.5 h-3.5" />
                          Generate with AI
                        </>
                      )}
                    </button>

                    {/* Save */}
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-4 py-1.5 bg-brand-gold text-brand-navy rounded-lg hover:bg-yellow-400 disabled:opacity-60 text-sm font-medium transition"
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {saveError && (
                  <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {saveError}
                  </div>
                )}

                {/* Section Tabs */}
                <div className="border-b border-gray-100">
                  <nav className="flex px-5 -mb-px overflow-x-auto">
                    {TABS.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                          activeTab === tab
                            ? 'border-brand-gold text-brand-navy'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Section Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {PIS_SECTIONS.filter((s) => s.tab === activeTab).map((section) => (
                    <div key={section.key}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {section.label}
                      </label>
                      <textarea
                        value={(draft[section.key] as string) ?? ''}
                        onChange={(e) => handleFieldChange(section.key, e.target.value)}
                        rows={8}
                        placeholder={`Enter ${section.label.toLowerCase()}…`}
                        className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 resize-y focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold outline-none transition"
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <DocumentTextIcon className="w-16 h-16 text-gray-200 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No PIS Selected</h3>
                <p className="text-gray-400 max-w-sm">
                  Select a Project Information Sheet from the list on the left, or create a new one
                  to start documenting your investment opportunity.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-6 px-5 py-2.5 bg-brand-gold text-brand-navy rounded-lg hover:bg-yellow-400 transition font-medium text-sm"
                >
                  + Create PIS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Create PIS Modal ── */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Create Project Information Sheet</h2>
              <p className="text-sm text-gray-500 mb-6">Select a project to create a PIS for.</p>

              <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
              {availableProjects.length === 0 ? (
                <p className="text-sm text-gray-400 mb-4">
                  All projects already have a PIS. Add a new project first.
                </p>
              ) : (
                <select
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-gold/50 mb-6"
                >
                  <option value="">Select a project…</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.title ?? p.project_name} {p.country ? `(${p.country})` : ''}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowCreate(false); setNewProjectId('') }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newProjectId}
                  className="px-5 py-2 bg-brand-gold text-brand-navy rounded-lg hover:bg-yellow-400 disabled:opacity-50 text-sm font-medium transition"
                >
                  Create PIS
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  )
}
