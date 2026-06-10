'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { projectsApi, dealRoomsApi } from '../../../lib/api';
import { PermissionGuard } from '@/components/PermissionGuard';
import { useRBAC } from '@/hooks/useRBAC';
import { XIcon } from '@/components/ui/icons';

// ── Types ──────────────────────────────────────────────────────────────────────
interface DealRoom {
  id: string;
  project_id: string;
  project_name: string | null;
  project_sector: string | null;
  project_country: string | null;
  name: string;
  description: string | null;
  status: string;
  deal_value: number | null;
  deal_currency: string;
  target_close_date: string | null;
  is_video_enabled: boolean;
  is_chat_enabled: boolean;
  require_nda: boolean;
  deal_type: string | null;
  target_raise: number | null;
  min_ticket: number | null;
  eoi_deadline: string | null;
  eoi_count: number;
  is_saved: boolean;
  created_at: string;
}

interface Project { id: string | number; title?: string; project_name?: string; name?: string }

const DEAL_TYPES = ['EQUITY', 'DEBT', 'GRANT', 'PPP', 'MEZZANINE'];
const STATUSES   = ['ACTIVE', 'NEGOTIATING', 'CLOSED', 'ARCHIVED'];
const KANBAN_COLS = ['ACTIVE', 'NEGOTIATING', 'CLOSED', 'ARCHIVED'];

