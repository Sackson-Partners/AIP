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

function AdminUsersContent() {
  const [users, setUsers]             = useState<User[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating]       = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

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
        (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.organization ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.country ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesRole   = !roleFilter || u.role === roleFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active'     &&  u.is_active) ||
        (statusFilter === 'inactive'   && !u.is_active) ||
        (statusFilter === 'verified'   &&  u.is_verified) ||
        (statusFilter === 'unverified' && !u.is_verified);
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

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-gray-400 mt-1">Manage roles, verification, and access for all platform users</p>
      </div>

      {error && (
        <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search name, email, org, country..."
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
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total',      value: users.length,                          color: 'text-white'        },
          { label: 'Active',     value: users.filter(u => u.is_active).length,   color: 'text-green-400' },
          { label: 'Verified',   value: users.filter(u => u.is_verified).length, color: 'text-blue-400'  },
          { label: 'Inactive',   value: users.filter(u => !u.is_active).length,  color: 'text-red-400'   },
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
          <div className="space-y-px p-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-700 rounded animate-pulse mb-1" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No users match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Organization / Country</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Verified</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Active</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-750 transition-colors">

                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-white truncate max-w-[200px]">{u.full_name || '—'}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{u.email}</div>
                      {u.phone && <div className="text-xs text-gray-600 mt-0.5">{u.phone}</div>}
                    </td>

                    {/* Org / Country */}
                    <td className="px-4 py-3">
                      <div className="text-white text-xs truncate max-w-[160px]">{u.organization || '—'}</div>
                      {u.country && (
                        <div className="text-gray-500 text-xs mt-0.5">{u.country}</div>
                      )}
                    </td>

                    {/* Role dropdown */}
                    <td className="px-4 py-3">
                      <select
                        value={u.role ?? ''}
                        disabled={updating === u.id}
                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                        className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 w-full max-w-[140px]"
                      >
                        <option value="">No role</option>
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>

                    {/* Verified toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateUser(u.id, { is_verified: !u.is_verified })}
                        disabled={updating === u.id}
                        className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                          u.is_verified
                            ? 'bg-blue-900/40 text-blue-300 hover:bg-blue-900/60'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {updating === u.id ? '...' : u.is_verified ? 'Verified' : 'Verify'}
                      </button>
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                        disabled={updating === u.id}
                        className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                          u.is_active
                            ? 'bg-green-900/40 text-green-300 hover:bg-green-900/60'
                            : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                        }`}
                      >
                        {updating === u.id ? '...' : u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
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
