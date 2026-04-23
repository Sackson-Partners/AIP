'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { projectsApi, petfelApi, aiApi, Project, PETFELAssessment, PETFELCriterion, ScoreInput } from '../../../lib/api';
import { WarningIcon, ChevronIcon } from '@/components/ui/icons';
import { useToast } from '../../../context/ToastContext';
import * as Sentry from '@sentry/nextjs';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// PETFEL Pillar configuration with weights
const PILLARS = [
  { code: 'political', name: 'Political', weight: 15, color: 'blue' },
  { code: 'economic', name: 'Economic', weight: 15, color: 'green' },
  { code: 'technical', name: 'Technical', weight: 20, color: 'purple' },
  { code: 'financial', name: 'Financial', weight: 20, color: 'yellow' },
  { code: 'environmental', name: 'Environmental', weight: 15, color: 'teal' },
  { code: 'legal', name: 'Legal', weight: 15, color: 'orange' },
];

const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Critical Risk', color: 'bg-red-500' },
  2: { label: 'High Risk', color: 'bg-orange-500' },
  3: { label: 'Moderate', color: 'bg-yellow-500' },
  4: { label: 'Good', color: 'bg-green-400' },
  5: { label: 'Best Practice', color: 'bg-green-600' },
};

const RATING_COLORS: Record<string, string> = {
  A: 'bg-green-600 text-white',
  B: 'bg-brand-gold text-brand-navy',
  C: 'bg-yellow-500 text-gray-900',
  D: 'bg-red-600 text-white',
};

