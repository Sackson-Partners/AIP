'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { investorsApi, Investor, InvestorCreate } from '../../../lib/api';
import { PlusIcon, XIcon } from '@/components/ui/icons';
import * as Sentry from '@sentry/nextjs';
import { useRBAC } from '@/hooks/useRBAC';

// ── Constants ──────────────────────────────────────────────────────────────────
const SECTORS = ['ENERGY','TRANSPORT','WATER','MINING','AGRICULTURE','HEALTH','PORTS','RAIL','ROADS','CONSTRUCTION','ENGINEERING'];
const INSTRUMENTS = ['Equity','Senior Debt','Mezzanine Debt','Subordinated Debt','Convertible Note','Project Bond','Blended Finance','Grant Co-financing','EPC+F'];
const ORG_TYPES = ['EPC','SPONSOR','INVESTOR','GOVERNMENT','DFI'];
const COUNTRIES = ['Global','Algeria','Angola','Cameroon','Côte d\'Ivoire','DRC','Egypt','Ethiopia','Ghana','Kenya','Libya','Morocco','Mozambique','Nigeria','Rwanda','Senegal','South Africa','Sudan','Tanzania','Tunisia','Uganda','Zambia','Zimbabwe'];
const STAGES = ['CONCEPT','FEASIBILITY','PROCUREMENT','CONSTRUCTION','OPERATION'];

interface MatchRow {
  projectId:   string
  projectName: string
  score:       number
  reasons:     string[]
  breakdown:   { sector: number; country: number; stage: number; ticket: number; partnerType: number }
}

interface MatchState {
  investor: Investor
  results:  MatchRow[]
  loading:  boolean
}

