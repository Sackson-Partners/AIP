'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { projectsApi, pipelineAPI, Project, PipelineLog } from '../../../../lib/api';

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

function formatCost(value?: number, currency?: string): string {
  if (!value) return '—';
  const cur = currency ?? 'USD';
  if (value >= 1_000_000_000) return `${cur} ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000)     return `${cur} ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)         return `${cur} ${(value / 1_000).toFixed(1)}K`;
  return `${cur} ${value.toLocaleString()}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<PipelineLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([
      projectsApi.get(id),
      pipelineAPI.getHistory(id),
    ])
      .then(([proj, logs]) => {
        setProject(proj);
        setHistory(Array.isArray(logs) ? logs : []);
      })
      .catch((err) => {
        console.error('Failed to load project:', err);
        setError('Failed to load project details. Please try again.');
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

  if (error || !project) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 mb-4">{error ?? 'Project not found.'}</p>
        <Link href="/dashboard/projects" className="text-brand-gold hover:underline text-sm">
          Back to Projects
        </Link>
      </div>
    );
  }

  const cost = project.estimated_cost ?? project.estimated_capex ?? project.capex;
  const status = project.status ?? project.stage;

  const metrics: { label: string; value: string }[] = [
    { label: 'Sector',        value: project.sector        || '—' },
    { label: 'Country',       value: project.country       || '—' },
    { label: 'Region',        value: project.region        || '—' },
    { label: 'Stage',         value: project.stage         || '—' },
    { label: 'Project Type',  value: project.project_type  || '—' },
    { label: 'Estimated Cost',value: formatCost(cost, project.currency) },
    { label: 'Currency',      value: project.currency      || '—' },
    { label: 'Technology',    value: project.technology    || '—' },
    { label: 'Revenue Model', value: project.revenue_model || '—' },
    { label: 'Offtaker',      value: project.offtaker      || '—' },
    ...(project.concession_length != null
      ? [{ label: 'Concession Length', value: `${project.concession_length} years` }]
      : []),
  ];

  const relatedLinks = [
    { label: 'PESTEL Assessment', href: `/dashboard/pestel?project_id=${id}`,    description: 'Political, Economic, Social, Technological, Environmental & Legal analysis' },
    { label: 'EIN Report',        href: `/dashboard/ein?project_id=${id}`,        description: 'Executive Investment Note for this project' },
    { label: 'Data Rooms',        href: `/dashboard/data-rooms?project_id=${id}`, description: 'Access documents and due diligence materials' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Back */}
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1 text-sm text-brand-gold hover:underline"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-brand-navy leading-tight">
              {project.project_name || project.name}
            </h1>
            <p className="text-sm text-gray-400 mt-1">Created {formatDate(project.created_at)}</p>
          </div>
          {status && (
            <span className={`self-start px-3 py-1.5 text-sm font-medium rounded-full ${stageColor(status)}`}>
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h2 className="text-lg font-semibold text-brand-navy mb-5">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {metrics.map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Description & Strategic Notes */}
      {(project.description || project.strategic_notes) && (
        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
          {project.description && (
            <div>
              <h2 className="text-lg font-semibold text-brand-navy mb-3">Description</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
          {project.strategic_notes && (
            <div>
              <h2 className="text-lg font-semibold text-brand-navy mb-3">Strategic Notes</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{project.strategic_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Pipeline Timeline */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h2 className="text-lg font-semibold text-brand-navy mb-5">Status Timeline</h2>
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No pipeline history recorded for this project yet.
          </div>
        ) : (
          <ol className="relative border-l-2 border-gray-200 ml-3 space-y-6">
            {history.map((log, i) => {
              const date = log.moved_at ?? log.timestamp;
              return (
                <li key={log.id ?? i} className="ml-6">
                  <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-brand-gold ring-4 ring-white" />
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {log.from_stage && (
                      <>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${stageColor(log.from_stage)}`}>
                          {log.from_stage}
                        </span>
                        <ArrowRightIcon className="w-3 h-3 text-gray-400 shrink-0" />
                      </>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded-full ${stageColor(log.to_stage)}`}>
                      {log.to_stage}
                    </span>
                    {log.sla_breached && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">SLA breached</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(date)}</p>
                  {log.notes && (
                    <p className="text-sm text-gray-600 mt-1">{log.notes}</p>
                  )}
                  {log.days_in_previous_stage != null && (
                    <p className="text-xs text-gray-400 mt-0.5">{log.days_in_previous_stage} days in previous stage</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Related Links */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <h2 className="text-lg font-semibold text-brand-navy mb-5">Related Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {relatedLinks.map(({ label, href, description }) => (
            <Link
              key={label}
              href={href}
              className="group p-5 rounded-xl border border-gray-200 hover:border-brand-gold/50 hover:shadow-sm transition"
            >
              <p className="font-semibold text-brand-navy group-hover:text-brand-gold transition text-sm">{label}</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{description}</p>
            </Link>
          ))}
        </div>
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

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}
