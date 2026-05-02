'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { analyticsApi, AnalyticReport, AnalyticReportCreate } from '../../../lib/api';
import { PlusIcon, XIcon, DocumentIcon, ChartIcon, GlobeIcon } from '@/components/ui/icons';
import { PermissionGuard, ViewOnlyBadge } from '@/components/PermissionGuard';

const SECTORS = ['Energy', 'Mining', 'Water', 'Transport', 'Ports', 'Rail', 'Roads', 'Agriculture', 'Health'];

export default function AnalyticsPage() {
  const [reports, setReports] = useState<AnalyticReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AnalyticReport | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AnalyticReportCreate>();

  const sectorCount = useMemo(() => new Set(reports.filter(r => r.sector).map(r => r.sector)).size, [reports]);
  const countryCount = useMemo(() => new Set(reports.filter(r => r.country).map(r => r.country)).size, [reports]);

  const fetchReports = async () => {
    try {
      const data = await analyticsApi.list();
      setReports(data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportReport = (report: AnalyticReport) => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${report.title}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; color: #111; line-height: 1.7; }
        h1 { font-size: 22px; border-bottom: 2px solid #c9a227; padding-bottom: 8px; }
        h2 { font-size: 16px; font-weight: bold; margin-top: 28px; color: #1a2e4a; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        h3 { font-size: 14px; font-weight: bold; margin-top: 20px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
        .tag { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; margin-right: 6px; background: #e0f2fe; color: #0369a1; }
        p { font-size: 14px; margin: 6px 0; }
        li { font-size: 14px; margin: 4px 0 4px 20px; }
        @media print { body { margin: 20px; } }
      </style>
    </head><body>
      <h1>${report.title}</h1>
      <div class="meta">
        ${report.sector ? `<span class="tag">${report.sector}</span>` : ''}
        ${report.country ? `<span class="tag">${report.country}</span>` : ''}
        <span style="color:#999">Published: ${report.created_at ? new Date(report.created_at).toLocaleDateString() : '—'}</span>
      </div>
      <div>${(report.content ?? '').split('\n').map(line => {
        if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
        if (line.startsWith('## '))  return `<h2>${line.slice(3)}</h2>`
        if (line.startsWith('# '))   return `<h2>${line.slice(2)}</h2>`
        if (line.startsWith('- ') || line.startsWith('* ')) return `<li>${line.slice(2)}</li>`
        if (line.trim() === '') return '<br/>'
        return `<p>${line}</p>`
      }).join('')}</div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  const onSubmit = async (data: AnalyticReportCreate) => {
    try {
      await analyticsApi.create(data);
      setShowModal(false);
      reset();
      fetchReports();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create report:', error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
          <PermissionGuard require="create_analytic_report" fallback={<ViewOnlyBadge />}>
            <span />
          </PermissionGuard>
        </div>
        <PermissionGuard require="create_analytic_report">
          <button
            onClick={() => setShowModal(true)}
            className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg hover:bg-brand-gold-dark transition flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            New Report
          </button>
        </PermissionGuard>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DocumentIcon className="w-6 h-6 text-brand-gold" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <ChartIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Sectors Covered</p>
              <p className="text-2xl font-bold text-gray-900">
                {sectorCount}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <GlobeIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Countries Covered</p>
              <p className="text-2xl font-bold text-gray-900">
                {countryCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.length > 0 ? (
            reports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <DocumentIcon className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="text-xs text-gray-500">
                    {report.created_at ? new Date(report.created_at).toLocaleDateString() : '—'}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {report.title}
                </h3>

                <div className="flex flex-wrap gap-2 mb-3">
                  {report.sector && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {report.sector}
                    </span>
                  )}
                  {report.country && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      {report.country}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 line-clamp-3">
                  {report.content}
                </p>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 bg-white rounded-xl shadow-sm">
              <ChartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No reports found. Create your first analytics report.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Report Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Create Analytics Report</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  {...register('title', { required: 'Title is required' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="e.g., Q4 2024 Energy Sector Analysis"
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Type *</label>
                <select
                  {...register('type', { required: 'Report type is required' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                >
                  <option value="">Select type</option>
                  <option value="MARKET_ANALYSIS">Market Analysis</option>
                  <option value="SECTOR_REPORT">Sector Report</option>
                  <option value="COUNTRY_BRIEF">Country Brief</option>
                  <option value="INVESTMENT_THESIS">Investment Thesis</option>
                  <option value="RISK_ASSESSMENT">Risk Assessment</option>
                </select>
                {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
                  <select
                    {...register('sector')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                  >
                    <option value="">All Sectors</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    {...register('country')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                    placeholder="e.g., Kenya"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                <textarea
                  {...register('content', { required: 'Content is required' })}
                  rows={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Enter your analysis, insights, and recommendations..."
                />
                {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content.message}</p>}
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
                  className="px-4 py-2 bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark transition"
                >
                  Create Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex-1 min-w-0 truncate pr-4">{selectedReport.title}</h2>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => exportReport(selectedReport)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" /></svg>
                  Export
                </button>
                <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex flex-wrap gap-2 mb-5">
                {selectedReport.sector && (
                  <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">{selectedReport.sector}</span>
                )}
                {selectedReport.country && (
                  <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">{selectedReport.country}</span>
                )}
                <span className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full">
                  {selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
              {/* Render content with basic markdown-like formatting */}
              <div className="prose prose-sm max-w-none text-gray-800">
                {(selectedReport.content ?? '').split('\n').map((line, i) => {
                  if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-gray-900 mt-4 mb-1">{line.slice(4)}</h3>
                  if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-gray-900 mt-5 mb-2 border-b pb-1">{line.slice(3)}</h2>
                  if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-gray-900 mt-5 mb-2">{line.slice(2)}</h1>
                  if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{line.slice(2)}</li>
                  if (line.trim() === '') return <div key={i} className="h-2" />
                  return <p key={i} className="text-sm leading-relaxed">{line}</p>
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

