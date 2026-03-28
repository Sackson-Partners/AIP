'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { projectsApi, ProjectCreate } from '../../../../lib/api';
import { useRBAC } from '@/hooks/useRBAC';

const SECTORS = ['Energy', 'Mining', 'Water', 'Transport', 'Ports', 'Rail', 'Roads', 'Agriculture', 'Health', 'ICT', 'Social'];
const STAGES  = ['planned', 'pre-feasibility', 'feasibility', 'procurement', 'construction', 'operational'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR', 'KES', 'NGN'];

const EMPTY_FORM: ProjectCreate = {
  project_name:    '',
  sector:          '',
  country:         '',
  region:          '',
  project_type:    '',
  status:          'planned',
  estimated_cost:  undefined,
  currency:        'USD',
  description:     '',
  strategic_notes: '',
  source_url:      '',
};

export default function NewProjectPage() {
  const router = useRouter();
  const { can } = useRBAC();

  const [form, setForm] = useState<ProjectCreate>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  if (!can('create_project')) {
    return (
      <div className="max-w-lg mx-auto mt-24 text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-bold text-brand-navy">Not Permitted</h1>
        <p className="text-gray-500">You do not have permission to create projects.</p>
        <Link href="/dashboard/projects" className="inline-block mt-2 text-brand-gold hover:underline text-sm">
          Back to Projects
        </Link>
      </div>
    );
  }

  const set = (field: keyof ProjectCreate, value: string | number | undefined) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiError(null);
    try {
      const created = await projectsApi.create(form);
      router.push(`/dashboard/projects/${created.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Failed to create project. Please try again.';
      setApiError(msg);
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50';

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-brand-navy">New Project</h1>
        <Link
          href="/dashboard/projects"
          className="text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Cancel
        </Link>
      </div>

      {apiError && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 space-y-6">
        {/* Project name — full width */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            value={form.project_name}
            onChange={(e) => set('project_name', e.target.value)}
            required
            placeholder="e.g., Nairobi Solar Power Plant"
            className={inputClass}
          />
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
            <select
              value={form.sector}
              onChange={(e) => set('sector', e.target.value)}
              className={inputClass}
            >
              <option value="">Select sector</option>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="e.g., Kenya"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <input
              value={form.region ?? ''}
              onChange={(e) => set('region', e.target.value)}
              placeholder="e.g., East Africa"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
            <input
              value={form.project_type ?? ''}
              onChange={(e) => set('project_type', e.target.value)}
              placeholder="PPP, Greenfield, Brownfield"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status ?? ''}
              onChange={(e) => set('status', e.target.value)}
              className={inputClass}
            >
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
            <input
              type="number"
              value={form.estimated_cost ?? ''}
              onChange={(e) => set('estimated_cost', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="USD amount"
              min={0}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={form.currency ?? 'USD'}
              onChange={(e) => set('currency', e.target.value)}
              className={inputClass}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Full-width text areas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Describe the project…"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Strategic Notes</label>
          <textarea
            value={form.strategic_notes ?? ''}
            onChange={(e) => set('strategic_notes', e.target.value)}
            rows={2}
            placeholder="Internal notes on strategy or context…"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
          <input
            type="url"
            value={form.source_url ?? ''}
            onChange={(e) => set('source_url', e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Link
            href="/dashboard/projects"
            className="px-5 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-semibold bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