export default function PartnersPage() {
  const { can } = useRBAC();
  const canWrite = can('manage_users'); // ADMIN/SUPER_ADMIN

  const [investors, setInvestors]     = useState<Investor[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [matchState, setMatchState]   = useState<MatchState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrg, setFilterOrg]     = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError]   = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InvestorCreate>();

  const fetchInvestors = useCallback(async () => {
    try {
      const data = await investorsApi.list();
      setInvestors(data);
      setFetchError(null);
    } catch {
      setFetchError('Failed to load partners.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvestors(); }, [fetchInvestors]);

  const filtered = useMemo(() => {
    let list = investors;
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter(inv => inv.fund_name.toLowerCase().includes(q) || (inv.email ?? '').toLowerCase().includes(q));
    if (filterOrg) list = list.filter(inv => (inv as unknown as { organization_type?: string }).organization_type === filterOrg);
    return list;
  }, [investors, searchQuery, filterOrg]);

  const onSubmit = useCallback(async (data: InvestorCreate) => {
    setIsSubmitting(true);
    try {
      const formattedData = {
        ...data,
        instruments:   Array.isArray(data.instruments)   ? data.instruments   : (data.instruments   ? [data.instruments]   : []),
        sector_focus:  Array.isArray(data.sector_focus)  ? data.sector_focus  : (data.sector_focus  ? [data.sector_focus]  : []),
        country_focus: typeof data.country_focus === 'string'
          ? (data.country_focus as string).split(',').map((c: string) => c.trim()).filter(Boolean)
          : data.country_focus,
      };
      await investorsApi.create(formattedData);
      setShowModal(false);
      reset();
      fetchInvestors();
    } catch {
      setFetchError('Failed to create partner.');
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchInvestors, reset]);

  const openMatches = useCallback(async (investor: Investor) => {
    setMatchState({ investor, results: [], loading: true });
    try {
      const res = await fetch('/api/investors/match', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ investorId: investor.id }),
      });
      const json = await res.json() as { data?: MatchRow[] };
      setMatchState({ investor, results: json.data ?? [], loading: false });
    } catch (err) {
      Sentry.captureException(err);
      setMatchState(prev => prev ? { ...prev, loading: false } : null);
    }
  }, []);

  const exportCsv = useCallback(() => {
    const rows = [
      ['Name','Email','Org Type','Sector Focus','Country Focus','Min Ticket','Max Ticket','Profile %'],
      ...filtered.map(inv => [
        inv.fund_name,
        inv.email ?? '',
        (inv as unknown as { organization_type?: string }).organization_type ?? '',
        (inv.sector_focus ?? []).join(';'),
        (inv.country_focus ?? []).join(';'),
        String(inv.ticket_size_min ?? ''),
        String(inv.ticket_size_max ?? ''),
        String((inv as unknown as { profile_complete?: number }).profile_complete ?? 0),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'partners.csv';
    a.click();
  }, [filtered]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Export CSV
          </button>
          {canWrite && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-brand-gold text-brand-navy px-4 py-2 rounded-lg hover:bg-brand-gold-dark transition text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4" />
              New Partner
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{fetchError}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search partners…"
          className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        />
        <select
          value={filterOrg}
          onChange={e => setFilterOrg(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        >
          <option value="">All types</option>
          {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="ml-auto self-center text-sm text-gray-500">{filtered.length} partner{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.length > 0 ? filtered.map(inv => (
            <PartnerCard
              key={inv.id}
              investor={inv}
              onFindMatches={openMatches}
            />
          )) : (
            <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-sm">
              <p className="text-gray-500">
                {searchQuery || filterOrg ? 'No partners match your filters.' : 'No partners yet. Add the first one.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Partner Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">Add New Partner</h2>
              <button onClick={() => { setShowModal(false); reset(); }} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fund / Organization Name *</label>
                  <input
                    {...register('fund_name', { required: 'Required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                  {errors.fund_name && <p className="text-red-500 text-xs mt-1">{errors.fund_name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Type</label>
                  <select
                    {...register('investor_type')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  >
                    <option value="">Select…</option>
                    {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country of Origin</label>
                  <select
                    {...register('country_of_origin' as keyof InvestorCreate)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  >
                    <option value="">Select…</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    {...register('website' as keyof InvestorCreate)}
                    type="url"
                    placeholder="https://"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Ticket ($)</label>
                  <input
                    {...register('ticket_size_min', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Ticket ($)</label>
                  <input
                    {...register('ticket_size_max', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AUM ($)</label>
                  <input
                    {...register('aum', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target IRR (%)</label>
                  <input
                    {...register('target_irr', { valueAsNumber: true })}
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sector Focus</label>
                  <select
                    {...register('sector_focus')}
                    multiple
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50 h-28"
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage Focus</label>
                  <select
                    {...register('stage_focus' as keyof InvestorCreate)}
                    multiple
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50 h-28"
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country Focus</label>
                  <input
                    {...register('country_focus')}
                    placeholder="Kenya, Nigeria, Global (comma-separated)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instruments</label>
                  <div className="border border-gray-300 rounded-lg p-3 grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                    {INSTRUMENTS.map(i => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" value={i} {...register('instruments')} className="accent-brand-gold" />
                        {i}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    {...register('description' as keyof InvestorCreate)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ESG Constraints</label>
                  <textarea
                    {...register('esg_constraints')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark disabled:opacity-50">
                  {isSubmitting ? 'Saving…' : 'Add Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Match Results Modal */}
      {matchState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Project Matches</h2>
                <p className="text-sm text-gray-500">{matchState.investor.fund_name}</p>
              </div>
              <button onClick={() => setMatchState(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {matchState.loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold" />
                </div>
              ) : matchState.results.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No projects to score yet.</p>
              ) : (
                <div className="space-y-3">
                  {matchState.results.slice(0, 20).map(r => (
                    <div key={r.projectId} className="flex items-start gap-4 p-4 border border-gray-200 rounded-xl hover:border-brand-gold/40 transition">
                      {/* Score ring */}
                      <div className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold border-2 ${scoreColor(r.score)}`}>
                        {r.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{r.projectName}</p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                          <span>Sector {r.breakdown.sector}</span>
                          <span>Country {r.breakdown.country}</span>
                          <span>Stage {r.breakdown.stage}</span>
                          <span>Ticket {r.breakdown.ticket}</span>
                          <span>Type {r.breakdown.partnerType}</span>
                        </div>
                        {r.reasons.length > 0 && (
                          <p className="text-xs text-green-700 mt-1">{r.reasons.join(' · ')}</p>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/projects/${r.projectId}`}
                        className="shrink-0 text-xs text-brand-gold hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Partner Card ───────────────────────────────────────────────────────────────
function PartnerCard({ investor, onFindMatches }: { investor: Investor; onFindMatches: (inv: Investor) => void }) {
  const inv = investor as Investor & { organization_type?: string; profile_complete?: number; stage_focus?: string[] };
  const sectorFocus  = inv.sector_focus  ?? [];
  const countryFocus = inv.country_focus ?? [];
  const instruments  = inv.instruments   ?? [];
  const completeness = inv.profile_complete ?? 0;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition flex flex-col">
      {/* Card header */}
      <div className="p-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{inv.fund_name}</h3>
          {inv.organization_type && (
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${orgTypeColor(inv.organization_type)}`}>
              {inv.organization_type}
            </span>
          )}
        </div>
        {/* Profile completeness ring */}
        <div className="shrink-0 relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={completeness >= 70 ? '#16a34a' : completeness >= 40 ? '#d97706' : '#ef4444'}
              strokeWidth="3"
              strokeDasharray={`${(completeness / 100) * 94.25} 94.25`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
            {completeness}%
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pb-4 space-y-3 flex-1">
        {/* Ticket range */}
        {(inv.ticket_size_min || inv.ticket_size_max) ? (
          <div>
            <p className="text-xs text-gray-500 uppercase mb-0.5">Ticket Size</p>
            <p className="text-sm font-medium text-gray-900">
              {formatNum(inv.ticket_size_min ?? 0)} – {formatNum(inv.ticket_size_max ?? 0)}
            </p>
          </div>
        ) : null}

        {/* Sector tags */}
        {sectorFocus.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Sectors</p>
            <div className="flex flex-wrap gap-1">
              {sectorFocus.slice(0, 4).map(s => (
                <span key={s} className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">{s}</span>
              ))}
              {sectorFocus.length > 4 && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">+{sectorFocus.length - 4}</span>
              )}
            </div>
          </div>
        )}

        {/* Countries */}
        {countryFocus.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase mb-0.5">Countries</p>
            <p className="text-sm text-gray-700 truncate">{countryFocus.slice(0, 4).join(', ')}{countryFocus.length > 4 ? ` +${countryFocus.length - 4}` : ''}</p>
          </div>
        )}

        {/* Instruments */}
        {instruments.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Instruments</p>
            <div className="flex flex-wrap gap-1">
              {instruments.slice(0, 3).map(i => (
                <span key={i} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">{i}</span>
              ))}
              {instruments.length > 3 && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">+{instruments.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {inv.target_irr && (
          <p className="text-xs text-gray-500">Target IRR: <span className="font-medium text-gray-900">{inv.target_irr}%</span></p>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 pt-2 border-t border-gray-100 flex gap-2">
        <Link
          href={`/dashboard/investors/${inv.id}`}
          className="flex-1 px-3 py-2 text-xs text-center text-brand-gold border border-brand-gold rounded-lg hover:bg-brand-gold/5 transition font-medium"
        >
          View Profile
        </Link>
        <button
          onClick={() => onFindMatches(investor)}
          className="flex-1 px-3 py-2 text-xs text-white bg-brand-navy rounded-lg hover:bg-brand-navy/90 transition font-medium"
        >
          Match Projects
        </button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatNum(n: number) {
  if (!n) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function scoreColor(score: number) {
  if (score >= 70) return 'border-green-500 text-green-700 bg-green-50';
  if (score >= 45) return 'border-yellow-500 text-yellow-700 bg-yellow-50';
  return 'border-red-400 text-red-600 bg-red-50';
}

function orgTypeColor(type: string) {
  const map: Record<string, string> = {
    EPC:        'bg-orange-100 text-orange-800',
    SPONSOR:    'bg-purple-100 text-purple-800',
    INVESTOR:   'bg-blue-100 text-blue-800',
    GOVERNMENT: 'bg-green-100 text-green-800',
    DFI:        'bg-teal-100 text-teal-800',
  };
  return map[type] ?? 'bg-gray-100 text-gray-700';
}
