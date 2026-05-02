'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { projectsApi, investorsApi, verificationsApi, eventsApi, Project } from '../../lib/api';
import { useSession } from 'next-auth/react';
import { useRBAC, USER_ROLES } from '../../hooks/useRBAC';
import { UserRole } from '@prisma/client';
import { StatCardsSkeleton } from '@/components/ui/Skeleton';

// Dynamically load the Leaflet map — SSR must be disabled
const MapPanel = dynamic(() => import('../../components/dashboard/MapPanel'), { ssr: false });

// ─── Icons ────────────────────────────────────────────────────────────────────

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
  globe:    'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  sparkles: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  map:      'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
};

// ─── Stage config ─────────────────────────────────────────────────────────────

const DEAL_STAGES = [
  { key: 'CONCEPT',         label: 'Concept',          color: 'gray'   },
  { key: 'PRE_FEASIBILITY', label: 'Pre-Feasibility',  color: 'blue'   },
  { key: 'FEASIBILITY',     label: 'Feasibility',      color: 'indigo' },
  { key: 'STRUCTURING',     label: 'Structuring',      color: 'purple' },
  { key: 'PROCUREMENT',     label: 'Procurement',      color: 'yellow' },
  { key: 'FINANCIAL_CLOSE', label: 'Financial Close',  color: 'amber'  },
  { key: 'CONSTRUCTION',    label: 'Construction',     color: 'orange' },
  { key: 'OPERATIONS',      label: 'Operations',       color: 'green'  },
];

// Map legacy stage strings → canonical DEAL_STAGES keys
const STAGE_ALIAS: Record<string, string> = {
  planned:          'CONCEPT',
  concept:          'CONCEPT',
  'pre-feasibility':'PRE_FEASIBILITY',
  prefeasibility:   'PRE_FEASIBILITY',
  feasibility:      'FEASIBILITY',
  structuring:      'STRUCTURING',
  procurement:      'PROCUREMENT',
  financial_close:  'FINANCIAL_CLOSE',
  construction:     'CONSTRUCTION',
  operational:      'OPERATIONS',
  operations:       'OPERATIONS',
};

const STAGE_BG: Record<string, string> = {
  gray:   'bg-gray-100 text-gray-700 border-gray-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  amber:  'bg-amber-50 text-amber-700 border-amber-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  green:  'bg-green-50 text-green-700 border-green-200',
};

const STAGE_HEADER: Record<string, string> = {
  gray:   'bg-gray-50 border-gray-200',
  blue:   'bg-blue-50 border-blue-200',
  indigo: 'bg-indigo-50 border-indigo-200',
  purple: 'bg-purple-50 border-purple-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  amber:  'bg-amber-50 border-amber-200',
  orange: 'bg-orange-50 border-orange-200',
  green:  'bg-green-50 border-green-200',
};

const STAGE_DOT: Record<string, string> = {
  gray:   'bg-gray-400',
  blue:   'bg-blue-500',
  indigo: 'bg-indigo-500',
  purple: 'bg-purple-500',
  yellow: 'bg-yellow-500',
  amber:  'bg-amber-500',
  orange: 'bg-orange-500',
  green:  'bg-green-500',
};

const LEGACY_STAGE_COLORS: Record<string, string> = {
  planned:           'bg-gray-100 text-gray-700',
  'pre-feasibility': 'bg-blue-100 text-blue-700',
  feasibility:       'bg-indigo-100 text-indigo-700',
  procurement:       'bg-yellow-100 text-yellow-700',
  construction:      'bg-orange-100 text-orange-700',
  operational:       'bg-green-100 text-green-700',
  CONCEPT:           'bg-gray-100 text-gray-700',
  PRE_FEASIBILITY:   'bg-blue-100 text-blue-700',
  PREFEASIBILITY:    'bg-blue-100 text-blue-700',
  FEASIBILITY:       'bg-indigo-100 text-indigo-700',
  STRUCTURING:       'bg-purple-100 text-purple-700',
  PROCUREMENT:       'bg-yellow-100 text-yellow-700',
  FINANCIAL_CLOSE:   'bg-amber-100 text-amber-700',
  CONSTRUCTION:      'bg-orange-100 text-orange-700',
  OPERATIONS:        'bg-green-100 text-green-700',
};

