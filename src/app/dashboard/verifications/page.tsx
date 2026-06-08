'use client';

import { useEffect, useState, useCallback } from 'react';
import { verificationsApi, projectsApi, Project } from '../../../lib/api';
import { PlusIcon, XIcon } from '@/components/ui/icons';
import { PermissionGuard, ViewOnlyBadge } from '@/components/PermissionGuard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Verification {
  id: string | number
  project_id: string | number
  project_name?: string
  level: string
  status?: string
  bankability?: {
    overall_score: number
    technical_readiness: number
    financial_robustness: number
    legal_clarity: number
    esg_compliance: number
  }
  notes?: string | null
  verified_by?: string | null
  verified_at?: string | null
  focal_point_name?: string | null
  focal_point_email?: string | null
  focal_point_org?: string | null
  focal_point_title?: string | null
  local_partner_name?: string | null
  local_partner_org?: string | null
  local_partner_role?: string | null
  local_partner_email?: string | null
  created_at?: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const LEVELS = [
  { key: 'V0', label: 'V0: Submitted',                color: 'bg-gray-100 text-gray-800',   border: 'border-gray-200', dot: 'bg-gray-400' },
  { key: 'V1', label: 'V1: Sponsor Verified',          color: 'bg-blue-100 text-blue-800',   border: 'border-blue-200', dot: 'bg-blue-500' },
  { key: 'V2', label: 'V2: Documents Verified',        color: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  { key: 'V3', label: 'V3: Bankability Screened',      color: 'bg-green-100 text-green-800', border: 'border-green-200', dot: 'bg-green-500' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-blue-100 text-blue-700',
  APPROVED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
};

type ViewMode = 'kanban' | 'list';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VerificationsPage() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [projects, setProjects]           = useState<Project[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [viewMode, setViewMode]           = useState<ViewMode>('kanban');
  const [showModal, setShowModal]         = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVerification, setEditingVerification] = useState<Verification | null>(null);
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);

  // Form state
  const [form, setForm] = useState({
    project_id: '',
    level: 'V0: Submitted',
    status: 'PENDING',
    notes: '',
    technical_readiness: '',
    financial_robustness: '',
    legal_clarity: '',
    esg_compliance: '',
    focal_point_name: '',
    focal_point_email: '',
    focal_point_org: '',
    focal_point_title: '',
    local_partner_name: '',
    local_partner_org: '',
    local_partner_role: '',
    local_partner_email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [vData, pData] = await Promise.all([
        verificationsApi.list(),
        projectsApi.list(),
      ]);
      setVerifications(vData as Verification[]);
      setProjects(pData);
    } catch {
      // silent — show empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = (v: Verification) => {
    setEditingVerification(v);
    setForm({
      project_id: String(v.project_id),
      level: v.level,
      status: v.status ?? 'PENDING',
      notes: v.notes ?? '',
      technical_readiness: String(v.bankability?.technical_readiness ?? ''),
      financial_robustness: String(v.bankability?.financial_robustness ?? ''),
      legal_clarity: String(v.bankability?.legal_clarity ?? ''),
      esg_compliance: String(v.bankability?.esg_compliance ?? ''),
      focal_point_name: v.focal_point_name ?? '',
      focal_point_email: v.focal_point_email ?? '',
      focal_point_org: v.focal_point_org ?? '',
      focal_point_title: v.focal_point_title ?? '',
      local_partner_name: v.local_partner_name ?? '',
      local_partner_org: v.local_partner_org ?? '',
      local_partner_role: v.local_partner_role ?? '',
      local_partner_email: v.local_partner_email ?? '',
    });
    setShowEditModal(true);
    setSelectedVerification(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id) { setFormError('Select a project'); return; }
    setIsSubmitting(true);
    setFormError(null);
    try {
      const isV3 = form.level.startsWith('V3');
      await verificationsApi.create({
        project_id: form.project_id,
        level: form.level,
        status: form.status,
        notes: form.notes || undefined,
        ...(isV3 ? {
          technical_readiness:  Number(form.technical_readiness)  || 0,
          financial_robustness: Number(form.financial_robustness) || 0,
          legal_clarity:        Number(form.legal_clarity)        || 0,
          esg_compliance:       Number(form.esg_compliance)       || 0,
        } : {}),
        focal_point_name:  form.focal_point_name  || undefined,
        focal_point_email: form.focal_point_email || undefined,
        focal_point_org:   form.focal_point_org   || undefined,
        focal_point_title: form.focal_point_title || undefined,
        local_partner_name:  form.local_partner_name  || undefined,
        local_partner_org:   form.local_partner_org   || undefined,
        local_partner_role:  form.local_partner_role  || undefined,
        local_partner_email: form.local_partner_email || undefined,
      } as Parameters<typeof verificationsApi.create>[0]);
      setShowModal(false);
      setForm({
        project_id: '', level: 'V0: Submitted', status: 'PENDING', notes: '',
        technical_readiness: '', financial_robustness: '', legal_clarity: '', esg_compliance: '',
        focal_point_name: '', focal_point_email: '', focal_point_org: '', focal_point_title: '',
        local_partner_name: '', local_partner_org: '', local_partner_role: '', local_partner_email: '',
      });
      fetchData();
    } catch {
      setFormError('Failed to create verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVerification) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const isV3 = form.level.startsWith('V3');
      await verificationsApi.update(editingVerification.id, {
        level: form.level,
        status: form.status,
        notes: form.notes || undefined,
        ...(isV3 ? {
          technical_readiness:  Number(form.technical_readiness)  || 0,
          financial_robustness: Number(form.financial_robustness) || 0,
          legal_clarity:        Number(form.legal_clarity)        || 0,
          esg_compliance:       Number(form.esg_compliance)       || 0,
        } : {}),
        focal_point_name:  form.focal_point_name  || undefined,
        focal_point_email: form.focal_point_email || undefined,
        focal_point_org:   form.focal_point_org   || undefined,
        focal_point_title: form.focal_point_title || undefined,
        local_partner_name:  form.local_partner_name  || undefined,
        local_partner_org:   form.local_partner_org   || undefined,
        local_partner_role:  form.local_partner_role  || undefined,
        local_partner_email: form.local_partner_email || undefined,
      });
      setShowEditModal(false);
      setEditingVerification(null);
      setForm({
        project_id: '', level: 'V0: Submitted', status: 'PENDING', notes: '',
        technical_readiness: '', financial_robustness: '', legal_clarity: '', esg_compliance: '',
        focal_point_name: '', focal_point_email: '', focal_point_org: '', focal_point_title: '',
        local_partner_name: '', local_partner_org: '', local_partner_role: '', local_partner_email: '',
      });
      fetchData();
    } catch {
      setFormError('Failed to update verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProjectName = (projectId: string | number) => {
    const p = projects.find(p => String(p.id) === String(projectId));
    return p?.title ?? p?.project_name ?? `Project ${projectId}`;
  };

  const levelConfig = (level: string) =>
    LEVELS.find(l => level.startsWith(l.key)) ?? LEVELS[0];

  const columnCounts = LEVELS.map(l => ({
    ...l,
    items: verifications.filter(v => v.level.startsWith(l.key)),
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Verifications</h1>
          <PermissionGuard requireAny={['manage_verifications']} fallback={<ViewOnlyBadge />}>
            <span />
          </PermissionGuard>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'kanban' ? 'bg-brand-navy text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'list' ? 'bg-brand-navy text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              List
            </button>
          </div>
          <PermissionGuard require="manage_verifications">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-brand-gold text-brand-navy px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-gold-dark transition"
            >
              <PlusIcon className="w-4 h-4" />
              New Verification
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Level Legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {LEVELS.map(l => (
          <span key={l.key} className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full ${l.color}`}>
            <span className={`w-2 h-2 rounded-full ${l.dot}`} />
            {l.label}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold" />
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columnCounts.map(col => (
            <div key={col.key} className="shrink-0 w-72">
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 ${col.color}`}>
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-xs bg-white/60 px-1.5 py-0.5 rounded-full">{col.items.length}</span>
              </div>
              <div className="space-y-3">
                {col.items.map(v => (
                  <VerificationCard
                    key={v.id}
                    v={v}
                    getProjectName={getProjectName}
                    levelConfig={levelConfig}
                    onClick={() => setSelectedVerification(v)}
                  />
                ))}
                {col.items.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-lg">No verifications</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Focal Point</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Local Partner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {verifications.length > 0 ? verifications.map(v => {
                const lc = levelConfig(v.level);
                return (
                  <tr key={v.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedVerification(v)}>
                    <td className="px-4 py-3 font-medium text-gray-900 text-sm">{getProjectName(v.project_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${lc.color}`}>{v.level}</span>
                    </td>
                    <td className="px-4 py-3">
                      {v.bankability ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-brand-gold h-1.5 rounded-full" style={{ width: `${v.bankability.overall_score}%` }} />
                          </div>
                          <span className="text-xs text-gray-700">{v.bankability.overall_score.toFixed(0)}%</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.focal_point_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{v.local_partner_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[v.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
                        {v.status ?? 'PENDING'}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                    No verifications yet. Create the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selectedVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{getProjectName(selectedVerification.project_id)}</h2>
                <span className={`inline-flex mt-1 px-2 py-0.5 text-xs rounded-full ${levelConfig(selectedVerification.level).color}`}>
                  {selectedVerification.level}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <PermissionGuard require="manage_verifications">
                  <button
                    onClick={() => openEdit(selectedVerification)}
                    className="px-3 py-1.5 text-sm bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark transition"
                  >
                    Edit
                  </button>
                </PermissionGuard>
                <button onClick={() => setSelectedVerification(null)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-6">
              {/* Bankability scores */}
              {selectedVerification.bankability && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Bankability Assessment</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Technical Readiness',  val: selectedVerification.bankability.technical_readiness },
                      { label: 'Financial Robustness', val: selectedVerification.bankability.financial_robustness },
                      { label: 'Legal Clarity',        val: selectedVerification.bankability.legal_clarity },
                      { label: 'ESG Compliance',       val: selectedVerification.bankability.esg_compliance },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-brand-gold h-1.5 rounded-full" style={{ width: `${val}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{val.toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-brand-gold/10 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium text-brand-navy">Overall Score</span>
                    <span className="text-xl font-bold text-brand-navy">{selectedVerification.bankability.overall_score.toFixed(1)}%</span>
                  </div>
                </div>
              )}

              {/* Focal Point */}
              {(selectedVerification.focal_point_name || selectedVerification.focal_point_org) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Focal Point (Government Reference)
                  </h3>
                  <div className="bg-blue-50 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                    {selectedVerification.focal_point_name  && <Detail label="Name"        val={selectedVerification.focal_point_name} />}
                    {selectedVerification.focal_point_title && <Detail label="Title"       val={selectedVerification.focal_point_title} />}
                    {selectedVerification.focal_point_org   && <Detail label="Organisation" val={selectedVerification.focal_point_org} />}
                    {selectedVerification.focal_point_email && <Detail label="Email"       val={selectedVerification.focal_point_email} />}
                  </div>
                </div>
              )}

              {/* Local Partner */}
              {(selectedVerification.local_partner_name || selectedVerification.local_partner_org) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Local Partner
                  </h3>
                  <div className="bg-green-50 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                    {selectedVerification.local_partner_name  && <Detail label="Name"         val={selectedVerification.local_partner_name} />}
                    {selectedVerification.local_partner_role  && <Detail label="Role"         val={selectedVerification.local_partner_role} />}
                    {selectedVerification.local_partner_org   && <Detail label="Organisation" val={selectedVerification.local_partner_org} />}
                    {selectedVerification.local_partner_email && <Detail label="Email"        val={selectedVerification.local_partner_email} />}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedVerification.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedVerification.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Edit Verification</h2>
              <button onClick={() => { setShowEditModal(false); setEditingVerification(null); setFormError(null); }} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            {formError && (
              <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>
            )}
            <form onSubmit={handleUpdate} className="p-5 space-y-5">
              {/* Core */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                  <input
                    type="text"
                    disabled
                    value={getProjectName(editingVerification.project_id)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Level *</label>
                  <select required value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                    {LEVELS.map(l => <option key={l.key} value={l.label}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                    <option value="PENDING">Pending</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Bankability (V3 only) */}
              {form.level.startsWith('V3') && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700">Bankability Scores (0–100)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['technical_readiness', 'Technical Readiness'],
                      ['financial_robustness', 'Financial Robustness'],
                      ['legal_clarity', 'Legal Clarity'],
                      ['esg_compliance', 'ESG Compliance'],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <input type="number" min="0" max="100"
                          value={form[k as keyof typeof form] as string}
                          onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Focal Point */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Focal Point (Government Reference) — optional
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['focal_point_name', 'Name'],
                    ['focal_point_title', 'Title / Position'],
                    ['focal_point_org', 'Ministry / Organisation'],
                    ['focal_point_email', 'Email'],
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input type={k.includes('email') ? 'email' : 'text'}
                        value={form[k as keyof typeof form] as string}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Local Partner */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Local Partner — optional
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['local_partner_name', 'Name'],
                    ['local_partner_role', 'Role'],
                    ['local_partner_org', 'Organisation'],
                    ['local_partner_email', 'Email'],
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input type={k.includes('email') ? 'email' : 'text'}
                        value={form[k as keyof typeof form] as string}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Verification notes, observations…" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingVerification(null); setFormError(null); }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="px-4 py-2 text-sm bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark disabled:opacity-50">
                  {isSubmitting ? 'Updating…' : 'Update Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">New Verification</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            {formError && (
              <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>
            )}
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Core */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                  <select required value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                    <option value="">Select project</option>
                    {projects.map(p => <option key={p.id} value={String(p.id)}>{p.title ?? p.project_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verification Level *</label>
                  <select required value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                    {LEVELS.map(l => <option key={l.key} value={l.label}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                    <option value="PENDING">Pending</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Bankability (V3 only) */}
              {form.level.startsWith('V3') && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700">Bankability Scores (0–100)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['technical_readiness', 'Technical Readiness'],
                      ['financial_robustness', 'Financial Robustness'],
                      ['legal_clarity', 'Legal Clarity'],
                      ['esg_compliance', 'ESG Compliance'],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <input type="number" min="0" max="100"
                          value={form[k as keyof typeof form] as string}
                          onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Focal Point */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Focal Point (Government Reference) — optional
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['focal_point_name', 'Name'],
                    ['focal_point_title', 'Title / Position'],
                    ['focal_point_org', 'Ministry / Organisation'],
                    ['focal_point_email', 'Email'],
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input type={k.includes('email') ? 'email' : 'text'}
                        value={form[k as keyof typeof form] as string}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Local Partner */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Local Partner — optional
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['local_partner_name', 'Name'],
                    ['local_partner_role', 'Role'],
                    ['local_partner_org', 'Organisation'],
                    ['local_partner_email', 'Email'],
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input type={k.includes('email') ? 'email' : 'text'}
                        value={form[k as keyof typeof form] as string}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Verification notes, observations…" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setFormError(null); }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="px-4 py-2 text-sm bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark disabled:opacity-50">
                  {isSubmitting ? 'Creating…' : 'Create Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function VerificationCard({ v, getProjectName, levelConfig, onClick }: {
  v: Verification
  getProjectName: (id: string | number) => string
  levelConfig: (level: string) => typeof LEVELS[0]
  onClick: () => void
}) {
  const lc = levelConfig(v.level);
  const score = v.bankability?.overall_score;
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition border-l-4 ${lc.border}`}
    >
      <p className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">{getProjectName(v.project_id)}</p>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
          {v.status ?? 'PENDING'}
        </span>
        {score !== undefined && (
          <span className="text-xs text-gray-500">{score.toFixed(0)}%</span>
        )}
      </div>
      {(v.focal_point_name || v.local_partner_name) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {v.focal_point_name && (
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
              FP: {v.focal_point_name.split(' ')[0]}
            </span>
          )}
          {v.local_partner_name && (
            <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
              LP: {v.local_partner_name.split(' ')[0]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, val }: { label: string; val: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900 text-sm">{val}</p>
    </div>
  );
}
