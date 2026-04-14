'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { PlusIcon, XIcon } from '@/components/ui/icons';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { investorsApi, Investor, InvestorCreate, Project, projectsApi } from '../../../lib/api';

const SECTORS = ['Energy', 'Mining', 'Water', 'Transport', 'Ports', 'Rail', 'Roads', 'Agriculture', 'Health'];
const INSTRUMENTS = ['Equity', 'Debt', 'Mezzanine'];

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [projectsCache, setProjectsCache] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [matchedProjects, setMatchedProjects] = useState<Project[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InvestorCreate>();

  const fetchInvestors = useCallback(async () => {
    try {
      const data = await investorsApi.list();
      setInvestors(data);
      setFetchError(null);
    } catch {
      setFetchError('Failed to load investors. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestors();
    // Pre-load projects once on mount so findMatches() uses the cache
    projectsApi.list().then(setProjectsCache).catch(() => {});
  }, [fetchInvestors]);

  const filteredInvestors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return investors;
    return investors.filter((inv) =>
      inv.fund_name.toLowerCase().includes(q)
    );
  }, [investors, searchQuery]);

  const onSubmit = useCallback(async (data: InvestorCreate) => {
    setIsSubmitting(true);
    try {
      const formattedData = {
        ...data,
        instruments: Array.isArray(data.instruments) ? data.instruments : [data.instruments],
        country_focus: typeof data.country_focus === 'string'
          ? (data.country_focus as string).split(',').map((c: string) => c.trim())
          : data.country_focus,
        sector_focus: Array.isArray(data.sector_focus) ? data.sector_focus : (data.sector_focus ? [data.sector_focus] : undefined),
      };
      await investorsApi.create(formattedData);
      setShowModal(false);
      reset();
      fetchInvestors();
    } catch {
      setFetchError('Failed to create investor. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchInvestors, reset]);

  const findMatches = useCallback(async (investor: Investor) => {
    try {
      // Use cached project list — avoids re-fetching on every "Find Matches" click
      const projects = projectsCache.length > 0 ? projectsCache : await projectsApi.list();
      const sectorFocus  = investor.sector_focus  ?? [];
      const countryFocus = investor.country_focus ?? [];
      const matched = projects.filter((p: Project) =>
        (sectorFocus.length === 0 || sectorFocus.includes(p.sector)) &&
        (countryFocus.length === 0 || countryFocus.some(
          (c: string) => c === 'Global' || c.toLowerCase() === (p.country ?? '').toLowerCase()
        ))
      );
      setMatchedProjects(matched);
      setSelectedInvestor(investor);
      setShowMatchModal(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to find matches:', error);
    }
  }, [projectsCache]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Investors</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg hover:bg-brand-gold-dark transition flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Investor
        </button>
      </div>

      {fetchError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {fetchError}
        </div>
      )}

      {/* Search bar */}
      <div className="mb-6">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search investors by fund name…"
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInvestors.length > 0 ? (
            filteredInvestors.map((investor) => {
              const sectorFocus  = investor.sector_focus  ?? [];
              const countryFocus = investor.country_focus ?? [];
              const instruments  = investor.instruments   ?? [];
              return (
                <div key={investor.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{investor.fund_name}</h3>

                  {investor.aum && (
                    <p className="text-sm text-gray-500 mb-3">
                      AUM: ${formatNumber(investor.aum)}
                    </p>
                  )}

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Ticket Size</p>
                      <p className="text-sm font-medium text-gray-900">
                        ${formatNumber(investor.ticket_size_min)} - ${formatNumber(investor.ticket_size_max)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Instruments</p>
                      <div className="flex flex-wrap gap-1">
                        {instruments.map((inst) => (
                          <span key={inst} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {inst}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Sector Focus</p>
                      <div className="flex flex-wrap gap-1">
                        {sectorFocus.slice(0, 3).map((sector) => (
                          <span key={sector} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            {sector}
                          </span>
                        ))}
                        {sectorFocus.length > 3 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            +{sectorFocus.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Country Focus</p>
                      <p className="text-sm text-gray-700">{countryFocus.join(', ') || '—'}</p>
                    </div>

                    {investor.target_irr && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Target IRR</p>
                        <p className="text-sm font-medium text-gray-900">{investor.target_irr}%</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <Link
                      href={`/dashboard/investors/${investor.id}`}
                      className="flex-1 px-3 py-2 text-sm text-center text-brand-gold border border-brand-gold rounded-lg hover:bg-brand-gold/5 transition"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => findMatches(investor)}
                      className="flex-1 px-3 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
                    >
                      Find Matches
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 bg-white rounded-xl shadow-sm">
              <p className="text-gray-500">
                {searchQuery
                  ? `No investors match "${searchQuery}".`
                  : 'No investors found. Add your first investor to get started.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Investor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Add New Investor</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fund Name *</label>
                  <input
                    {...register('fund_name', { required: 'Fund name is required' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                  />
                  {errors.fund_name && <p className="text-red-500 text-sm mt-1">{errors.fund_name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AUM ($)</label>
                  <input
                    {...register('aum', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target IRR (%)</label>
                  <input
                    {...register('target_irr', { valueAsNumber: true })}
                    type="number"
                    step="0.1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Ticket Size ($) *</label>
                  <input
                    {...register('ticket_size_min', { required: 'Required', valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                  />
                  {errors.ticket_size_min && <p className="text-red-500 text-sm mt-1">{errors.ticket_size_min.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Ticket Size ($) *</label>
                  <input
                    {...register('ticket_size_max', { required: 'Required', valueAsNumber: true })}
                    type="number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                  />
                  {errors.ticket_size_max && <p className="text-red-500 text-sm mt-1">{errors.ticket_size_max.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instruments *</label>
                  <select
                    {...register('instruments', { required: 'Required' })}
                    multiple
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50 h-24"
                  >
                    {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sector Focus *</label>
                  <select
                    {...register('sector_focus', { required: 'Required' })}
                    multiple
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50 h-24"
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country Focus *</label>
                  <input
                    {...register('country_focus', { required: 'Required' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                    placeholder="e.g., Kenya, Nigeria, South Africa (comma-separated)"
                  />
                  {errors.country_focus && <p className="text-red-500 text-sm mt-1">{errors.country_focus.message}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ESG Constraints</label>
                  <textarea
                    {...register('esg_constraints')}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                    placeholder="Describe any ESG requirements..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding…' : 'Add Investor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Match Results Modal */}
      {showMatchModal && selectedInvestor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Matching Projects for {selectedInvestor.fund_name}
                </h2>
                <button onClick={() => { setShowMatchModal(false); setSelectedInvestor(null); }} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {matchedProjects.length > 0 ? (
                <div className="space-y-4">
                  {matchedProjects.map((project) => (
                    <div key={project.id} className="p-4 border border-gray-200 rounded-lg hover:border-brand-gold/40 transition">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{project.project_name || project.name}</h3>
                          <p className="text-sm text-gray-500">{project.sector} - {project.country}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStageColor(project.stage)}`}>
                          {project.stage}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-4 text-sm">
                        {project.estimated_capex != null && (
                          <span className="text-gray-600">CAPEX: ${formatNumber(project.estimated_capex)}</span>
                        )}
                        {project.funding_gap != null && (
                          <span className="text-green-600">Gap: ${formatNumber(project.funding_gap)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No matching projects found for this investor&apos;s criteria.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStageColor(stage: string) {
  const colors: Record<string, string> = {
    planned:           'bg-gray-100 text-gray-800',
    'pre-feasibility': 'bg-blue-100 text-blue-800',
    feasibility:       'bg-indigo-100 text-indigo-800',
    procurement:       'bg-yellow-100 text-yellow-800',
    construction:      'bg-orange-100 text-orange-800',
    operational:       'bg-green-100 text-green-800',
    decommissioned:    'bg-red-100 text-red-800',
    // Legacy values from old data
    Concept:    'bg-gray-100 text-gray-800',
    Feasibility:'bg-blue-100 text-blue-800',
    Procurement:'bg-yellow-100 text-yellow-800',
    Construction:'bg-orange-100 text-orange-800',
    Operation:  'bg-green-100 text-green-800',
  };
  return colors[stage] || 'bg-gray-100 text-gray-800';
}

function formatNumber(num: number) {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000)     return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)         return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