// ─── Country flags ────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  'nigeria': '🇳🇬', 'ghana': '🇬🇭', 'kenya': '🇰🇪', 'ethiopia': '🇪🇹', 'tanzania': '🇹🇿',
  'uganda': '🇺🇬', 'mozambique': '🇲🇿', 'zambia': '🇿🇲', 'zimbabwe': '🇿🇼', 'south africa': '🇿🇦',
  'senegal': '🇸🇳', 'ivory coast': '🇨🇮', "cote d'ivoire": '🇨🇮', 'cameroon': '🇨🇲',
  'morocco': '🇲🇦', 'egypt': '🇪🇬', 'tunisia': '🇹🇳', 'angola': '🇦🇴', 'namibia': '🇳🇦',
  'botswana': '🇧🇼', 'rwanda': '🇷🇼', 'malawi': '🇲🇼', 'madagascar': '🇲🇬', 'congo': '🇨🇩',
  'drc': '🇨🇩', 'sudan': '🇸🇩', 'somalia': '🇸🇴', 'liberia': '🇱🇷', 'sierra leone': '🇸🇱',
  'togo': '🇹🇬', 'benin': '🇧🇯', 'niger': '🇳🇪', 'mali': '🇲🇱', 'burkina faso': '🇧🇫',
  'guinea': '🇬🇳', 'chad': '🇹🇩', 'eritrea': '🇪🇷', 'djibouti': '🇩🇯', 'lesotho': '🇱🇸',
  'eswatini': '🇸🇿', 'swaziland': '🇸🇿', 'gabon': '🇬🇦', 'mauritius': '🇲🇺', 'seychelles': '🇸🇨',
  'india': '🇮🇳', 'pakistan': '🇵🇰', 'bangladesh': '🇧🇩', 'indonesia': '🇮🇩', 'vietnam': '🇻🇳',
  'thailand': '🇹🇭', 'philippines': '🇵🇭', 'malaysia': '🇲🇾', 'brazil': '🇧🇷', 'colombia': '🇨🇴',
  'peru': '🇵🇪', 'chile': '🇨🇱', 'mexico': '🇲🇽', 'usa': '🇺🇸', 'uk': '🇬🇧',
  'france': '🇫🇷', 'germany': '🇩🇪', 'china': '🇨🇳', 'japan': '🇯🇵', 'australia': '🇦🇺',
  'canada': '🇨🇦', 'netherlands': '🇳🇱', 'uae': '🇦🇪', 'saudi arabia': '🇸🇦', 'qatar': '🇶🇦',
};

function countryFlag(country?: string | null): string {
  if (!country) return '🌍';
  return COUNTRY_FLAGS[country.toLowerCase()] ?? '🌍';
}

// ─── Project field helpers ────────────────────────────────────────────────────

function projectTitle(p: Project): string {
  return p.title ?? p.project_name ?? p.name ?? String(p.id);
}

