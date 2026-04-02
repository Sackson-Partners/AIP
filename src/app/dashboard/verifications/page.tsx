'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { verificationsApi, projectsApi, Verification, Project, VerificationCreate } from '../../../lib/api';

const VERIFICATION_LEVELS = [
  { value: 'V0: Submitted', label: 'V0: Submitted', color: 'bg-gray-100 text-gray-800' },
  { value: 'V1: Sponsor Identity Verified', label: 'V1: Sponsor Verified', color: 'bg-blue-100 text-blue-800' },
  { value: 'V2: Documents Verified', label: 'V2: Documents Verified', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'V3: Bankability Screened', label: 'V3: Bankability Screened', color: 'bg-green-100 text-green-800' },
];

interface VerificationFormData {
  project_id: number;
  level: string;
  technical_readiness?: number;
  financial_robustness?: number;
  legal_clarity?: number;
  esg_compliance?: number;
}

export default function VerificationsPage() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<VerificationFormData>();
  const selectedLevel = watch('level');

  const fetchData = async () => {
    try {
      const [verificationsData, projectsData] = await Promise.all([
        verificationsApi.list(),
        projectsApi.list(),
      ]);
      setVerifications(verificationsData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onSubmit = async (data: VerificationFormData) => {
    try {
      const formattedData: VerificationCreate = {
        project_id: Number(data.project_id),
        level: data.level,
      };

      if (data.level === 'V3: Bankability Screened') {
        formattedData.bankability = {
          technical_readiness: data.technical_readiness || 0,
          financial_robustness: data.financial_robustness || 0,
          legal_clarity: data.legal_clarity || 0,
          esg_compliance: data.esg_compliance || 0,
          overall_score: (
            (data.technical_readiness || 0) +
            (data.financial_robustness || 0) +
            (data.legal_clarity || 0) +
            (data.esg_compliance || 0)
          ) / 4,
          risk_flags: [],
          last_verified: new Date().toISOString().split('T')[0],
        };
      }

      await verificationsApi.create(formattedData);
      setShowModal(false);
      reset();
      fetchData();
    } catch (error) {
      console.error('Failed to create verification:', error);
    }
  };

  const getProjectName = (projectId: string | number) => {
    const project = projects.find(p => String(p.id) === String(projectId));
    return project?.project_name || `Project #${projectId}`;
  };

  const getLevelStyle = (level: string) => {
    const levelConfig = VERIFICATION_LEVELS.find(l => l.value === level);
    return levelConfig?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Verifications</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg hover:bg-brand-gold-dark transition flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Verification
        </button>
      </div>

      {/* Verification Level Legend */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Verification Levels</h3>
        <div className="flex flex-wrap gap-3">
          {VERIFICATION_LEVELS.map((level) => (
            <div key={level.value} className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded-full ${level.color}`}>
                {level.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bankability Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Technical</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Financial</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Legal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ESG</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {verifications.length > 0 ? (
                verifications.map((verification) => (
                  <tr key={verification.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{getProjectName(verification.project_id)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getLevelStyle(verification.level)}`}>
                        {verification.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {verification.bankability ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-brand-gold h-2 rounded-full"
                              style={{ width: `${verification.bankability.overall_score}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-700">{verification.bankability.overall_score.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {verification.bankability?.technical_readiness ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {verification.bankability?.financial_robustness ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {verification.bankability?.legal_clarity ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {verification.bankability?.esg_compliance ?? '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No verifications found. Start by verifying a project.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Verification Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Create Verification</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
                <select
                  {...register('project_id', { required: 'Project is required' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                >
                  <option value="">Select project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
                {errors.project_id && <p className="text-red-500 text-sm mt-1">{errors.project_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Level *</label>
                <select
                  {...register('level', { required: 'Level is required' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                >
                  <option value="">Select level</option>
                  {VERIFICATION_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                {errors.level && <p className="text-red-500 text-sm mt-1">{errors.level.message}</p>}
              </div>

              {selectedLevel === 'V3: Bankability Screened' && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900">Bankability Scores (0-100)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Technical Readiness</label>
                      <input
                        {...register('technical_readiness', { valueAsNumber: true, min: 0, max: 100 })}
                        type="number"
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Financial Robustness</label>
                      <input
                        {...register('financial_robustness', { valueAsNumber: true, min: 0, max: 100 })}
                        type="number"
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Legal Clarity</label>
                      <input
                        {...register('legal_clarity', { valueAsNumber: true, min: 0, max: 100 })}
                        type="number"
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ESG Compliance</label>
                      <input
                        {...register('esg_compliance', { valueAsNumber: true, min: 0, max: 100 })}
                        type="number"
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50"
                      />
                    </div>
                  </div>
                </div>
              )}

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
                  Create Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