export default function PETFELPage() {
  const { success } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [assessment, setAssessment] = useState<PETFELAssessment | null>(null);
  const [criteria, setCriteria] = useState<Record<string, PETFELCriterion[]>>({});
  const [scores, setScores] = useState<Record<string, Record<string, ScoreInput>>>({});
  const [expandedPillars, setExpandedPillars] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isAugmenting, setIsAugmenting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects and criteria on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsData, criteriaData] = await Promise.all([
          projectsApi.list(),
          petfelApi.getCriteria(),
        ]);
        setProjects(projectsData);
        const criteriaMap: Record<string, PETFELCriterion[]> = {};
        criteriaData.forEach((c) => {
          const key = c.category || 'default';
          if (!criteriaMap[key]) criteriaMap[key] = [];
          criteriaMap[key].push(c);
        });
        setCriteria(criteriaMap);
        // Expand first pillar by default
        setExpandedPillars({ political: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        Sentry.captureException(err);
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load assessment when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setAssessment(null);
      setScores({});
      return;
    }

    const loadAssessment = async () => {
      setIsLoading(true);
      try {
        const data = await petfelApi.getAssessment(selectedProjectId);
        setAssessment(data);
        // Initialize scores from assessment
        const scoreMap: Record<string, Record<string, ScoreInput>> = {};
        data.scores?.forEach((s) => {
          const pillarKey = s.pillar ?? '';
          const subKey = s.sub_criterion ?? '';
          if (!scoreMap[pillarKey]) scoreMap[pillarKey] = {};
          scoreMap[pillarKey][subKey] = {
            criterion_id: s.criterion_id,
            pillar: s.pillar,
            sub_criterion: s.sub_criterion,
            score: s.score,
            evidence_notes: s.evidence_notes,
            mitigation: s.mitigation,
            owner: s.owner,
          };
        });
        setScores(scoreMap);
      } catch (err: unknown) {
        // No assessment exists yet
        if ((err as { response?: { status?: number } })?.response?.status === 404) {
          setAssessment(null);
          setScores({});
        } else {
          // eslint-disable-next-line no-console
          Sentry.captureException(err);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadAssessment();
  }, [selectedProjectId]);

  const handleCreateAssessment = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    try {
      const data = await petfelApi.createAssessment(selectedProjectId);
      setAssessment(data);
      setScores({});
    } catch (err) {
      // eslint-disable-next-line no-console
      Sentry.captureException(err);
      setError('Failed to create assessment');
    } finally {
      setIsSaving(false);
    }
  }, [selectedProjectId]);

  const handleScoreChange = (pillar: string, criterion: string, score: number) => {
    setScores((prev): Record<string, Record<string, ScoreInput>> => ({
      ...prev,
      [pillar]: {
        ...(prev[pillar] || {}),
        [criterion]: {
          ...(prev[pillar]?.[criterion] || {}),
          criterion_id: criterion,
          pillar,
          sub_criterion: criterion,
          score,
        },
      },
    }));
  };

  const handleNotesChange = (pillar: string, criterion: string, field: 'evidence_notes' | 'mitigation' | 'owner', value: string) => {
    setScores((prev): Record<string, Record<string, ScoreInput>> => ({
      ...prev,
      [pillar]: {
        ...(prev[pillar] || {}),
        [criterion]: {
          ...(prev[pillar]?.[criterion] || { score: 0 }),
          criterion_id: criterion,
          pillar,
          sub_criterion: criterion,
          [field]: value,
        },
      },
    }));
  };

  const handleSaveScores = async () => {
    if (!assessment) return;
    setIsSaving(true);
    try {
      const scoresList: ScoreInput[] = [];
      Object.values(scores).forEach((pillarScores) => {
        Object.values(pillarScores).forEach((s) => {
          if (s.score > 0) scoresList.push(s);
        });
      });
      const updated = await petfelApi.updateScores(assessment.id, scoresList);
      setAssessment(updated);
    } catch (err) {
      // eslint-disable-next-line no-console
      Sentry.captureException(err);
      setError('Failed to save scores');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCalculate = async () => {
    if (!assessment) return;
    setIsCalculating(true);
    try {
      // Save first, then calculate
      await handleSaveScores();
      const updated = await petfelApi.calculate(assessment.id);
      setAssessment(updated);
    } catch (err) {
      // eslint-disable-next-line no-console
      Sentry.captureException(err);
      setError('Failed to calculate scores');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!assessment) return;
    if (!confirm('Submit this assessment for review? This action cannot be undone.')) return;
    setIsSaving(true);
    try {
      const updated = await petfelApi.submit(assessment.id);
      setAssessment(updated);
    } catch (err) {
      // eslint-disable-next-line no-console
      Sentry.captureException(err);
      setError('Failed to submit assessment');
    } finally {
      setIsSaving(false);
    }
  }, [assessment]);

  const handleAIAugment = async () => {
    if (!assessment) return;
    setIsAugmenting(true);
    try {
      const result = await aiApi.augmentPETFEL({ assessment_id: assessment.id });
      // Apply AI suggestions to scores
      if (result.augmented_scores) {
        const newScores = { ...scores };
        result.augmented_scores.forEach((s: ScoreInput) => {
          const pillarKey = s.pillar ?? '';
          const subKey = s.sub_criterion ?? '';
          if (!newScores[pillarKey]) newScores[pillarKey] = {};
          newScores[pillarKey][subKey] = s;
        });
        setScores(newScores);
      }
      success('AI augmentation complete! Review the suggested scores.');
    } catch (err) {
      // eslint-disable-next-line no-console
      Sentry.captureException(err);
      setError('Failed to get AI suggestions');
    } finally {
      setIsAugmenting(false);
    }
  };

  const togglePillar = (pillar: string) => {
    setExpandedPillars((prev) => ({ ...prev, [pillar]: !prev[pillar] }));
  };

  const pillarScores = useMemo(
    () => assessment?.pillar_scores ?? {},
    [assessment]
  );
  const getPillarScore = (pillarCode: string): number => pillarScores[pillarCode] || 0;

  if (isLoading && !projects.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">PETFEL Assessment</h1>
        <select
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/50 min-w-64"
        >
          <option value="">Select a Project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name} ({p.country})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {selectedProjectId && !assessment && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-600 mb-4">No assessment exists for this project yet.</p>
          <button
            onClick={handleCreateAssessment}
            disabled={isSaving}
            className="bg-brand-gold text-brand-navy px-6 py-3 rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-50"
          >
            {isSaving ? 'Creating...' : 'Start PETFEL Assessment'}
          </button>
        </div>
      )}

      {assessment && (
        <>
          {/* Summary Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-sm text-gray-500">Overall Score</span>
                  <div className="text-3xl font-bold text-gray-900">
                    {assessment.overall_score?.toFixed(1) || '—'}
                  </div>
                </div>
                {assessment.rating && (
                  <div>
                    <span className="text-sm text-gray-500">Rating</span>
                    <div className={`text-2xl font-bold px-4 py-1 rounded-lg ${RATING_COLORS[assessment.rating]}`}>
                      {assessment.rating}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500">Status</span>
                  <div className="text-lg font-medium text-gray-700 capitalize">
                    {assessment.status}
                  </div>
                </div>
                {assessment.gating_result && (
                  <div>
                    <span className="text-sm text-gray-500">Gating</span>
                    <div className={`text-lg font-bold ${assessment.gating_result === 'GO' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {assessment.gating_result}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAIAugment}
                  disabled={isAugmenting || assessment.status !== 'draft'}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isAugmenting ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <SparklesIcon className="w-5 h-5" />
                  )}
                  AI Augment
                </button>
                <button
                  onClick={handleCalculate}
                  disabled={isCalculating || assessment.status !== 'draft'}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
                >
                  {isCalculating ? 'Calculating...' : 'Calculate'}
                </button>
                <button
                  onClick={handleSaveScores}
                  disabled={isSaving || assessment.status !== 'draft'}
                  className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                {assessment.status === 'draft' && assessment.overall_score && (
                  <button
                    onClick={handleSubmit}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                  >
                    Submit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Red Flags */}
          {assessment.flags && assessment.flags.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-800 mb-2">Red Flags ({assessment.flags.length})</h3>
              <ul className="space-y-1">
                {assessment.flags.map((flag) => (
                  <li key={flag.id} className="flex items-center gap-2 text-red-700">
                    <WarningIcon className="w-4 h-4" />
                    <span className="font-medium">{flag.pillar}:</span>
                    <span>{flag.description}</span>
                    {flag.is_resolved && <span className="text-green-600 text-sm">(Resolved)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pillar Sections */}
          <div className="space-y-4">
            {PILLARS.map((pillar) => (
              <div key={pillar.code} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Pillar Header */}
                <button
                  onClick={() => togglePillar(pillar.code)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-3 h-3 rounded-full bg-${pillar.color}-500`}></span>
                    <span className="font-semibold text-lg">{pillar.name}</span>
                    <span className="text-sm text-gray-500">({pillar.weight}%)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm text-gray-500">Score:</span>
                      <span className="ml-2 font-bold text-lg">
                        {getPillarScore(pillar.code)?.toFixed(1) || '—'}
                      </span>
                    </div>
                    <ChevronIcon className={`w-5 h-5 transition-transform ${expandedPillars[pillar.code] ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Pillar Criteria */}
                {expandedPillars[pillar.code] && (
                  <div className="border-t border-gray-200 px-6 py-4">
                    <div className="space-y-6">
                      {criteria[pillar.code]?.map((crit) => {
                        const critCode = crit.code ?? '';
                        const currentScore = scores[pillar.code]?.[critCode]?.score || 0;
                        return (
                          <div key={crit.code} className="border-b border-gray-100 pb-4 last:border-0">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <h4 className="font-medium text-gray-900">{crit.name}</h4>
                                <span className="text-xs text-gray-500">Weight: {((crit.weight ?? 0) * 100).toFixed(0)}%</span>
                              </div>
                              {/* Score Buttons */}
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((score) => (
                                  <button
                                    key={score}
                                    onClick={() => handleScoreChange(pillar.code, critCode, score)}
                                    disabled={assessment.status !== 'draft'}
                                    className={`w-10 h-10 rounded-lg font-bold transition ${
                                      currentScore === score
                                        ? SCORE_LABELS[score].color + ' text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    } disabled:opacity-50`}
                                    title={SCORE_LABELS[score].label}
                                  >
                                    {score}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Notes Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="text-xs text-gray-500">Evidence Notes</label>
                                <textarea
                                  value={scores[pillar.code]?.[critCode]?.evidence_notes || ''}
                                  onChange={(e) => handleNotesChange(pillar.code, critCode, 'evidence_notes', e.target.value)}
                                  disabled={assessment.status !== 'draft'}
                                  placeholder="Supporting evidence..."
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-20 disabled:bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Mitigation</label>
                                <textarea
                                  value={scores[pillar.code]?.[critCode]?.mitigation || ''}
                                  onChange={(e) => handleNotesChange(pillar.code, critCode, 'mitigation', e.target.value)}
                                  disabled={assessment.status !== 'draft'}
                                  placeholder="Risk mitigation plan..."
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-20 disabled:bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Owner</label>
                                <input
                                  type="text"
                                  value={scores[pillar.code]?.[critCode]?.owner || ''}
                                  onChange={(e) => handleNotesChange(pillar.code, critCode, 'owner', e.target.value)}
                                  disabled={assessment.status !== 'draft'}
                                  placeholder="Responsible party..."
                                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!selectedProjectId && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Select a Project</h2>
          <p className="text-gray-500">Choose a project from the dropdown above to view or create a PETFEL assessment.</p>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

// Icon Components
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}