type ViewMode = 'cards' | 'kanban';

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DealRoomsPage() {
  const { can } = useRBAC();
  const canManage = can('manage_deal_rooms') || can('create_deal_room');

  const [dealRooms, setDealRooms] = useState<DealRoom[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [viewMode, setViewMode]   = useState<ViewMode>('cards');

  // Filters
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterDealType, setFilterDealType] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    project_id: '', name: '', description: '', deal_value: '',
    target_close_date: '', require_nda: true, is_video_enabled: true,
    is_chat_enabled: true, deal_type: '', target_raise: '', min_ticket: '', eoi_deadline: '',
  });

  // EOI modal
  const [eoiRoom, setEoiRoom] = useState<DealRoom | null>(null);
  const [eoiForm, setEoiForm] = useState({ name: '', email: '', organization: '', message: '' });
  const [eoiSubmitting, setEoiSubmitting] = useState(false);
  const [eoiSuccess, setEoiSuccess]       = useState(false);

  // Edit modal
  const [editRoom, setEditRoom] = useState<DealRoom | null>(null);
  const [editForm, setEditForm] = useState<typeof form>(form);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation
  const [deleteRoom, setDeleteRoom] = useState<DealRoom | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await dealRoomsApi.list() as DealRoom[];
      setDealRooms(data ?? []);
      setError(null);
    } catch {
      setError('Failed to load deal rooms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    projectsApi.list().then(d => setProjects(d as Project[])).catch(() => {});
  }, [fetchRooms]);

  const filtered = useMemo(() => {
    let list = dealRooms;
    if (search)        list = list.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || (r.project_name ?? '').toLowerCase().includes(search.toLowerCase()));
    if (filterStatus)  list = list.filter(r => r.status === filterStatus);
    if (filterDealType)list = list.filter(r => r.deal_type === filterDealType);
    if (showSavedOnly) list = list.filter(r => r.is_saved);
    return list;
  }, [dealRooms, search, filterStatus, filterDealType, showSavedOnly]);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id) { setError('Select a project'); return; }
    if (!form.name.trim()) { setError('Enter a deal room name'); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      await dealRoomsApi.create({
        project_id:        form.project_id,
        name:              form.name,
        description:       form.description || undefined,
        deal_value:        form.deal_value ? Number(form.deal_value) : undefined,
        target_close_date: form.target_close_date || undefined,
        require_nda:       form.require_nda,
        is_video_enabled:  form.is_video_enabled,
        is_chat_enabled:   form.is_chat_enabled,
        deal_type:         form.deal_type   || undefined,
        target_raise:      form.target_raise ? Number(form.target_raise) : undefined,
        min_ticket:        form.min_ticket   ? Number(form.min_ticket)   : undefined,
        eoi_deadline:      form.eoi_deadline || undefined,
      } as Parameters<typeof dealRoomsApi.create>[0]);
      setShowCreate(false);
      setForm({ project_id: '', name: '', description: '', deal_value: '', target_close_date: '', require_nda: true, is_video_enabled: true, is_chat_enabled: true, deal_type: '', target_raise: '', min_ticket: '', eoi_deadline: '' });
      fetchRooms();
    } catch {
      setError('Failed to create deal room.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, fetchRooms]);

  const toggleSave = useCallback(async (room: DealRoom, e: React.MouseEvent) => {
    e.preventDefault();
    const method = room.is_saved ? 'DELETE' : 'POST';
    await fetch(`/api/deal-rooms/${room.id}/save`, { method });
    setDealRooms(prev => prev.map(r => r.id === room.id ? { ...r, is_saved: !r.is_saved } : r));
  }, []);

  const submitEoi = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eoiRoom) return;
    setEoiSubmitting(true);
    try {
      await fetch(`/api/deal-rooms/${eoiRoom.id}/eoi`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(eoiForm),
      });
      setEoiSuccess(true);
      setDealRooms(prev => prev.map(r => r.id === eoiRoom.id ? { ...r, eoi_count: r.eoi_count + 1 } : r));
    } catch {
      setError('Failed to submit EOI.');
    } finally {
      setEoiSubmitting(false);
    }
  }, [eoiRoom, eoiForm]);

  const openEoi = (room: DealRoom) => {
    setEoiRoom(room);
    setEoiForm({ name: '', email: '', organization: '', message: '' });
    setEoiSuccess(false);
  };

  const openEdit = (room: DealRoom) => {
    setEditRoom(room);
    setEditForm({
      project_id: room.project_id,
      name: room.name,
      description: room.description || '',
      deal_value: room.deal_value ? String(room.deal_value) : '',
      target_close_date: room.target_close_date || '',
      require_nda: room.require_nda,
      is_video_enabled: room.is_video_enabled,
      is_chat_enabled: room.is_chat_enabled,
      deal_type: room.deal_type || '',
      target_raise: room.target_raise ? String(room.target_raise) : '',
      min_ticket: room.min_ticket ? String(room.min_ticket) : '',
      eoi_deadline: room.eoi_deadline || '',
    });
    setError(null);
  };

  const handleEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoom) return;
    setEditSubmitting(true);
    setError(null);
    try {
      await fetch(`/api/deal-rooms/${editRoom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || undefined,
          deal_value: editForm.deal_value ? Number(editForm.deal_value) : undefined,
          target_close_date: editForm.target_close_date || undefined,
          require_nda: editForm.require_nda,
          is_video_enabled: editForm.is_video_enabled,
          is_chat_enabled: editForm.is_chat_enabled,
          deal_type: editForm.deal_type || undefined,
          target_raise: editForm.target_raise ? Number(editForm.target_raise) : undefined,
          min_ticket: editForm.min_ticket ? Number(editForm.min_ticket) : undefined,
          eoi_deadline: editForm.eoi_deadline || undefined,
        }),
      });
      setEditRoom(null);
      fetchRooms();
    } catch {
      setError('Failed to update deal room.');
    } finally {
      setEditSubmitting(false);
    }
  }, [editRoom, editForm, fetchRooms]);

  const handleDelete = useCallback(async () => {
    if (!deleteRoom) return;
    setDeleteSubmitting(true);
    try {
      await dealRoomsApi.delete(deleteRoom.id);
      setDeleteRoom(null);
      fetchRooms();
    } catch {
      setError('Failed to delete deal room.');
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteRoom, fetchRooms]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deal Rooms</h1>
          <p className="text-sm text-gray-500 mt-0.5">Marketplace for infrastructure investment opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'cards' ? 'bg-brand-navy text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === 'kanban' ? 'bg-brand-navy text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Kanban
            </button>
          </div>
          <PermissionGuard requireAny={['manage_deal_rooms', 'create_deal_room']}>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-brand-gold text-brand-navy px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-gold-dark transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Deal Room
            </button>
          </PermissionGuard>
        </div>
      </div>

      {error && !showCreate && !eoiRoom && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search deal rooms…"
          className="w-56 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterDealType} onChange={e => setFilterDealType(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
          <option value="">All deal types</option>
          {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setShowSavedOnly(p => !p)}
          className={`px-3 py-2 text-sm border rounded-lg transition ${showSavedOnly ? 'bg-brand-gold text-brand-navy border-brand-gold' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          Saved only
        </button>
        <span className="ml-auto self-center text-sm text-gray-500">{filtered.length} room{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Content */}
      {viewMode === 'cards' ? (
        <CardsView rooms={filtered} canManage={canManage} onSave={toggleSave} onEoi={openEoi} onEdit={openEdit} onDelete={(r) => setDeleteRoom(r)} />
      ) : (
        <KanbanView rooms={filtered} canManage={canManage} onSave={toggleSave} onEoi={openEoi} onEdit={openEdit} onDelete={(r) => setDeleteRoom(r)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">Create Deal Room</h2>
              <button onClick={() => { setShowCreate(false); setError(null); }} className="text-gray-400 hover:text-gray-600"><XIcon className="w-5 h-5" /></button>
            </div>
            {error && <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                  <select required value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                    <option value="">Select project</option>
                    {projects.map(p => <option key={p.id} value={String(p.id)}>{p.title ?? p.project_name ?? p.name ?? String(p.id)}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Room Name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                    placeholder="e.g., Series A Negotiation" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                {/* Marketplace fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Type</label>
                  <select value={form.deal_type} onChange={e => setForm(f => ({ ...f, deal_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                    <option value="">Select type</option>
                    {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Raise ($)</label>
                  <input type="number" value={form.target_raise} onChange={e => setForm(f => ({ ...f, target_raise: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" placeholder="e.g. 50000000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Ticket ($)</label>
                  <input type="number" value={form.min_ticket} onChange={e => setForm(f => ({ ...f, min_ticket: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" placeholder="e.g. 1000000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EOI Deadline</label>
                  <input type="date" value={form.eoi_deadline} onChange={e => setForm(f => ({ ...f, eoi_deadline: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value ($)</label>
                  <input type="number" value={form.deal_value} onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Close Date</label>
                  <input type="date" value={form.target_close_date} onChange={e => setForm(f => ({ ...f, target_close_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-4">
                  {[['require_nda', 'Require NDA'], ['is_video_enabled', 'Enable Video'], ['is_chat_enabled', 'Enable Chat']].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={form[k as keyof typeof form] as boolean}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} className="accent-brand-gold" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setError(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark disabled:opacity-50">
                  {isSubmitting ? 'Creating…' : 'Create Deal Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EOI Modal */}
      {eoiRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Express Interest</h2>
                <p className="text-sm text-gray-500">{eoiRoom.name}</p>
              </div>
              <button onClick={() => setEoiRoom(null)} className="text-gray-400 hover:text-gray-600"><XIcon className="w-5 h-5" /></button>
            </div>
            {eoiSuccess ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900 mb-1">EOI Submitted</p>
                <p className="text-sm text-gray-500">The deal team has been notified and will be in touch.</p>
                <button onClick={() => setEoiRoom(null)} className="mt-4 px-4 py-2 text-sm bg-brand-gold text-brand-navy rounded-lg">Close</button>
              </div>
            ) : (
              <form onSubmit={submitEoi} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                    <input required value={eoiForm.name} onChange={e => setEoiForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input required type="email" value={eoiForm.email} onChange={e => setEoiForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                    <input value={eoiForm.organization} onChange={e => setEoiForm(f => ({ ...f, organization: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea value={eoiForm.message} onChange={e => setEoiForm(f => ({ ...f, message: e.target.value }))} rows={4}
                      placeholder="Briefly describe your interest and investment capacity…"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setEoiRoom(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={eoiSubmitting} className="px-4 py-2 text-sm bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark disabled:opacity-50">
                    {eoiSubmitting ? 'Submitting…' : 'Submit EOI'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">Edit Deal Room</h2>
              <button onClick={() => { setEditRoom(null); setError(null); }} className="text-gray-400 hover:text-gray-600"><XIcon className="w-5 h-5" /></button>
            </div>
            {error && <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Room Name *</label>
                  <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Type</label>
                  <select value={editForm.deal_type} onChange={e => setEditForm(f => ({ ...f, deal_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                    <option value="">Select type</option>
                    {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Raise ($)</label>
                  <input type="number" value={editForm.target_raise} onChange={e => setEditForm(f => ({ ...f, target_raise: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Ticket ($)</label>
                  <input type="number" value={editForm.min_ticket} onChange={e => setEditForm(f => ({ ...f, min_ticket: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EOI Deadline</label>
                  <input type="date" value={editForm.eoi_deadline} onChange={e => setEditForm(f => ({ ...f, eoi_deadline: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value ($)</label>
                  <input type="number" value={editForm.deal_value} onChange={e => setEditForm(f => ({ ...f, deal_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Close Date</label>
                  <input type="date" value={editForm.target_close_date} onChange={e => setEditForm(f => ({ ...f, target_close_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-4">
                  {[['require_nda', 'Require NDA'], ['is_video_enabled', 'Enable Video'], ['is_chat_enabled', 'Enable Chat']].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={editForm[k as keyof typeof editForm] as boolean}
                        onChange={e => setEditForm(f => ({ ...f, [k]: e.target.checked }))} className="accent-brand-gold" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setEditRoom(null); setError(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={editSubmitting} className="px-4 py-2 text-sm bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark disabled:opacity-50">
                  {editSubmitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">Delete Deal Room</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete <strong>{deleteRoom.name}</strong>? This action cannot be undone.
              </p>
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">{error}</div>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setDeleteRoom(null); setError(null); }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteSubmitting}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteSubmitting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cards View ─────────────────────────────────────────────────────────────────
function CardsView({ rooms, canManage, onSave, onEoi, onEdit, onDelete }: {
  rooms: DealRoom[]
  canManage: boolean
  onSave: (r: DealRoom, e: React.MouseEvent) => void
  onEoi:  (r: DealRoom) => void
  onEdit: (r: DealRoom) => void
  onDelete: (r: DealRoom) => void
}) {
  if (rooms.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl shadow-sm">
        <p className="text-gray-500">No deal rooms match your filters.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {rooms.map(r => <DealCard key={r.id} room={r} canManage={canManage} onSave={onSave} onEoi={onEoi} onEdit={onEdit} onDelete={onDelete} />)}
    </div>
  );
}

// ── Kanban View ────────────────────────────────────────────────────────────────
function KanbanView({ rooms, canManage, onSave, onEoi, onEdit, onDelete }: {
  rooms: DealRoom[]
  canManage: boolean
  onSave: (r: DealRoom, e: React.MouseEvent) => void
  onEoi:  (r: DealRoom) => void
  onEdit: (r: DealRoom) => void
  onDelete: (r: DealRoom) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLS.map(col => {
        const colRooms = rooms.filter(r => r.status === col);
        return (
          <div key={col} className="shrink-0 w-72">
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 ${statusBg(col)}`}>
              <span className="text-sm font-semibold">{colLabel(col)}</span>
              <span className="text-xs bg-white/60 px-1.5 py-0.5 rounded-full">{colRooms.length}</span>
            </div>
            <div className="space-y-3">
              {colRooms.map(r => <DealCard key={r.id} room={r} compact canManage={canManage} onSave={onSave} onEoi={onEoi} onEdit={onEdit} onDelete={onDelete} />)}
              {colRooms.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No deals</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Deal Card ──────────────────────────────────────────────────────────────────
function DealCard({ room, compact = false, canManage, onSave, onEoi, onEdit, onDelete }: {
  room: DealRoom
  compact?: boolean
  canManage: boolean
  onSave: (r: DealRoom, e: React.MouseEvent) => void
  onEoi:  (r: DealRoom) => void
  onEdit: (r: DealRoom) => void
  onDelete: (r: DealRoom) => void
}) {
  const deadlineClose = room.eoi_deadline
    ? Math.ceil((new Date(room.eoi_deadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const deadlineUrgent = deadlineClose !== null && deadlineClose <= 7;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition flex flex-col">
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <Link href={`/dashboard/deal-rooms/${room.id}`} className="font-semibold text-gray-900 hover:text-brand-gold truncate block">
              {room.name}
            </Link>
            {room.project_name && <p className="text-xs text-gray-500 truncate">{room.project_name}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Save button */}
            <button
              onClick={e => onSave(room, e)}
              className={`p-1 rounded transition ${room.is_saved ? 'text-brand-gold' : 'text-gray-300 hover:text-gray-500'}`}
              title={room.is_saved ? 'Unsave' : 'Save'}
            >
              <svg className="w-4 h-4" fill={room.is_saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(room.status)}`}>
              {colLabel(room.status)}
            </span>
          </div>
        </div>

        {/* Deal type + raise */}
        <div className="flex flex-wrap gap-2 mb-3">
          {room.deal_type && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dealTypeBadge(room.deal_type)}`}>
              {room.deal_type}
            </span>
          )}
          {room.project_sector && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">{room.project_sector}</span>
          )}
          {room.project_country && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">{room.project_country}</span>
          )}
        </div>

        {/* Financials */}
        {!compact && (
          <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
            {room.target_raise && (
              <div>
                <p className="text-xs text-gray-500">Target Raise</p>
                <p className="font-semibold text-gray-900">{formatMoney(room.target_raise)}</p>
              </div>
            )}
            {room.min_ticket && (
              <div>
                <p className="text-xs text-gray-500">Min Ticket</p>
                <p className="font-semibold text-gray-900">{formatMoney(room.min_ticket)}</p>
              </div>
            )}
          </div>
        )}

        {/* EOI count + deadline */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{room.eoi_count} EOI{room.eoi_count !== 1 ? 's' : ''}</span>
          {deadlineClose !== null && (
            <span className={deadlineUrgent ? 'text-red-600 font-semibold' : ''}>
              {deadlineClose <= 0 ? 'Deadline passed' : `${deadlineClose}d left`}
            </span>
          )}
        </div>

        {/* NDA / video / chat badges */}
        <div className="flex gap-2 mt-2">
          {room.require_nda && <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">NDA</span>}
          {room.is_video_enabled && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Video</span>}
          {room.is_chat_enabled && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Chat</span>}
        </div>
      </div>

      {/* Action row */}
      <div className="px-4 pb-4 mt-auto">
        <div className="flex gap-2 mb-2">
          <Link
            href={`/dashboard/deal-rooms/${room.id}`}
            className="flex-1 px-2 py-1.5 text-xs text-center text-brand-gold border border-brand-gold rounded-lg hover:bg-brand-gold/5 transition font-medium"
          >
            Open Room
          </Link>
          {!canManage && (
            <button
              onClick={() => onEoi(room)}
              className="flex-1 px-2 py-1.5 text-xs text-white bg-brand-navy rounded-lg hover:bg-brand-navy/90 transition font-medium"
            >
              Express Interest
            </button>
          )}
          {canManage && (
            <button
              onClick={() => onEoi(room)}
              className="flex-1 px-2 py-1.5 text-xs text-white bg-brand-navy rounded-lg hover:bg-brand-navy/90 transition font-medium"
            >
              View EOIs
            </button>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(room)}
              className="flex-1 px-2 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
              title="Edit"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(room)}
              className="flex-1 px-2 py-1.5 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition font-medium"
              title="Delete"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatMoney(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function colLabel(status: string) {
  const m: Record<string, string> = { ACTIVE: 'Active', NEGOTIATING: 'Negotiating', CLOSED: 'Closed', ARCHIVED: 'Archived' };
  return m[status] ?? status;
}

function statusBg(s: string) {
  const m: Record<string, string> = {
    ACTIVE:      'bg-green-100 text-green-900',
    NEGOTIATING: 'bg-yellow-100 text-yellow-900',
    CLOSED:      'bg-blue-100 text-blue-900',
    ARCHIVED:    'bg-gray-100 text-gray-700',
  };
  return m[s] ?? 'bg-gray-100 text-gray-700';
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    ACTIVE:      'bg-green-100 text-green-800',
    NEGOTIATING: 'bg-yellow-100 text-yellow-800',
    CLOSED:      'bg-blue-100 text-blue-800',
    ARCHIVED:    'bg-gray-100 text-gray-600',
  };
  return m[s] ?? 'bg-gray-100 text-gray-600';
}

function dealTypeBadge(t: string) {
  const m: Record<string, string> = {
    EQUITY:     'bg-purple-100 text-purple-800',
    DEBT:       'bg-blue-100 text-blue-800',
    GRANT:      'bg-teal-100 text-teal-800',
    PPP:        'bg-orange-100 text-orange-800',
    MEZZANINE:  'bg-pink-100 text-pink-800',
  };
  return m[t] ?? 'bg-gray-100 text-gray-700';
}
