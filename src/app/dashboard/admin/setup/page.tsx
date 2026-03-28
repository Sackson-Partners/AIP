'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRBAC } from '@/hooks/useRBAC';
import { useAuth } from '@/context/AuthContext';
import { projectsApi, investorsApi, usersApi, verificationsApi } from '@/lib/api';
import Link from 'next/link';

interface PlatformStats {
  projects: number;
  investors: number;
  users: number;
  verifications: number;
}

interface RecentUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  created_at?: string;
}

export default function AdminSetupPage() {
  const { isAdmin } = useRBAC();
  const { isLoading: rbacLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [apiHealth, setApiHealth] = useState<'checking' | 'ok' | 'error'>('checking');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!rbacLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAdmin, rbacLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      try {
        const [projects, investors, users, verifications] = await Promise.allSettled([
          projectsApi.list(),
          investorsApi.list(),
          usersApi.listUsers(),
          verificationsApi.list(),
        ]);

        setStats({
          projects:      projects.status      === 'fulfilled' ? projects.value.length      : 0,
          investors:     investors.status     === 'fulfilled' ? investors.value.length     : 0,
          users:         users.status         === 'fulfilled' ? users.value.length         : 0,
          verifications: verifications.status === 'fulfilled' ? verifications.value.length : 0,
        });

        if (users.status === 'fulfilled') {
          setRecentUsers(users.value.slice(0, 8) as RecentUser[]);
        }

        setApiHealth('ok');
      } catch {
        setApiHealth('error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  if (rbacLoading || (!isAdmin && !rbacLoading)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Setup</h1>
          <p className="text-gray-400 mt-1">Platform health, statistics, and quick actions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${apiHealth === 'ok' ? 'bg-green-500' : apiHealth === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
          <span className="text-sm text-gray-400">
            API {apiHealth === 'ok' ? 'Healthy' : apiHealth === 'error' ? 'Unreachable' : 'Checking…'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Projects',      value: stats?.projects,      href: '/dashboard/projects',    color: 'text-blue-400'   },
          { label: 'Investors',     value: stats?.investors,     href: '/dashboard/investors',   color: 'text-teal-400'   },
          { label: 'Users',         value: stats?.users,         href: '/dashboard/users',       color: 'text-purple-400' },
          { label: 'Verifications', value: stats?.verifications, href: '/dashboard/verifications', color: 'text-green-400' },
        ].map(({ label, value, href, color }) => (
          <Link key={label} href={href} className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 transition">
            <div className={`text-3xl font-bold ${color}`}>
              {isLoading ? '—' : (value ?? 0)}
            </div>
            <div className="text-gray-400 text-sm mt-1">{label}</div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Manage Users',        href: '/dashboard/users',         desc: 'Activate, deactivate, verify accounts' },
            { label: 'View Pipeline',        href: '/dashboard/pipeline',       desc: 'Move projects between stages'          },
            { label: 'IC Committee',         href: '/dashboard/ic',             desc: 'Manage investment committee votes'     },
            { label: 'Integrations',         href: '/dashboard/integrations',   desc: 'Configure third-party connections'     },
            { label: 'Analytics',            href: '/dashboard/analytics',      desc: 'Platform usage and activity reports'   },
            { label: 'Verifications',        href: '/dashboard/verifications',  desc: 'Review project verification levels'    },
          ].map(({ label, href, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-1 p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-blue-600 hover:bg-gray-800 transition"
            >
              <span className="text-sm font-medium text-white">{label}</span>
              <span className="text-xs text-gray-500">{desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Registrations */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Registrations</h2>
          <Link href="/dashboard/users" className="text-sm text-blue-400 hover:text-blue-300">
            View all →
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : recentUsers.length === 0 ? (
          <p className="text-gray-500 text-sm">No users yet.</p>
        ) : (
          <div className="divide-y divide-gray-700">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-white">{u.full_name || u.email}</div>
                  {u.full_name && <div className="text-xs text-gray-500">{u.email}</div>}
                </div>
                <div className="flex items-center gap-3">
                  {u.role && (
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded capitalize">
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  )}
                  {u.created_at && (
                    <span className="text-xs text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supabase config reminder */}
      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-yellow-300 mb-2">Supabase Configuration Checklist</h3>
        <ul className="text-sm text-yellow-200/80 space-y-1 list-disc list-inside">
          <li>Auth → URL Configuration → Site URL set to <code className="text-yellow-100">https://app.africa-infra.com</code></li>
          <li>Auth → URL Configuration → Redirect URLs includes <code className="text-yellow-100">https://app.africa-infra.com/auth/callback</code></li>
          <li>Auth → Email Templates → Confirm signup → confirm URL uses <code className="text-yellow-100">{`{{ .SiteURL }}/auth/callback?code={{ .Code }}`}</code></li>
          <li>Database → RLS policies enabled on all tables</li>
        </ul>
      </div>

    </div>
  );
}
