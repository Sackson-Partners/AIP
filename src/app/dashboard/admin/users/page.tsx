'use client';

import { useEffect, useState, useMemo } from 'react';
import AdminGuard from '@/components/AdminGuard';
import { usersApi } from '@/lib/api';
import type { User } from '@/lib/api';

const ROLES = [
  { value: 'super_admin',        label: 'Super Admin'    },
  { value: 'private_fund',       label: 'Private Fund'   },
  { value: 'dfi',                label: 'DFI'            },
  { value: 'epc_contractor',     label: 'EPC Contractor' },
  { value: 'government',         label: 'Government'     },
  { value: 'academic',           label: 'Academic'       },
  { value: 'journalist_analyst', label: 'Analyst'        },
  { value: 'investor',           label: 'Investor'       },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin:        'bg-red-900/40 text-red-300',
  private_fund:       'bg-teal-900/40 text-teal-300',
  dfi:                'bg-blue-900/40 text-blue-300',
  epc_contractor:     'bg-yellow-900/40 text-yellow-300',
  government:         'bg-green-900/40 text-green-300',
  academic:           'bg-purple-900/40 text-purple-300',
  journalist_analyst: 'bg-gray-700 text-gray-300',
  investor:           'bg-orange-900/40 text-orange-300',
};

function AdminUsersContent() {
  const [users, setUsers]         = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating]   = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    usersApi.list()
      .then((data) => setUsers(data))
      .catch(() => setError('Failed to load users'))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.full_name ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesRole   = !roleFilter   || u.role === roleFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active'   &&  u.is_active) ||
        (statusFilter === 'inactive' && !u.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const updateUser = async (id: string, patch: Partial<User>) => {
    setUpdating(id);
    try {
      const updated = await usersApi.update(id, patch);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    } catch {
      setError('Failed to update user');
    } finally {
      setUpdating(null);
    }
  };

  const toggleActive = async (u: User) => {
    if (u.is_active) {
      await updateUser(u.id, { is_active: false });
    } else {
      await updateUser(u.id, { is_active: true });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-gray-400 mt-1">Manage roles, status, and access for all platform users</p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: users.length,                        color: 'text-white'        },
          { label: 'Active',   value: users.filter(u => u.is_active).length,  color: 'text-green-400' },
          { label: 'Inactive', value: users.filter(u => !u.is_active).length, color: 'text-red-400'   },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{isLoading ? '—' : value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No users match the current filters.</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-4">User</div>
              <div className="col-span-3">Role</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Joined</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {filtered.map((u) => (
              <div key={u.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-750 transition-colors">

                {/* User */}
                <div className="col-span-4 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{u.full_name || '—'}</div>
                  <div className="text-xs text-gray-500 truncate">{u.email}</div>
                </div>

                {/* Role dropdown */}
                <div className="col-span-3">
                  <select
                    value={u.role ?? ''}
                    disabled={updating === u.id}
                    onChange={(e) => updateUser(u.id, { role: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">No role</option>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                {/* Status badge */}
                <div className="col-span-2">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Joined */}
                <div className="col-span-2 text-xs text-gray-500">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={updating === u.id}
                    className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                      u.is_active
                        ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                        : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                    }`}
                  >
                    {updating === u.id ? '...' : u.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {!isLoading && (
        <p className="text-xs text-gray-600">
          Showing {filtered.length} of {users.length} users
        </p>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <AdminUsersContent />
    </AdminGuard>
  );
}
