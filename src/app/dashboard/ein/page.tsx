'use client';

import { useCallback, useEffect, useState } from 'react';
import { projectsApi, einApi, aiApi, Project, EIN, EINSection, EINTemplate } from '../../../lib/api';
import { DocumentIcon, XIcon } from '@/components/ui/icons';
import { useToast } from '../../../context/ToastContext';

const SECTION_NAMES = [
  'Cover & Executive Summary',
  'Strategy Perspective',
  'Political Perspective',
  'Economic Perspective',
  'Financial Perspective',
  'Legal & Regulatory Perspective',
  'Risk Register & Mitigation Plan',
  'Required Next Steps (30/60/90 Days)',
  'Annexes',
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
};

const RECOMMENDATION_OPTIONS = [
  { value: 'go', label: 'GO', color: 'bg-green-600' },
  { value: 'hold', label: 'HOLD', color: 'bg-yellow-500' },
  { value: 'no_go', label: 'NO-GO', color: 'bg-red-600' },
];

export default function EINPage() {
  const { success, error: toastError } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [ein, setEin] = useState<EIN | null>(null);
  const [templates, setTemplates] = useState<EINTemplate[]>([]);
  const [activeSection, setActiveSection] = useState<number>(0);
  const [sectionContent, setSectionContent] = useState<string>('');
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [keyGaps, setKeyGaps] = useState<string>('');
  const [nextSteps, setNextSteps] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Fetch projects and templates on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsData, templatesData] = await Promise.all([
          projectsApi.list(),
          einApi.getTemplates(),
        ]);
        setProjects(projectsData);
        setTemplates(templatesData);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch data:', err);
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load EIN when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setEin(null);
      resetForm();
      return;
    }

    const loadEIN = async () => {
      setIsLoading(true);
      try {
        const data = await einApi.get(selectedProjectId);
        setEin(data);
        loadSectionContent(data, activeSection);
        setExecutiveSummary(data.executive_summary || '');
        setRecommendation(data.recommendation || '');
        setKeyGaps(data.key_gaps || '');
        setNextSteps(data.next_steps || '');
      } catch (err: unknown) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) {
          setEin(null);
          resetForm();
        } else {
          // eslint-disable-next-line no-console
          console.error('Failed to load EIN:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadEIN();
  // resetForm/activeSection excluded: re-running on section change would reset loaded EIN data
  }, [selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = useCallback(() => {
    setSectionContent('');
    setExecutiveSummary('');
    setRecommendation('');
    setKeyGaps('');
    setNextSteps('');
    setActiveSection(0);
  }, []);

  const loadSectionContent = (einData: EIN, sectionCode: number) => {
    const section = einData.sections?.find((s) => String(s.section_code) === String(sectionCode));
    setSectionContent(section?.content || '');
  };

  const handleCreateEIN = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    try {
      const data = await einApi.create(selectedProjectId);
      setEin(data);
      resetForm();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to create EIN:', err);
      setError('Failed to create EIN');
    } finally {
      setIsSaving(false);
    }
  }, [selectedProjectId, resetForm]);

  const handleSectionChange = (sectionCode: number) => {
    // Save current section first if changed
    if (ein && sectionContent !== getSection(ein, activeSection)?.content) {
      handleSaveSection(false);
    }
    setActiveSection(sectionCode);
    if (ein) {
      loadSectionContent(ein, sectionCode);
    }
  };

  const getSection = (einData: EIN, sectionCode: number): EINSection | undefined => {
    return einData.sections?.find((s) => String(s.section_code) === String(sectionCode));
  };

  const handleSaveSection = async (showAlert = true) => {
    if (!ein) return;
    setIsSaving(true);
    try {
      await einApi.updateSection(ein.id, activeSection, { content: sectionContent });
      // Refresh EIN
      const updated = await einApi.getById(ein.id);
      setEin(updated);
      if (showAlert) {
        // Visual feedback without alert
        const btn = document.getElementById('save-btn');
        if (btn) {
          btn.textContent = 'Saved!';
          setTimeout(() => { btn.textContent = 'Save Section'; }, 1500);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save section:', err);
      setError('Failed to save section');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!ein || !recommendation) return;
    setIsSaving(true);
    try {
      const updated = await einApi.updateSummary(ein.id, {
        executive_summary: executiveSummary,
        recommendation,
        key_gaps: keyGaps,
        next_steps: nextSteps,
      });
      setEin(updated);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to save summary:', err);
      setError('Failed to save summary');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!selectedProjectId) return;
    if (!confirm('Generate EIN content using AI? This will replace any existing draft content.')) return;
    setIsGenerating(true);
    try {
      const result = await aiApi.generateEIN({ project_id: selectedProjectId });
      // Create EIN if doesn't exist
      let currentEin = ein;
      if (!currentEin) {
        currentEin = await einApi.create(selectedProjectId);
      }
      // Update all sections with AI content
      if (result.sections) {
        for (const [code, content] of Object.entries(result.sections)) {
          await einApi.updateSection(currentEin.id, parseInt(code), { content: content as string, generated_by: 'ai' });
        }
      }
      // Update summary
      if (result.executive_summary) {
        await einApi.updateSummary(currentEin.id, {
          executive_summary: result.executive_summary,
          recommendation: result.recommendation || 'hold',
        });
      }
      // Reload EIN
      const updated = await einApi.getById(currentEin.id);
      setEin(updated);
      loadSectionContent(updated, activeSection);
      setExecutiveSummary(updated.executive_summary || '');
      setRecommendation(updated.recommendation || '');
      success('AI generation complete! Please review and edit the content.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to generate:', err);
      setError('Failed to generate EIN with AI');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!ein) return;
    // Validate first
    try {
      const validation = await einApi.validate(ein.id);
      if (!validation.is_valid) {
        toastError('Cannot submit: ' + (validation.issues ?? []).join(', '));
        return;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Validation failed:', err);
    }
    if (!confirm('Submit this EIN for review?')) return;
    setIsSaving(true);
    try {
      const updated = await einApi.submit(ein.id);
      setEin(updated);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to submit:', err);
      setError('Failed to submit EIN');
    } finally {
      setIsSaving(false);
    }
  }, [ein, toastError]);

  const handleApprove = async () => {
    if (!ein) return;
    if (!confirm('Approve this EIN for distribution?')) return;
    setIsSaving(true);
    try {
      const updated = await einApi.approve(ein.id);
      setEin(updated);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to approve:', err);
      setError('Failed to approve EIN');
    } finally {
      setIsSaving(false);
    }
  };

  const getSectionStatus = (section?: EINSection): 'empty' | 'ai' | 'reviewed' | 'draft' => {
    if (!section || !section.content) return 'empty';
    if (section.is_reviewed) return 'reviewed';
    if (section.generated_by === 'ai') return 'ai';
    return 'draft';
  };

  const getSectionStatusIcon = (status: string) => {
    switch (status) {
      case 'reviewed': return <span className="w-2 h-2 rounded-full bg-green-500"></span>;
      case 'ai': return <span className="w-2 h-2 rounded-full bg-purple-500"></span>;
      case 'draft': return <span className="w-2 h-2 rounded-full bg-blue-500"></span>;
      default: return <span className="w-2 h-2 rounded-full bg-gray-300"></span>;
    }
  };

  const activeTemplate = templates.find((t) => String(t.code) === String(activeSection));

  if (isLoading && !projects.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Executive Investment Note</h1>
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

      {selectedProjectId && !ein && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-600 mb-4">No EIN exists for this project yet.</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleCreateEIN}
              disabled={isSaving}
              className="bg-brand-gold text-brand-navy px-6 py-3 rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-50"
            >
              {isSaving ? 'Creating...' : 'Create EIN'}
            </button>
            <button
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <SparklesIcon className="w-5 h-5" />
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
        </div>
      )}

      {ein && (
        <>
          {/* Status Bar */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-sm text-gray-500">Status</span>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_COLORS[ein.status ?? '']}`}>
                    {(ein.status ?? '').replace('_', ' ')}
                  </div>
                </div>
                {ein.petfel_score && (
                  <div>
                    <span className="text-sm text-gray-500">PETFEL Score</span>
                    <div className="text-lg font-bold text-gray-900">{ein.petfel_score.toFixed(1)}</div>
                  </div>
                )}
                {(ein.red_flags_count ?? 0) > 0 && (
                  <div>
                    <span className="text-sm text-gray-500">Red Flags</span>
                    <div className="text-lg font-bold text-red-600">{ein.red_flags_count}</div>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500">Version</span>
                  <div className="text-lg font-medium text-gray-700">v{ein.version}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateAI}
                  disabled={isGenerating || ein.status !== 'draft'}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  <SparklesIcon className="w-5 h-5" />
                  {isGenerating ? 'Generating...' : 'AI Generate'}
                </button>
                {ein.status === 'draft' && (
                  <button
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="bg-brand-gold text-brand-navy px-4 py-2 rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-50"
                  >
                    Submit for Review
                  </button>
                )}
                {ein.status === 'in_review' && (
                  <button
                    onClick={handleApprove}
                    disabled={isSaving}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Editor */}
          <div className="flex gap-6">
            {/* Section Navigation */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-semibold text-gray-700 mb-4">Sections</h3>
                <nav className="space-y-1">
                  {SECTION_NAMES.map((name, idx) => {
                    const section = getSection(ein, idx);
                    const status = getSectionStatus(section);
                    const isActive = activeSection === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSectionChange(idx)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {getSectionStatusIcon(status)}
                        <span className="truncate">{idx}. {name}</span>
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span> Reviewed
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span> AI Generated
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Draft
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-300"></span> Empty
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Editor */}
            <div className="flex-1">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {activeSection}. {SECTION_NAMES[activeSection]}
                  </h2>
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="text-brand-gold hover:text-brand-gold-dark text-sm flex items-center gap-1"
                  >
                    <InfoIcon className="w-4 h-4" />
                    View Template
                  </button>
                </div>

                {/* Section 0: Executive Summary has special fields */}
                {activeSection === 0 ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Executive Summary
                      </label>
                      <textarea
                        value={executiveSummary}
                        onChange={(e) => setExecutiveSummary(e.target.value)}
                        disabled={ein.status !== 'draft'}
                        placeholder="Write the executive summary..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg min-h-40 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Recommendation
                      </label>
                      <div className="flex gap-3">
                        {RECOMMENDATION_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setRecommendation(opt.value)}
                            disabled={ein.status !== 'draft'}
                            className={`px-6 py-2 rounded-lg font-medium transition ${
                              recommendation === opt.value
                                ? `${opt.color} text-white`
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } disabled:opacity-50`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Key Gaps
                      </label>
                      <textarea
                        value={keyGaps}
                        onChange={(e) => setKeyGaps(e.target.value)}
                        disabled={ein.status !== 'draft'}
                        placeholder="List the key gaps or concerns..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg min-h-24 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Next Steps
                      </label>
                      <textarea
                        value={nextSteps}
                        onChange={(e) => setNextSteps(e.target.value)}
                        disabled={ein.status !== 'draft'}
                        placeholder="Outline the immediate next steps..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg min-h-24 disabled:bg-gray-50"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveSummary}
                        disabled={isSaving || ein.status !== 'draft'}
                        className="bg-brand-gold text-brand-navy px-6 py-2 rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save Summary'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <textarea
                      value={sectionContent}
                      onChange={(e) => setSectionContent(e.target.value)}
                      disabled={ein.status !== 'draft'}
                      placeholder={`Write the ${SECTION_NAMES[activeSection]} content here...\n\nMarkdown formatting is supported.`}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg min-h-96 font-mono text-sm disabled:bg-gray-50"
                    />
                    <div className="flex justify-end">
                      <button
                        id="save-btn"
                        onClick={() => handleSaveSection(true)}
                        disabled={isSaving || ein.status !== 'draft'}
                        className="bg-brand-gold text-brand-navy px-6 py-2 rounded-lg hover:bg-brand-gold-dark transition disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save Section'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!selectedProjectId && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <DocumentIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Select a Project</h2>
          <p className="text-gray-500">Choose a project from the dropdown above to view or create an Executive Investment Note.</p>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && activeTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Section {activeTemplate.code}: {activeTemplate.name}
                </h3>
                <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Objective</h4>
                  <p className="text-gray-600">{activeTemplate.objective}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Key Questions</h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {(activeTemplate.key_questions ?? []).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Output Guidance</h4>
                  <p className="text-gray-600">{activeTemplate.output_guidance}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  );
}
