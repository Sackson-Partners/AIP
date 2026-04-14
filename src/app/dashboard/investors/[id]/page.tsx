'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { investorsApi, projectsApi, Investor, Project } from '../../../../lib/api';

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000)     return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)         return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatAUM(aum?: number): string {
  if (!aum) return '—';
  return `$${formatNumber(aum)}`;
}

const STAGE_COLORS: Record<string, string> = {
  planned:           'bg-gray-100 text-gray-800',
  'pre-feasibility': 'bg-blue-100 text-blue-800',
  feasibility:       'bg-indigo-100 text-indigo-800',
  procurement:       'bg-yellow-100 text-yellow-800',
  construction:      'bg-orange-100 text-orange-800',
  operational:       'bg-green-100 text-green-800',
  decommissioned:    'bg-red-100 text-red-800',
};

function stageColor(stage?: string) {
  if (!stage) return 'bg-gray-100 text-gray-800';
  return STAGE_COLORS[stage.toLowerCase()] ?? 'bg-gray-100 text-gray-800';
}

function matchesInvestor(project: Project, investor: Investor): boolean {
  const sectorFocus  = investor.sector_focus  ?? [];
  const countryFocus = investor.country_focus ?? [];
  const sectorMatch  = sectorFocus.length === 0 || sectorFocus.includes(project.sector);
  const countryMatch =
    countryFocus.length === 0 ||
    countryFocus.some(
      (c) => c === 'Global' || c.toLowerCase() === (project.country ?? '').toLowerCase()
    );
  return sectorMatch && countryMatch;
}

export default function InvestorDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [investor, setInvestor] = useState<Investor | null>(null);
  const [matchedProjects, setMatchedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([investorsApi.get(id), projectsApi.list()])
      .then(([inv, projects]) => {
        setInvestor(inv);
        setMatchedProjects(projects.filter((p) => matchesInvestor(p, inv)));
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load investor:', err);
        setError('Failed to load investor details. Please try again.');
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  if (error || !investor) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 mb-4">{error ?? 'Investor not found.'}</p>
        <Link href="/dashboard/investors" className="text-brand-gold hover:underline text-sm">
          Back to Investors
        </Link>
      </div>
    );
  }

  const sectorFocus  = investor.sector_focus  ?? [];
  const countryFocus = investor.country_focus ?? [];
  const instruments  = investor.instruments   ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Back */}
      <Link
        href="/dashboard/investors"
        className="inline-flex items-center gap-1 text-sm text-brand-gold hover:underline"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Investors
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-3xl font-bold text-brand-navy">{investor.fund_name}</h1>
        {investor.aum && (
          <p className="text-gray-500 mt-1">AUM: {formatAUM(investor.aum)}</p>
        )}
      </div>

      {/* Metrics */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h2 className="text-lg font-semibold text-brand-navy mb-5">Fund Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Target IRR</p>
            <p className="text-sm font-semibold text-gray-900">
              {investor.target_irr != null ? `${investor.target_irr}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Ticket Size</p>
            <p className="text-sm font-semibold text-gray-900">
              ${formatNumber(investor.ticket_size_min)} – ${formatNumber(investor.ticket_size_max)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Instruments</p>
            <p className="text-sm font-semibold text-gray-900">
              {instruments.length > 0 ? instruments.join(', ') : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Sector & Geography Focus */}
      <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy mb-3">Sector Focus</h2>
          {sectorFocus.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sectorFocus.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-brand-gold/10 text-brand-gold border border-brand-gold/20"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No sector focus specified.</p>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-brand-navy mb-3">Geography Focus</h2>
          {countryFocus.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {countryFocus.map((c) => (
                <span
                  key={c}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No geography focus specified.</p>
          )}
        </div>

        {investor.esg_constraints && (
          <div>
            <h2 className="text-lg font-semibold text-brand-navy mb-3">ESG Constraints</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {investor.esg_constraints}
            </p>
          </div>
        )}
      </div>

      {/* Matched Projects */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h2 className="text-lg font-semibold text-brand-navy mb-5">
          Matched Projects
          <span className="ml-2 text-sm font-normal text-gray-400">({matchedProjects.length})</span>
        </h2>

        {matchedProjects.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No projects currently match this investor&apos;s sector and geography focus.
          </div>
        ) : (
          <div className="space-y-3">
            {matchedProjects.map((project) => {
              const cost = project.estimated_cost ?? project.estimated_capex ?? project.capex;
              const status = project.status ?? project.stage;
              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-brand-gold/40 hover:shadow-sm transition group"
                >
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-brand-navy text-sm">
                      {project.project_name || project.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[project.sector, project.country].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {cost != null && (
                      <p className="text-xs text-gray-500 hidden sm:block">
                        ${formatNumber(cost)}
                      </p>
                    )}
                    {status && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${stageColor(status)}`}>
                        {status}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}