function projectStageKey(p: Project): string {
  const raw = p.dealStage ?? p.stage ?? p.status ?? '';
  return STAGE_ALIAS[raw.toLowerCase()] ?? raw.toUpperCase();
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, href,
}: {
  label: string; value: number | string; icon: string; href: string;
}) {
  return (
    <Link href={href} aria-label={`${label}: ${value}`}>
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

function QuickAction({
  label, desc, icon, href,
}: {
  label: string; desc: string; icon: string; href: string;
}) {
  return (
    <Link href={href} aria-label={label}>
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

function EmptyState({
  icon, title, desc, href, cta,
}: {
  icon: string; title: string; desc: string; href?: string; cta?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon d={ICONS[icon as keyof typeof ICONS]} className="w-7 h-7 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">{desc}</p>
      {href && cta && (
        <Link
          href={href}
          className="mt-4 px-4 py-2 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-sm font-semibold rounded-lg transition-colors"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

// ─── AI Insights Panel ────────────────────────────────────────────────────────

function AIInsightsPanel({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="bg-gradient-to-br from-brand-navy to-slate-800 rounded-xl p-5 text-white h-full flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-3">
          <Icon d={ICONS.sparkles} className="w-4 h-4 text-brand-gold" />
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold">AI Insights</span>
        </div>
        <p className="text-sm text-slate-300">Add projects to surface intelligent insights about your pipeline.</p>
      </div>
    );
  }

  // Derive insights from the projects array
  const sectorCounts = projects.reduce<Record<string, number>>((acc, p) => {
    const s = p.sector ?? 'Unknown';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const topSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];

  const countryCounts = projects.reduce<Record<string, number>>((acc, p) => {
    const c = p.country ?? 'Unknown';
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];

  const advancedStages = ['STRUCTURING', 'PROCUREMENT', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATIONS'];
  const advancedCount = projects.filter((p) => advancedStages.includes(projectStageKey(p))).length;

  const totalCost = projects.reduce((sum, p) => {
    const v = p.totalCost ?? p.estimated_cost ?? p.estimated_capex ?? p.capex ?? 0;
    return sum + v;
  }, 0);

  const formatBig = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return v > 0 ? `$${v.toLocaleString()}` : '—';
  };

  return (
    <div className="bg-gradient-to-br from-brand-navy to-slate-800 rounded-xl p-5 text-white h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Icon d={ICONS.sparkles} className="w-4 h-4 text-brand-gold" />
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-gold">AI Insights</span>
      </div>

      <div className="space-y-3 flex-1">
        {topSector && (
          <div className="bg-white/10 rounded-lg px-3 py-2.5">
            <p className="text-xs text-slate-400 mb-0.5">Top Sector</p>
            <p className="text-sm font-semibold text-white">
              {topSector[0]}
              <span className="ml-1.5 text-xs font-normal text-slate-300">
                ({topSector[1]} project{topSector[1] !== 1 ? 's' : ''})
              </span>
            </p>
          </div>
        )}

        {topCountry && (
          <div className="bg-white/10 rounded-lg px-3 py-2.5">
            <p className="text-xs text-slate-400 mb-0.5">Top Country</p>
            <p className="text-sm font-semibold text-white">
              {countryFlag(topCountry[0])} {topCountry[0]}
              <span className="ml-1.5 text-xs font-normal text-slate-300">
                ({topCountry[1]} project{topCountry[1] !== 1 ? 's' : ''})
              </span>
            </p>
          </div>
        )}

        <div className="bg-white/10 rounded-lg px-3 py-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Pipeline Activity</p>
          <p className="text-sm font-semibold text-white">
            {advancedCount} advanced-stage
            <span className="ml-1.5 text-xs font-normal text-slate-300">
              of {projects.length} total
            </span>
          </p>
        </div>

        {totalCost > 0 && (
          <div className="bg-white/10 rounded-lg px-3 py-2.5">
            <p className="text-xs text-slate-400 mb-0.5">Total Pipeline Value</p>
            <p className="text-sm font-semibold text-brand-gold">{formatBig(totalCost)}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-3 leading-relaxed">
        Derived from {projects.length} project{projects.length !== 1 ? 's' : ''} in your pipeline.
      </p>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

function KanbanCard({ project }: { project: Project }) {
  const stageKey = projectStageKey(project);
  const stageColor = LEGACY_STAGE_COLORS[stageKey] ?? 'bg-gray-100 text-gray-700';

  return (
    <Link href={`/dashboard/projects`}>
      <div className="bg-white rounded-lg border border-gray-200 p-3 hover:border-brand-gold/40 hover:shadow-sm transition-all cursor-pointer">
        <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">
          {projectTitle(project)}
        </p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-sm" title={project.country ?? ''}>
            {countryFlag(project.country)}
          </span>
          {project.sector && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy font-medium truncate max-w-[80px]">
              {project.sector}
            </span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stageColor}`}>
            {stageKey.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    </Link>
  );
}

function KanbanColumn({
  stage, projects,
}: {
  stage: typeof DEAL_STAGES[number];
  projects: Project[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? projects : projects.slice(0, MAX_VISIBLE);
  const overflow = projects.length - MAX_VISIBLE;

  return (
    <div className="flex-shrink-0 w-52 flex flex-col">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0 ${STAGE_HEADER[stage.color]}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_DOT[stage.color]}`} />
        <span className="text-xs font-semibold text-gray-700 truncate flex-1">{stage.label}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${STAGE_BG[stage.color]}`}>
          {projects.length}
        </span>
      </div>

      {/* Cards */}
      <div className={`flex-1 border border-t-0 border-gray-200 rounded-b-lg bg-gray-50 p-2 space-y-2 min-h-[80px]`}>
        {visible.map((p) => (
          <KanbanCard key={p.id} project={p} />
        ))}

        {!expanded && overflow > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-xs text-brand-gold hover:text-brand-gold-dark font-medium py-1 transition-colors text-center"
          >
            +{overflow} more
          </button>
        )}

        {expanded && overflow > 0 && (
          <button
            onClick={() => setExpanded(false)}
            className="w-full text-xs text-gray-400 hover:text-gray-600 font-medium py-1 transition-colors text-center"
          >
            Show less
          </button>
        )}

        {projects.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-3 italic">No projects</div>
        )}
      </div>
    </div>
  );
}

function PipelineKanban({ projects }: { projects: Project[] }) {
  // Group projects by canonical deal stage key
  const grouped = DEAL_STAGES.reduce<Record<string, Project[]>>((acc, s) => {
    acc[s.key] = [];
    return acc;
  }, {});

  projects.forEach((p) => {
    const key = projectStageKey(p);
    if (grouped[key]) {
      grouped[key].push(p);
    } else {
      // Fallback — put in CONCEPT
      grouped['CONCEPT'].push(p);
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pipeline Kanban</h2>
        <Link href="/dashboard/pipeline" className="text-sm text-brand-gold hover:text-brand-gold-dark transition-colors">
          Full view →
        </Link>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {DEAL_STAGES.map((stage) => (
            <KanbanColumn key={stage.key} stage={stage} projects={grouped[stage.key]} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session } = useSession();
  const { role } = useRBAC();

  const [stats, setStats] = useState({ projects: 0, investors: 0, verifications: 0, events: 0 });
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        const [projects, investors, verifications, events] = await Promise.allSettled([
          projectsApi.list(),
          investorsApi.list(),
          verificationsApi.list(),
          eventsApi.list(),
        ]);
        if (controller.signal.aborted) return;
        const p = projects.status === 'fulfilled' ? projects.value : [];
        const i = investors.status === 'fulfilled' ? investors.value : [];
        const v = verifications.status === 'fulfilled' ? verifications.value : [];
        const e = events.status === 'fulfilled' ? events.value : [];
        setStats({ projects: p.length, investors: i.length, verifications: v.length, events: e.length });
        setAllProjects(p);
        setRecentProjects(p.slice(0, 6));
      } catch {
        // silently fail — empty state handles this
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, []);

  const displayName = session?.user?.name || session?.user?.email?.split('@')[0] || 'there';
  const roleInfo = USER_ROLES[role as UserRole];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // ── Role-specific stats config ──────────────────────────────────────────────
  const statCards = (() => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return [
          { label: 'Total Projects',    value: stats.projects,      icon: 'folder',   href: '/dashboard/projects' },
          { label: 'Investors',         value: stats.investors,     icon: 'users',    href: '/dashboard/investors' },
          { label: 'Verifications',     value: stats.verifications, icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'Events',            value: stats.events,        icon: 'calendar', href: '/dashboard/events' },
        ];
      case UserRole.INSTITUTIONAL_INVESTOR:
      case UserRole.ANALYST:
        return [
          { label: 'Pipeline Projects', value: stats.projects,      icon: 'bolt',     href: '/dashboard/pipeline' },
          { label: 'Investors',         value: stats.investors,     icon: 'deal',     href: '/dashboard/investors' },
          { label: 'Verifications',     value: stats.verifications, icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'IC Sessions',       value: '—',                 icon: 'gavel',    href: '/dashboard/ic' },
        ];
      case UserRole.EPC_OPERATOR:
      case UserRole.SPONSOR_DEVELOPER:
        return [
          { label: 'My Projects',       value: stats.projects,      icon: 'folder',   href: '/dashboard/projects' },
          { label: 'Pipeline Status',   value: '—',                 icon: 'bolt',     href: '/dashboard/pipeline' },
          { label: 'Data Rooms',        value: '—',                 icon: 'database', href: '/dashboard/data-rooms' },
          { label: 'Events',            value: stats.events,        icon: 'calendar', href: '/dashboard/events' },
        ];
      case UserRole.GOVERNMENT:
        return [
          { label: 'Curated Projects',  value: stats.projects,      icon: 'folder',   href: '/dashboard/projects' },
          { label: 'Active Investors',  value: stats.investors,     icon: 'users',    href: '/dashboard/investors' },
          { label: 'Verifications',     value: stats.verifications, icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'Events',            value: stats.events,        icon: 'calendar', href: '/dashboard/events' },
        ];
      default:
        return [
          { label: 'Published Projects',value: stats.projects,      icon: 'folder',   href: '/dashboard/projects' },
          { label: 'Verifications',     value: stats.verifications, icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'Investors',         value: stats.investors,     icon: 'users',    href: '/dashboard/investors' },
          { label: 'Events',            value: stats.events,        icon: 'calendar', href: '/dashboard/events' },
        ];
    }
  })();

  // ── Role-specific quick actions ─────────────────────────────────────────────
  const quickActions = (() => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return [
          { label: 'New Project',      desc: 'Add a project to the platform',       icon: 'plus',     href: '/dashboard/projects' },
          { label: 'Manage Users',     desc: 'View and manage platform users',      icon: 'users',    href: '/dashboard/admin/users' },
          { label: 'View Analytics',   desc: 'Platform-wide performance data',      icon: 'chart',    href: '/dashboard/analytics' },
          { label: 'Admin Settings',   desc: 'System configuration and setup',      icon: 'cog',      href: '/dashboard/admin/settings' },
          { label: 'Run PESTEL',       desc: 'Start a PESTEL risk assessment',      icon: 'clip',     href: '/dashboard/pestel' },
          { label: 'Generate EIN',     desc: 'Create executive investment note',    icon: 'doc',      href: '/dashboard/ein' },
        ];
      case UserRole.INSTITUTIONAL_INVESTOR:
      case UserRole.ANALYST:
        return [
          { label: 'New Project',      desc: 'Add a project to pipeline',          icon: 'plus',     href: '/dashboard/projects' },
          { label: 'View Pipeline',    desc: 'Manage deal-flow stages',             icon: 'bolt',     href: '/dashboard/pipeline' },
          { label: 'Run PESTEL',       desc: 'Start a PESTEL risk assessment',      icon: 'clip',     href: '/dashboard/pestel' },
          { label: 'Generate EIN',     desc: 'Create executive investment note',    icon: 'doc',      href: '/dashboard/ein' },
          { label: 'IC Committee',     desc: 'Investment committee sessions',       icon: 'gavel',    href: '/dashboard/ic' },
          { label: 'Browse Investors', desc: 'Search the investor directory',       icon: 'deal',     href: '/dashboard/investors' },
        ];
      case UserRole.EPC_OPERATOR:
      case UserRole.SPONSOR_DEVELOPER:
        return [
          { label: 'Submit Project',   desc: 'Submit a new infrastructure project', icon: 'plus',    href: '/dashboard/projects' },
          { label: 'View Pipeline',    desc: 'Track project approval stages',        icon: 'bolt',    href: '/dashboard/pipeline' },
          { label: 'Data Rooms',       desc: 'Upload project documentation',         icon: 'database',href: '/dashboard/data-rooms' },
          { label: 'My PIS',          desc: 'Project information sheets',           icon: 'clip',    href: '/dashboard/pis' },
        ];
      case UserRole.GOVERNMENT:
        return [
          { label: 'Browse Projects',  desc: 'View curated project pipeline',       icon: 'folder',   href: '/dashboard/projects' },
          { label: 'View Investors',   desc: 'Search the investor directory',        icon: 'users',    href: '/dashboard/investors' },
          { label: 'Download Reports', desc: 'PESTEL summaries and analysis',        icon: 'download', href: '/dashboard/pestel' },
          { label: 'Events',           desc: 'Infrastructure events calendar',       icon: 'calendar', href: '/dashboard/events' },
        ];
      default:
        return [
          { label: 'Browse Projects',  desc: 'Explore verified infrastructure',     icon: 'eye',      href: '/dashboard/projects' },
          { label: 'Verifications',    desc: 'View verification reports',            icon: 'shield',   href: '/dashboard/verifications' },
          { label: 'PESTEL Reports',   desc: 'Risk and environment summaries',       icon: 'clip',     href: '/dashboard/pestel' },
          { label: 'Events',           desc: 'Infrastructure events calendar',       icon: 'calendar', href: '/dashboard/events' },
        ];
    }
  })();

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 animate-pulse rounded-md bg-gray-200" />
        <StatCardsSkeleton />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-gray-200 animate-pulse shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-gray-200" />
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
            {session?.user?.organization && `${session.user.organization} · `}
            {roleInfo?.label ?? 'AIP Platform'}
          </p>
        </div>
        {roleInfo && (
          <span className="hidden sm:inline-block text-xs text-white px-2.5 py-1 rounded font-medium bg-brand-navy">
            {roleInfo.label}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* 2-column: Map (60%) + Quick Actions / AI Insights (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Project Discovery Map — 60% */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 mb-3">
            <Icon d={ICONS.globe} className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Project Discovery Map</h2>
            <span className="text-xs text-gray-400">({allProjects.length} projects)</span>
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-100" style={{ height: 360 }}>
            <MapPanel projects={allProjects} />
          </div>
        </div>

        {/* Quick Actions + AI Insights — 40% */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Quick Actions */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {quickActions.slice(0, 4).map((a) => (
                <QuickAction key={a.label} {...a} />
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="flex-1">
            <AIInsightsPanel projects={allProjects} />
          </div>
        </div>
      </div>

      {/* Pipeline Kanban — full width */}
      <PipelineKanban projects={allProjects} />

      {/* Recent projects list */}
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
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {countryFlag(project.country)} {projectTitle(project)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[project.sector, project.country].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span
                    className={`ml-3 shrink-0 px-2 py-0.5 text-xs rounded-full ${
                      LEGACY_STAGE_COLORS[projectStageKey(project)] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {projectStageKey(project).replace(/_/g, ' ')}
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
