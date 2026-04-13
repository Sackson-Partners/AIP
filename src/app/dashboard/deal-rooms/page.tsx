'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { projectsApi, dealRoomsApi } from '../../../lib/api';

interface DealRoom {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  status: string;
  deal_value: number | null;
  deal_currency: string;
  target_close_date: string | null;
  is_video_enabled: boolean;
  is_chat_enabled: boolean;
  require_nda: boolean;
  created_at: string;
  member_count?: number;
  document_count?: number;
}

interface Project {
  id: number;
  name: string;
}

export default function DealRoomsPage() {
  const [dealRooms, setDealRooms] = useState<DealRoom[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDealRoom, setNewDealRoom] = useState({
    project_id: 0,
    name: '',
    description: '',
    deal_value: '',
    target_close_date: '',
    require_nda: true,
    is_video_enabled: true,
    is_chat_enabled: true
  });
  useEffect(() => {
    fetchDealRooms();
    fetchProjects();
  }, []);

  const fetchDealRooms = async () => {
    try {
      const data = await dealRoomsApi.list() as DealRoom[];
      setDealRooms(data ?? []);
    } catch {
      setError('Failed to load deal rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const data = await projectsApi.list() as Project[];
      setProjects(data ?? []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const handleCreateDealRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate project selection
    if (!newDealRoom.project_id || newDealRoom.project_id === 0) {
      setError('Please select a project');
      return;
    }
    if (!newDealRoom.name.trim()) {
      setError('Please enter a deal room name');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        project_id: Number(newDealRoom.project_id),
        name: newDealRoom.name,
        description: newDealRoom.description || undefined,
        deal_value: newDealRoom.deal_value ? Number(newDealRoom.deal_value) : undefined,
        target_close_date: newDealRoom.target_close_date || undefined,
        require_nda: newDealRoom.require_nda,
        is_video_enabled: newDealRoom.is_video_enabled,
        is_chat_enabled: newDealRoom.is_chat_enabled
      };

      await dealRoomsApi.create(payload);
      setShowCreateModal(false);
      setNewDealRoom({
        project_id: 0,
        name: '',
        description: '',
        deal_value: '',
        target_close_date: '',
        require_nda: true,
        is_video_enabled: true,
        is_chat_enabled: true
      });
      fetchDealRooms();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || 'Failed to create deal room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      negotiating: 'bg-yellow-100 text-yellow-800',
      closed_won: 'bg-blue-100 text-blue-800',
      closed_lost: 'bg-red-100 text-red-800',
      archived: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (value: number | null, currency: string) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deal Rooms</h1>
          <p className="text-gray-600 mt-1">Manage negotiations, documents, and video calls with investors</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Deal Room
        </button>
      </div>

      {error && !showCreateModal && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {dealRooms.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Deal Rooms Yet</h3>
          <p className="mt-2 text-gray-500">Create your first deal room to start collaborating with investors.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Create Your First Deal Room
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {dealRooms.map((room) => (
            <Link
              key={room.id}
              href={`/dashboard/deal-rooms/${room.id}`}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 truncate">{room.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                  {room.status.replace('_', ' ')}
                </span>
              </div>

              {room.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{room.description}</p>
              )}

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Deal Value: {formatCurrency(room.deal_value, room.deal_currency)}</span>
                </div>

                {room.target_close_date && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Target: {new Date(room.target_close_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {room.is_video_enabled && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Video
                    </span>
                  )}
                  {room.is_chat_enabled && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Chat
                    </span>
                  )}
                  {room.require_nda && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      NDA
                    </span>
                  )}
                </div>
                <span className="text-indigo-600 text-sm font-medium">View →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Deal Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create New Deal Room</h2>
              <button onClick={() => { setShowCreateModal(false); setError(null); }} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateDealRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                <select
                  required
                  value={newDealRoom.project_id}
                  onChange={(e) => setNewDealRoom({ ...newDealRoom, project_id: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value={0}>Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deal Room Name *</label>
                <input
                  type="text"
                  required
                  value={newDealRoom.name}
                  onChange={(e) => setNewDealRoom({ ...newDealRoom, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Series A Negotiation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newDealRoom.description}
                  onChange={(e) => setNewDealRoom({ ...newDealRoom, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Brief description of this deal room"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value (USD)</label>
                  <input
                    type="number"
                    value={newDealRoom.deal_value}
                    onChange={(e) => setNewDealRoom({ ...newDealRoom, deal_value: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="10000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Close Date</label>
                  <input
                    type="date"
                    value={newDealRoom.target_close_date}
                    onChange={(e) => setNewDealRoom({ ...newDealRoom, target_close_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newDealRoom.require_nda}
                    onChange={(e) => setNewDealRoom({ ...newDealRoom, require_nda: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Require NDA for access</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newDealRoom.is_video_enabled}
                    onChange={(e) => setNewDealRoom({ ...newDealRoom, is_video_enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Enable video conferencing</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newDealRoom.is_chat_enabled}
                    onChange={(e) => setNewDealRoom({ ...newDealRoom, is_chat_enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Enable chat messaging</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating…' : 'Create Deal Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
