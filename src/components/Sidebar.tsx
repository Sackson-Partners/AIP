'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRBAC, Permission, USER_ROLES } from '@/hooks/useRBAC';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions?: Permission[];
  adminOnly?: boolean;
}

const ICONS: Record<string, string> = {
  home:     "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  folder:   "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  file:     "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  clip:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  doc:      "M9 12h6m-6 4h6M5 8h14M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  bolt:     "M13 10V3L4 14h7v7l9-11h-7z",
  gavel:    "M3 6l3 1m0 0l-3 9a5 5 0 006.516 6.916M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 01-6.516 6.916M18 7l3 9m-3-9l-6-2M6 7H3m15 0h3M6 7v1m12-1v1",
  users:    "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  shield:   "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  database: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  deal:     "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  chart:    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  group:    "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  puzzle:   "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z",
  logout:   "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
};

function SvgIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[iconKey]} />
    </svg>
  );
}

function makeIcon(iconKey: string) {
  return function NavIcon({ className }: { className?: string }) {
    return <SvgIcon iconKey={iconKey} className={className} />;
  };
}

const navigation: NavItem[] = [
  { name: 'Dashboard',     href: '/dashboard',               icon: makeIcon('home') },
  { name: 'Projects',      href: '/dashboard/projects',      icon: makeIcon('folder'),   requiredPermissions: ['view_all_projects','view_own_projects','view_curated_projects','view_approved_projects'] },
  { name: 'PIS',           href: '/dashboard/pis',           icon: makeIcon('file'),     requiredPermissions: ['view_all_projects','view_own_projects','view_curated_projects','view_approved_projects'] },
  { name: 'PESTEL',        href: '/dashboard/pestel',        icon: makeIcon('clip'),     requiredPermissions: ['run_pestel','view_pestel_full','view_pestel_summary'] },
  { name: 'EIN',           href: '/dashboard/ein',           icon: makeIcon('doc'),      requiredPermissions: ['generate_ein','edit_ein','view_approved_ein','view_ein_approved_only'] },
  { name: 'Pipeline',      href: '/dashboard/pipeline',      icon: makeIcon('bolt'),     requiredPermissions: ['view_pipeline'] },
  { name: 'IC',            href: '/dashboard/ic',            icon: makeIcon('gavel'),    requiredPermissions: ['vote_ic','manage_ic'] },
  { name: 'Investors',     href: '/dashboard/investors',     icon: makeIcon('users'),    requiredPermissions: ['view_all_projects','view_curated_projects'] },
  { name: 'Verifications', href: '/dashboard/verifications', icon: makeIcon('shield'),   requiredPermissions: ['view_all_projects','run_pestel'] },
  { name: 'Data Rooms',    href: '/dashboard/data-rooms',    icon: makeIcon('database'), requiredPermissions: ['upload_documents','upload_own_documents'] },
  { name: 'Deal Rooms',    href: '/dashboard/deal-rooms',    icon: makeIcon('deal'),     requiredPermissions: ['view_all_projects','view_approved_projects'] },
  { name: 'Analytics',     href: '/dashboard/analytics',     icon: makeIcon('chart'),    requiredPermissions: ['view_analytics','view_all_projects'] },
  { name: 'Events',        href: '/dashboard/events',        icon: makeIcon('calendar'), requiredPermissions: ['view_all_projects','view_approved_projects'] },
  { name: 'Users',         href: '/dashboard/users',          icon: makeIcon('group'),    requiredPermissions: ['manage_users'],        adminOnly: true },
  { name: 'Integrations',  href: '/dashboard/integrations',   icon: makeIcon('puzzle'),   requiredPermissions: ['manage_integrations'], adminOnly: true },
  { name: 'Admin Users',   href: '/dashboard/admin/users',    icon: makeIcon('group'),    requiredPermissions: ['manage_users'],        adminOnly: true },
  { name: 'Admin Settings',href: '/dashboard/admin/settings', icon: makeIcon('database'), requiredPermissions: ['manage_users'],        adminOnly: true },
  { name: 'Admin Setup',   href: '/dashboard/admin/setup',    icon: makeIcon('shield'),   requiredPermissions: ['manage_users'],        adminOnly: true },
];

const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin:        'bg-red-600',
  private_fund:       'bg-teal-600',
  dfi:                'bg-blue-600',
  epc_contractor:     'bg-yellow-600',
  government:         'bg-green-600',
  academic:           'bg-purple-600',
  journalist_analyst: 'bg-gray-500',
  investor:           'bg-orange-500',
};

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { role, canAny } = useRBAC();

  const visibleNavigation = useMemo(() => {
    return navigation.filter((item) => {
      if (!item.requiredPermissions) return true;
      return canAny(item.requiredPermissions);
    });
  }, [canAny]);

  const roleInfo = USER_ROLES[role];

  return (
    <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col h-full shrink-0">

      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
          A
        </div>
        <span className="font-semibold text-white">AIP Platform</span>
      </div>

      {user && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-white">
                {(user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.user_metadata?.full_name || user.email}
              </p>
              {roleInfo && (
                <span className={`inline-block text-xs text-white px-1.5 py-0.5 rounded mt-0.5 ${ROLE_BADGE_COLORS[role] ?? 'bg-gray-500'}`}>
                  {roleInfo.label}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {visibleNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{item.name}</span>
              {item.adminOnly && (
                <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded">Admin</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <SvgIcon iconKey="logout" className="w-5 h-5 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
