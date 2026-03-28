'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { projectsApi, investorsApi, verificationsApi, eventsApi, Project } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useRBAC, USER_ROLES, UserRole } from '../../hooks/useRBAC';

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICONS = {
  folder:   'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  users:    'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  shield:   'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  bolt:     'M13 10V3L4 14h7v7l9-11h-7z',
  chart:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  clip:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  doc:      'M9 12h6m-6 4h6M5 8h14M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  gavel:    'M3 6l3 1m0 0l-3 9a5 5 0 006.516 6.916M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 01-6.516 6.916M18 7l3 9m-3-9l-6-2M6 7H3m15 0h3M6 7v1m12-1v1',
  database: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
  plus:     'M12 4.5v15m7.5-7.5h-15',
  deal:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  cog:      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  eye:      'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

const STAGE_COLORS: Record<string, string> = {
  planned:          'bg-gray-100 text-gray-700',
  'pre-feasibility':'bg-blue-100 text-blue-700',
  feasibility:      'bg-indigo-100 text-indigo-700',
  procurement:      'bg-yellow-100 text-yellow-700',
  construction:     'bg-orange-100 text-orange-700',
  operational:      'bg-green-100 text-green-700',
};

function StatCard({ label, value, icon, href }: { label: string; value: number | string; icon: string; href: string }) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-gold/40 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-brand-navy mt-1">{value}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-brand-gold/10 flex items-center justify-center shrink-0">
            <Icon d={ICONS[icon as keyof typeof ICONS]} className="w-5 h-5 text-brand-gold" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function QuickAction({ label, desc, icon, href }: { label: string; desc: string; icon: string; href: string }) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-gold/40 hover:shadow-sm transition-all flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-brand-navy flex items-center justify-center shrink-0">
          <Icon d={ICONS[icon as keyof typeof ICONS]} className="w-4 h-4 text-brand-gold" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 truncate">{desc}</p>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ icon, title, desc, href, cta }: { icon: string; title: string; desc: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon d={ICONS[icon as keyof typeof ICONS]} className="w-7 h-7 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">{desc}</p>
      {href && cta && (
        <Link href={href} className="mt-4 px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-sm font-semibold rounded-lg transition-colors">
          {cta}
        </Link>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const { role } = useRBAC();

  const [stats, setStats] = useState({ projects: 0, investors: 0, verifications: 0, events: 0 });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projects, investors, verifications, events] = await Promise.allSettled([
          projectsApi.list(),
          investorsApi.list(),
          verificationsApi.list(),
          eventsApi.list(),
        ]);
        const p = projects.status === 'fulfilled' ? projects.value : [];
        const i = investors.status === 'fulfilled' ? investors.value : [];
        const v = verifications.status === 'fulfilled' ? verifications.value : [];
        const e = events.status === 'fulfilled' ? events.value : [];
        setStats({ projects: p.length, investors: i.length, verifications: v.length, events: e.length });
        setRecentProjects(p.slice(0, 6));
      } catch {
        // silently fail — empty state handles this
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'there';
  const roleInfo = USER_ROLES[role as UserRole];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Role-specific stats config
  const statCards = (() => {
    switch (role) {
      case 'super_admin':
        return [
          { label: 'Total Projects',      value: stats.projects,      icon: 'folder',   href: '/dashboard/projects' },
          { label: 'Investors',           value: stats.investors,     icon: 'users',    href: '/dashboard/investors' },
          { label: 'Verifications',       value: stats.verifications, icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'Events',              value: stats.events,        icon: 'calendar', href: '/dashboard/events' },
        ];
      case 'private_fund':
      case 'dfi':
        return [
          { label: 'Pipeline Projects',   value: stats.projects,      icon: 'bolt',     href: '/dashboard/pipeline' },
          { label: 'Investors',           value: stats.investors,     icon: 'deal',     href: '/dashboard/investors' },
          { label: 'Verifications',       value: stats.verifications, icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'IC Sessions',         value: '—',                 icon: 'gavel',    href: '/dashboard/ic' },
        ];
      case 'epc_contractor':
        return [
          { label: 'My Projects',         value: stats.projects,      icon: 'folder',   href: '/dashboard/projects' },
          { label: 'Pipeline Status',     value: '—',                 icon: 'bolt',     href: '/dashboard/pipeline' },
          { label: 'Data Rooms',          value: '—',                 icon: 'database', href: '/dashboard/data-rooms' },
          { label: 'Events',              value: stats.events,        icon: 'calendar', href: '/dashboard/events' },
        ];
      case 'government':
        return [
          { label: 'Curated Projects',    value: stats.projects,      icon: 'folder',   href: '/dashboard/projects' },
          { label: 'Active Investors',    value: stats.investors,     icon: 'users',    href: '/dashboard/investors' },
          { label: 'Verifications',       value: stats.verifications, icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'Events',              value: stats.events,        icon: 'calendar', href: '/dashboard/events' },
        ];
      default: // academic, journalist_analyst, investor
        return [
          { label: 'Published Projects',  value: stats.projects,      icon: 'folder',   href: '/dashboard/projects' },
          { label: 'Verifications',       value: stats.verifications, icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'Investors',           value: stats.investors,     icon: 'users',    href: '/dashboard/investors' },
          { label: 'Events',              value: stats.events,        icon: 'calendar', href: '/dashboard/events' },
        ];
    }
  })();

  const quickActions = (() => {
    switch (role) {
      case 'super_admin':
        return [
          { label: 'New Project',       desc: 'Add a project to the platform',    icon: 'plus',     href: '/dashboard/projects' },
          { label: 'Manage Users',      desc: 'View and manage platform users',   icon: 'users',    href: '/dashboard/admin/users' },
          { label: 'View Analytics',    desc: 'Platform-wide performance data',   icon: 'chart',    href: '/dashboard/analytics' },
          { label: 'Admin Settings',    desc: 'System configuration and setup',   icon: 'cog',      href: '/dashboard/admin/settings' },
          { label: 'Run PESTEL',        desc: 'Start a PESTEL risk assessment',   icon: 'clip',     href: '/dashboard/pestel' },
          { label: 'Generate EIN',      desc: 'Create executive investment note', icon: 'doc',      href: '/dashboard/ein' },
        ];
      case 'private_fund':
      case 'dfi':
        return [
          { label: 'New Project',       desc: 'Add a project to pipeline',        icon: 'plus',     href: '/dashboard/projects' },
          { label: 'View Pipeline',     desc: 'Manage deal-flow stages',          icon: 'bolt',     href: '/dashboard/pipeline' },
          { label: 'Run PESTEL',        desc: 'Start a PESTEL risk assessment',   icon: 'clip',     href: '/dashboard/pestel' },
          { label: 'Generate EIN',      desc: 'Create executive investment note', icon: 'doc',      href: '/dashboard/ein' },
          { label: 'IC Committee',      desc: 'Investment committee sessions',    icon: 'gavel',    href: '/dashboard/ic' },
          { label: 'Browse Investors',  desc: 'Search the investor directory',    icon: 'deal',     href: '/dashboard/investors' },
        ];
      case 'epc_contractor':
        return [
          { label: 'Submit Project',    desc: 'Submit a new infrastructure project', icon: 'plus',  href: '/dashboard/projects' },
          { label: 'View Pipeline',     desc: 'Track project approval stages',    icon: 'bolt',     href: '/dashboard/pipeline' },
          { label: 'Data Rooms',        desc: 'Upload project documentation',     icon: 'database', href: '/dashboard/data-rooms' },
          { label: 'My PIS',           desc: 'Project information sheets',       icon: 'clip',     href: '/dashboard/pis' },
        ];
      case 'government':
        return [
          { label: 'Browse Projects',   desc: 'View curated project pipeline',   icon: 'folder',   href: '/dashboard/projects' },
          { label: 'View Investors',    desc: 'Search the investor directory',    icon: 'users',    href: '/dashboard/investors' },
          { label: 'Download Reports',  desc: 'PESTEL summaries and analysis',   icon: 'download', href: '/dashboard/pestel' },
          { label: 'Events',            desc: 'Infrastructure events calendar',  icon: 'calendar', href: '/dashboard/events' },
        ];
      default: // academic, journalist, investor
        return [
          { label: 'Browse Projects',   desc: 'Explore verified infrastructure', icon: 'eye',      href: '/dashboard/projects' },
          { label: 'Verifications',     desc: 'View verification reports',       icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'PESTEL Reports',    desc: 'Risk and environment summaries',  icon: 'clip',     href: '/dashboard/pestel' },
          { label: 'Events',            desc: 'Infrastructure events calendar',  icon: 'calendar', href: '/dashboard/events' },
        ];
    }
  })();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">
            {greeting()}, {displayName.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profile?.organization && `${profile.organization} · `}
            {roleInfo?.label ?? 'AIP Platform'}
          </p>
        </div>
        {roleInfo && (
          <span className="hidden sm:inline-block text-xs text-white px-2.5 py-1 rounded font-medium bg-brand-navy">
            {roleInfo.label}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map(a => (
            <QuickAction key={a.label} {...a} />
          ))}
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Projects</h2>
          <Link href="/dashboard/projects" className="text-sm text-brand-gold hover:text-brand-gold-dark transition-colors">
            View all →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {recentProjects.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentProjects.map(project => (
                <div key={project.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{project.project_name || project.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[project.sector, project.country].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`ml-3 shrink-0 px-2 py-0.5 text-xs rounded-full ${STAGE_COLORS[project.status || project.stage || ''] || 'bg-gray-100 text-gray-700'}`}>
                    {project.status || project.stage || 'planned'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="folder"
              title="No projects yet"
              desc="Projects added to the platform will appear here."
              href="/dashboard/projects"
              cta="Add First Project"
            />
          )}
        </div>
      </div>

    </div>
  );
}
