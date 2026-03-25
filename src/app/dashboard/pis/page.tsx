'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  projectsApi,
  petfelApi,
  einApi,
  pipelineApi,
  verificationsApi,
  Project,
  PETFELAssessment,
  EIN,
  ProjectPipelineStatus,
  Verification,
} from '../../../lib/api';

const RATING_COLORS: Record<string, string> = {
  A: 'bg-green-600 text-white',
  B: 'bg-blue-600 text-white',
  C: 'bg-yellow-500 text-gray-900',
  D: 'bg-red-600 text-white',
};

const STAGE_COLORS: Record<string, string> = {
  sourcing: 'bg-blue-100 text-blue-700',
  screening: 'bg-yellow-100 text-yellow-700',
  diligence: 'bg-purple-100 text-purple-700',
  ic: 'bg-orange-100 text-orange-700',
  execution: 'bg-green-100 text-green-700',
};

export default function PISPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [petfel, setPetfel] = useState<PETFELAssessment | null>(null);
  const [ein, setEin] = useState<EIN | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<ProjectPipelineStatus | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'petfel' | 'ein' | 'timeline'>('overview');

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectsApi.list();
        setProjects(data);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Load project details when selected
  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProject(null);
      setPetfel(null);
      setEin(null);
      setPipelineStatus(null);
      setVerifications([]);
      return;
    }

    const loadProjectData = async () => {
      setIsLoading(true);
      try {
        // Fetch all data in parallel
        const [projectData, petfelData, einData, pipelineData, verificationsData] = await Promise.allSettled([
          projectsApi.get(String(selectedProjectId)),
          petfelApi.getAssessment(selectedProjectId),
          einApi.get(selectedProjectId),
          pipelineApi.getProjectStatus(selectedProjectId),
          verificationsApi.getByProject(selectedProjectId),
        ]);

        if (projectData.status === 'fulfilled') setSelectedProject(projectData.value);
        if (petfelData.status === 'fulfilled') setPetfel(petfelData.value);
        else setPetfel(null);
        if (einData.status === 'fulfilled') setEin(einData.value);
        else setEin(null);
        if (pipelineData.status === 'fulfilled') setPipelineStatus(pipelineData.value);
        else setPipelineStatus(null);
        if (verificationsData.status === 'fulfilled') setVerifications(verificationsData.value);
        else setVerifications([]);
      } catch (err) {
        console.error('Failed to load project data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadProjectData();
  }, [selectedProjectId]);

  const formatCurrency = (value: number): string => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  if (isLoading && !projects.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Project Information Sheet</h1>
        <select
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-64"
        >
          <option value="">Select a Project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name} ({p.country})
            </option>
          ))}
        </select>
      </div>

      {!selectedProjectId && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Select a Project</h2>
          <p className="text-gray-500">Choose a project to view its complete information sheet.</p>
        </div>
      )}

      {selectedProject && (
        <>
          {/* Quick Stats Bar */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h2>
                <p className="text-gray-600">{selectedProject.country} • {selectedProject.sector}</p>
              </div>
              <div className="flex items-center gap-6">
                {/* PETFEL Rating */}
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">PETFEL</div>
                  {petfel?.rating ? (
                    <div className={`text-2xl font-bold px-4 py-1 rounded-lg ${RATING_COLORS[petfel.rating]}`}>
                      {petfel.rating}
                    </div>
                  ) : (
                    <div className="text-gray-400">—</div>
                  )}
                </div>
                {/* Pipeline Stage */}
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Pipeline</div>
                  {pipelineStatus ? (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STAGE_COLORS[pipelineStatus.current_stage] || 'bg-gray-100 text-gray-700'}`}>
                      {pipelineStatus.current_stage}
                    </div>
                  ) : (
                    <div className="text-gray-400">—</div>
                  )}
                </div>
                {/* EIN Status */}
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">EIN</div>
                  {ein ? (
                    <div className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                      ein.status === 'approved' ? 'bg-green-100 text-green-700' :
                      ein.status === 'in_review' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {ein.status.replace('_', ' ')}
                    </div>
                  ) : (
                    <div className="text-gray-400">—</div>
                  )}
                </div>
                {/* CAPEX */}
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Est. CAPEX</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatCurrency(selectedProject.estimated_capex)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {[
                  { key: 'overview', label: 'Overview' },
                  { key: 'petfel', label: 'PETFEL Assessment' },
                  { key: 'ein', label: 'EIN' },
                  { key: 'timeline', label: 'Timeline & History' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                      activeTab === tab.key
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Project Details */}
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 mb-4">Project Details</h3>
                    <div className="space-y-3">
                      <DetailRow label="Name" value={selectedProject.name} />
                      <DetailRow label="Country" value={selectedProject.country} />
                      <DetailRow label="Region" value={selectedProject.region || '—'} />
                      <DetailRow label="Sector" value={selectedProject.sector} />
                      <DetailRow label="Stage" value={selectedProject.stage} />
                      <DetailRow label="Technology" value={selectedProject.technology || '—'} />
                      <DetailRow label="GPS Location" value={selectedProject.gps_location || '—'} />
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 mb-4">Financial Details</h3>
                    <div className="space-y-3">
                      <DetailRow label="Est. CAPEX" value={formatCurrency(selectedProject.estimated_capex)} />
                      <DetailRow label="Funding Gap" value={selectedProject.funding_gap ? formatCurrency(selectedProject.funding_gap) : '—'} />
                      <DetailRow label="Revenue Model" value={selectedProject.revenue_model} />
                      <DetailRow label="Offtaker" value={selectedProject.offtaker || '—'} />
                      <DetailRow label="Tariff Mechanism" value={selectedProject.tariff_mechanism || '—'} />
                      <DetailRow label="FX Exposure" value={selectedProject.fx_exposure || '—'} />
                      <DetailRow label="Concession Length" value={selectedProject.concession_length ? `${selectedProject.concession_length} years` : '—'} />
                    </div>
                  </div>

                  {/* Development Status */}
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 mb-4">Development Status</h3>
                    <div className="space-y-3">
                      <DetailRow label="EPC Status" value={selectedProject.epc_status || '—'} />
                      <DetailRow label="Permits Status" value={selectedProject.permits_status || '—'} />
                      <DetailRow label="Land Acquisition" value={selectedProject.land_acquisition_status || '—'} />
                      <DetailRow label="Timeline FID" value={selectedProject.timeline_fid || '—'} />
                      <DetailRow label="Timeline COD" value={selectedProject.timeline_cod || '—'} />
                    </div>
                  </div>

                  {/* Risk & ESG */}
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 mb-4">Risk & ESG</h3>
                    <div className="space-y-3">
                      <DetailRow label="ESG Category" value={selectedProject.esg_category || '—'} />
                      <DetailRow label="Political Risk Mitigation" value={selectedProject.political_risk_mitigation || '—'} />
                      <DetailRow label="Sovereign Support" value={selectedProject.sovereign_support || '—'} />
                    </div>
                  </div>
                </div>
              )}

              {/* PETFEL Tab */}
              {activeTab === 'petfel' && (
                <div>
                  {petfel ? (
                    <div className="space-y-6">
                      {/* Summary */}
                      <div className="flex items-center gap-8 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <span className="text-sm text-gray-500">Overall Score</span>
                          <div className="text-3xl font-bold">{petfel.overall_score?.toFixed(1) || '—'}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Rating</span>
                          <div className={`text-2xl font-bold px-4 py-1 rounded-lg ${petfel.rating ? RATING_COLORS[petfel.rating] : 'bg-gray-200'}`}>
                            {petfel.rating || '—'}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Gating Result</span>
                          <div className={`text-xl font-bold ${petfel.gating_result === 'GO' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {petfel.gating_result || '—'}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Status</span>
                          <div className="text-lg capitalize">{petfel.status}</div>
                        </div>
                      </div>

                      {/* Pillar Scores */}
                      {petfel.pillar_scores && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-3">Pillar Scores</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {Object.entries(petfel.pillar_scores).map(([pillar, score]) => (
                              <div key={pillar} className="bg-gray-50 rounded-lg p-4 text-center">
                                <div className="text-xs text-gray-500 capitalize mb-1">{pillar}</div>
                                <div className="text-2xl font-bold text-gray-900">{(score as number).toFixed(0)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Red Flags */}
                      {petfel.flags && petfel.flags.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <h4 className="font-medium text-red-800 mb-2">Red Flags ({petfel.flags.length})</h4>
                          <ul className="space-y-2">
                            {petfel.flags.map((flag) => (
                              <li key={flag.id} className="flex items-start gap-2 text-red-700">
                                <WarningIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>
                                  <strong className="capitalize">{flag.pillar}:</strong> {flag.description}
                                  {flag.is_resolved && <span className="text-green-600 ml-2">(Resolved)</span>}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Link
                        href="/dashboard/petfel"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                      >
                        View Full Assessment →
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">No PETFEL assessment found for this project.</p>
                      <Link
                        href="/dashboard/petfel"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Create Assessment
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* EIN Tab */}
              {activeTab === 'ein' && (
                <div>
                  {ein ? (
                    <div className="space-y-6">
                      {/* Summary */}
                      <div className="flex items-center gap-8 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <span className="text-sm text-gray-500">Status</span>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                            ein.status === 'approved' ? 'bg-green-100 text-green-700' :
                            ein.status === 'in_review' ? 'bg-yellow-100 text-yellow-700' :
                            ein.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {ein.status.replace('_', ' ')}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Version</span>
                          <div className="text-lg font-medium">v{ein.version}</div>
                        </div>
                        {ein.recommendation && (
                          <div>
                            <span className="text-sm text-gray-500">Recommendation</span>
                            <div className={`text-lg font-bold uppercase ${
                              ein.recommendation === 'go' ? 'text-green-600' :
                              ein.recommendation === 'no_go' ? 'text-red-600' :
                              'text-yellow-600'
                            }`}>
                              {ein.recommendation.replace('_', ' ')}
                            </div>
                          </div>
                        )}
                        {ein.petfel_score && (
                          <div>
                            <span className="text-sm text-gray-500">PETFEL Score</span>
                            <div className="text-lg font-medium">{ein.petfel_score.toFixed(1)}</div>
                          </div>
                        )}
                      </div>

                      {/* Executive Summary */}
                      {ein.executive_summary && (
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Executive Summary</h4>
                          <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                            {ein.executive_summary}
                          </div>
                        </div>
                      )}

                      {/* Sections Overview */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Sections</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {ein.sections.map((section) => (
                            <div key={section.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <span className={`w-2 h-2 rounded-full ${
                                section.content ? (section.is_reviewed ? 'bg-green-500' : 'bg-blue-500') : 'bg-gray-300'
                              }`}></span>
                              <span className="text-sm text-gray-700">{section.section_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Link
                        href="/dashboard/ein"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                      >
                        View/Edit EIN →
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">No EIN found for this project.</p>
                      <Link
                        href="/dashboard/ein"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Create EIN
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline Tab */}
              {activeTab === 'timeline' && (
                <div className="space-y-6">
                  {/* Pipeline Status */}
                  {pipelineStatus && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-700 mb-3">Current Pipeline Status</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-sm text-gray-500">Current Stage</span>
                          <div className="font-medium capitalize">{pipelineStatus.current_stage}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Days in Stage</span>
                          <div className="font-medium">{pipelineStatus.days_in_stage}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">SLA Days</span>
                          <div className="font-medium">{pipelineStatus.sla_days || '—'}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">SLA Status</span>
                          <div className={`inline-block px-2 py-0.5 rounded text-sm ${
                            pipelineStatus.sla_status === 'ok' ? 'bg-green-100 text-green-700' :
                            pipelineStatus.sla_status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {pipelineStatus.sla_status}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Verifications */}
                  {verifications.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Verification History</h4>
                      <div className="space-y-2">
                        {verifications.map((v) => (
                          <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="font-medium">{v.level}</span>
                            {v.bankability && (
                              <span className="text-sm text-gray-600">
                                Score: {v.bankability.overall_score}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project Dates */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">Key Dates</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500">Created</span>
                        <div className="font-medium">{new Date(selectedProject.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <span className="text-xs text-gray-500">Last Updated</span>
                        <div className="font-medium">{new Date(selectedProject.updated_at).toLocaleDateString()}</div>
                      </div>
                      {selectedProject.timeline_fid && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-xs text-gray-500">FID Target</span>
                          <div className="font-medium">{selectedProject.timeline_fid}</div>
                        </div>
                      )}
                      {selectedProject.timeline_cod && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-xs text-gray-500">COD Target</span>
                          <div className="font-medium">{selectedProject.timeline_cod}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Link
                    href="/dashboard/pipeline"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    View Pipeline →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper Components
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-xs">{value}</span>
    </div>
  );
}

// Icons
function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}
