'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlusIcon, XIcon } from '@/components/ui/icons';
import { useDebounce } from '@/hooks/useDebounce';
import { projectsApi, verificationsApi, Project, ProjectCreate } from '../../../lib/api';
import { projectHealthScore, healthScoreColor, healthScoreLabel } from '@/lib/projectHealth';
import { PermissionGuard } from '@/components/PermissionGuard';
import { useToast } from '@/context/ToastContext';

// ── Config ────────────────────────────────────────────────────────────────────

const SECTORS = ['Energy', 'Mining', 'Water', 'Transport', 'Ports', 'Rail', 'Roads', 'Agriculture', 'Health', 'ICT', 'Social'];
const STAGES  = ['planned', 'pre-feasibility', 'feasibility', 'procurement', 'construction', 'operational', 'decommissioned'];

const DEAL_STAGES = ['CONCEPT', 'PREFEASIBILITY', 'FEASIBILITY', 'STRUCTURING', 'PROCUREMENT', 'FINANCIAL_CLOSE', 'CONSTRUCTION', 'OPERATIONS'];

const PROJECT_STATUSES = [
  { value: 'DRAFT', label: 'Draft', description: 'Internal only - not visible to partners' },
  { value: 'SUBMITTED', label: 'Submitted', description: 'Internal only - submitted for review' },
  { value: 'UNDER_REVIEW', label: 'Under Review', description: 'Internal only - being reviewed' },
  { value: 'APPROVED', label: 'Approved', description: 'Internal only - approved but not published' },
  { value: 'ACTIVE', label: 'Active (Published)', description: 'Visible to all partners' },
  { value: 'FUNDED', label: 'Funded (Published)', description: 'Visible to all partners' },
  { value: 'CLOSED', label: 'Closed (Published)', description: 'Visible to all partners' },
  { value: 'REJECTED', label: 'Rejected', description: 'Internal only - rejected' },
];

const PROJECT_TYPES = [
  { value: 'EPC', label: 'EPC', risk: 'Medium' },
  { value: 'EPC_F', label: 'EPC+F', risk: 'High' },
  { value: 'PPP', label: 'PPP', risk: 'Medium-High' },
  { value: 'PRIVATE', label: 'Private', risk: 'Variable' },
  { value: 'OTHER', label: 'Other', risk: 'Variable' },
];

const STAGE_COLORS: Record<string, string> = {
  planned:           'bg-gray-100 text-gray-800',
  'pre-feasibility': 'bg-blue-100 text-blue-800',
  feasibility:       'bg-indigo-100 text-indigo-800',
  procurement:       'bg-yellow-100 text-yellow-800',
  construction:      'bg-orange-100 text-orange-800',
  operational:       'bg-green-100 text-green-800',
  decommissioned:    'bg-red-100 text-red-800',
  CONCEPT:           'bg-gray-100 text-gray-800',
  PREFEASIBILITY:    'bg-blue-100 text-blue-800',
  FEASIBILITY:       'bg-indigo-100 text-indigo-800',
  STRUCTURING:       'bg-purple-100 text-purple-800',
  FINANCIAL_CLOSE:   'bg-amber-100 text-amber-800',
  OPERATIONS:        'bg-green-100 text-green-800',
};

const VERIFY_COLORS: Record<string, string> = {
  V0: 'bg-gray-100 text-gray-700',
  V1: 'bg-blue-100 text-blue-700',
  V2: 'bg-yellow-100 text-yellow-700',
  V3: 'bg-green-100 text-green-700',
};

const RISK_COLORS: Record<string, string> = {
  Low: 'bg-green-100 text-green-800 border-green-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Medium-High': 'bg-orange-100 text-orange-800 border-orange-200',
  High: 'bg-red-100 text-red-800 border-red-200',
  Variable: 'bg-blue-100 text-blue-800 border-blue-200',
};

const TYPE_ICONS: Record<string, string> = {
  EPC: '🏗️',
  EPC_F: '💰',
  PPP: '🤝',
  PRIVATE: '🔒',
  OTHER: '📋',
};

type ViewMode = 'cards' | 'kanban' | 'table';

// ── Country flag helper ───────────────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
  'nigeria': '🇳🇬', 'ghana': '🇬🇭', 'kenya': '🇰🇪', 'ethiopia': '🇪🇹', 'tanzania': '🇹🇿',
  'uganda': '🇺🇬', 'mozambique': '🇲🇿', 'zambia': '🇿🇲', 'zimbabwe': '🇿🇼', 'south africa': '🇿🇦',
  'senegal': '🇸🇳', 'ivory coast': '🇨🇮', 'cote d\'ivoire': '🇨🇮', 'cameroon': '🇨🇲',
  'morocco': '🇲🇦', 'egypt': '🇪🇬', 'tunisia': '🇹🇳', 'angola': '🇦🇴', 'namibia': '🇳🇦',
  'botswana': '🇧🇼', 'rwanda': '🇷🇼', 'malawi': '🇲🇼', 'madagascar': '🇲🇬', 'congo': '🇨🇩',
  'drc': '🇨🇩', 'sudan': '🇸🇩', 'somalia': '🇸🇴', 'liberia': '🇱🇷', 'sierra leone': '🇸🇱',
  'togo': '🇹🇬', 'benin': '🇧🇯', 'niger': '🇳🇪', 'mali': '🇲🇱', 'burkina faso': '🇧🇫',
  'guinea': '🇬🇳', 'chad': '🇹🇩', 'eritrea': '🇪🇷', 'djibouti': '🇩🇯', 'lesotho': '🇱🇸',
  'eswatini': '🇸🇿', 'swaziland': '🇸🇿', 'gabon': '🇬🇦', 'mauritius': '🇲🇺', 'seychelles': '🇸🇨',
  'india': '🇮🇳', 'pakistan': '🇵🇰', 'bangladesh': '🇧🇩', 'indonesia': '🇮🇩', 'vietnam': '🇻🇳',
  'thailand': '🇹🇭', 'philippines': '🇵🇭', 'malaysia': '🇲🇾', 'brazil': '🇧🇷', 'colombia': '🇨🇴',
  'peru': '🇵🇪', 'chile': '🇨🇱', 'mexico': '🇲🇽', 'usa': '🇺🇸', 'uk': '🇬🇧',
  'france': '🇫🇷', 'germany': '🇩🇪', 'china': '🇨🇳', 'japan': '🇯🇵', 'australia': '🇦🇺',
  'canada': '🇨🇦', 'netherlands': '🇳🇱', 'uae': '🇦🇪', 'saudi arabia': '🇸🇦', 'qatar': '🇶🇦',
};

function countryFlag(country?: string | null): string {
  if (!country) return '🌍';
  return COUNTRY_FLAGS[country.toLowerCase()] ?? '🌍';
}

function formatCost(val?: number | null): string {
  if (!val) return '—';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val}`;
}

function projectStage(p: Project): string {
  return p.dealStage ?? p.stage ?? p.status ?? '—';
}

function projectTitle(p: Project): string {
  return p.title ?? p.project_name ?? p.name ?? String(p.id);
}

function projectCost(p: Project): number | undefined | null {
  return p.totalCost ?? p.estimated_cost ?? p.estimated_capex ?? p.capex;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { error: toastError, success: toastSuccess } = useToast();
  const [projects, setProjects]   = useState<Project[]>([]);
  const [verificationMap, setVerificationMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode]   = useState<ViewMode>('cards');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject]   = useState<Project | null>(null);
  const [filter, setFilter] = useState({ sector: '', country: '', status: '' });
  const debouncedFilter = useDebounce(filter, 300);
  const [newForm, setNewForm] = useState<ProjectCreate>({
    project_name: '', country: '', sector: '', stage: '', status: 'planned',
    region: '', project_type: '', description: '', strategic_notes: '',
    estimated_cost: undefined, currency: '', dealStage: 'CONCEPT',
  });
  const [editForm, setEditForm] = useState<ProjectCreate>({
    project_name: '', sector: '', country: '', stage: '', region: '',
    project_type: '', description: '', strategic_notes: '',
    estimated_cost: undefined, currency: '', dealStage: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'ARCHIVE' | 'RESTORE' | 'DELETE' | 'UPDATE_STATUS' | 'ASSIGN_OWNER' | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string>('ACTIVE');
  const [bulkOwnerId, setBulkOwnerId] = useState<string>('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (debouncedFilter.sector)  params.sector  = debouncedFilter.sector;
      if (debouncedFilter.country) params.country = debouncedFilter.country;
      if (debouncedFilter.status)  params.status  = debouncedFilter.status;
      const [projectsData, verificationsData] = await Promise.allSettled([
        projectsApi.list(params),
        verificationsApi.list(),
      ]);
      if (projectsData.status === 'fulfilled') setProjects(projectsData.value);
      if (verificationsData.status === 'fulfilled') {
        // Build map: projectId → highest verification level
        const vMap: Record<string, string> = {};
        const LEVEL_ORDER = ['V3', 'V2', 'V1', 'V0'];
        for (const v of verificationsData.value) {
          const pid = String(v.project_id);
          const cur = vMap[pid];
          const newLvl = String(v.level ?? '').substring(0, 2);
          if (!cur || LEVEL_ORDER.indexOf(newLvl) < LEVEL_ORDER.indexOf(cur.substring(0, 2))) {
            vMap[pid] = String(v.level ?? '');
          }
        }
        setVerificationMap(vMap);
      }
      setFetchError(null);
    } catch {
      setFetchError('Failed to load projects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedFilter]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await projectsApi.create(newForm);
      setShowModal(false);
      setNewForm({ project_name: '', country: '', sector: '', stage: '', status: 'planned' });
      toastSuccess('Project created.');
      fetchProjects();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create project.';
      toastError(msg);
    } finally { setIsSubmitting(false); }
  }, [newForm, fetchProjects, toastSuccess, toastError]);

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setEditForm({
      project_name:    projectTitle(p),
      country:         p.country || '',
      region:          p.region  || '',
      sector:          p.sector  || '',
      stage:           p.stage   || '',
      dealStage:       p.dealStage || '',
      project_type:    p.projectType || p.project_type  || '',
      estimated_cost:  projectCost(p) ?? undefined,
      status:          p.status  || 'planned',
      description:     p.description || '',
      strategic_notes: p.strategic_notes || '',
      source_url:      p.source_url || '',
    });
    setShowEditModal(true);
  };

  const handleEdit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    setIsSubmitting(true);
    try {
      console.log('[handleEdit] Updating project:', editingProject.id, 'with data:', editForm);
      await projectsApi.update(editingProject.id, editForm);
      setShowEditModal(false); setEditingProject(null);
      toastSuccess('Project updated.');
      fetchProjects();
    } catch (err: unknown) {
      console.error('[handleEdit] Update failed:', err);
      const response = (err as { response?: { data?: { error?: string; detail?: string; details?: unknown } } })?.response;
      const msg = response?.data?.error || response?.data?.detail || 'Failed to update project.';
      const details = response?.data?.details;
      if (details) console.error('[handleEdit] Validation details:', details);
      toastError(msg);
    } finally { setIsSubmitting(false); }
  }, [editingProject, editForm, fetchProjects, toastSuccess, toastError]);

  const handleDelete = useCallback(async (id: string | number) => {
    if (!confirm('Delete this project?')) return;
    try {
      await projectsApi.delete(id);
      toastSuccess('Project deleted.');
      fetchProjects();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to delete project.');
    }
  }, [fetchProjects, toastSuccess, toastError]);

  const handleDragStart = useCallback((project: Project) => {
    setDraggedProject(project);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedProject) return;

    const currentStage = (draggedProject.dealStage ?? draggedProject.stage ?? '').toUpperCase().replace(/ /g, '_');
    if (currentStage === targetStage) {
      setDraggedProject(null);
      return;
    }

    try {
      await projectsApi.updateStage(draggedProject.id, targetStage);
      toastSuccess(`Moved ${projectTitle(draggedProject)} to ${targetStage.replace(/_/g, ' ')}`);
      fetchProjects();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to update stage.');
    } finally {
      setDraggedProject(null);
    }
  }, [draggedProject, fetchProjects, toastSuccess, toastError]);

  const countries = [...new Set(projects.map(p => p.country).filter(Boolean))];

  const toggleSelectAll = useCallback(() => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map(p => String(p.id))));
    }
  }, [projects, selectedProjects.size]);

  const toggleSelectProject = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(async () => {
    if (!bulkAction || selectedProjects.size === 0) return;
    setIsBulkSubmitting(true);
    try {
      const projectIds = Array.from(selectedProjects);
      const payload: { action: string; status?: string; ownerId?: string } = { action: bulkAction };
      if (bulkAction === 'UPDATE_STATUS') payload.status = bulkStatus;
      if (bulkAction === 'ASSIGN_OWNER') payload.ownerId = bulkOwnerId;

      await projectsApi.bulk(bulkAction, projectIds, payload);
      toastSuccess(`Bulk ${bulkAction.toLowerCase().replace('_', ' ')} completed.`);
      setShowBulkModal(false);
      setBulkAction(null);
      setSelectedProjects(new Set());
      fetchProjects();
    } catch (err: unknown) {
      toastError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Bulk operation failed.');
    } finally {
      setIsBulkSubmitting(false);
    }
  }, [bulkAction, selectedProjects, bulkStatus, bulkOwnerId, fetchProjects, toastSuccess, toastError]);

  const openBulkModal = useCallback((action: typeof bulkAction) => {
    setBulkAction(action);
    setShowBulkModal(true);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {(['cards', 'kanban', 'table'] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition ${viewMode === mode ? 'bg-brand-navy text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {mode}
              </button>
            ))}
          </div>
          <PermissionGuard require="create_project">
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-brand-gold text-brand-navy px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-gold-dark transition">
              <PlusIcon className="w-4 h-4" /> New Project
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <select value={filter.sector} onChange={e => setFilter(f => ({ ...f, sector: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/40">
            <option value="">All Sectors</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/40">
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filter.country} onChange={e => setFilter(f => ({ ...f, country: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold/40">
            <option value="">All Countries</option>
            {countries.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>
          <span className="ml-auto self-center text-sm text-gray-500">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{fetchError}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold" />
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.length > 0 ? projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              verificationLevel={verificationMap[String(p.id)]}
              onView={() => setSelectedProject(p)}
              onEdit={() => openEdit(p)}
              onDelete={() => handleDelete(p.id)}
            />
          )) : (
            <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-sm">
              <p className="text-gray-500">No projects found. Create your first project.</p>
            </div>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View with Drag-and-Drop */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {DEAL_STAGES.map(stage => {
            const colProjects = projects.filter(p =>
              (p.dealStage ?? p.stage ?? p.status ?? '').toUpperCase().replace(/ /g, '_') === stage
            );
            const isDragOver = dragOverStage === stage;
            return (
              <div key={stage} className="shrink-0 w-64">
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-800'}`}>
                  <span className="text-xs font-semibold">{stage.replace(/_/g, ' ')}</span>
                  <span className="text-xs bg-white/60 px-1.5 py-0.5 rounded-full">{colProjects.length}</span>
                </div>
                <div
                  className={`space-y-3 min-h-[400px] rounded-xl p-3 transition-colors ${
                    isDragOver ? 'bg-brand-gold/10 border-2 border-dashed border-brand-gold' : 'border-2 border-transparent'
                  }`}
                  onDragOver={(e) => handleDragOver(e, stage)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  {colProjects.map(p => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(p)}
                      className="cursor-move"
                    >
                      <ProjectCard
                        project={p}
                        compact
                        verificationLevel={verificationMap[String(p.id)]}
                        onView={() => setSelectedProject(p)}
                        onEdit={() => openEdit(p)}
                        onDelete={() => handleDelete(p.id)}
                      />
                    </div>
                  ))}
                  {colProjects.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-8">
                      {isDragOver ? 'Drop here' : 'No projects'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Bulk Actions Bar */}
          {selectedProjects.size > 0 && (
            <div className="px-5 py-3 bg-brand-gold/10 border-b border-brand-gold/20 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">
                {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <PermissionGuard require="delete_project">
                  <button onClick={() => openBulkModal('ARCHIVE')}
                    className="px-3 py-1.5 text-xs bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition">
                    Archive Selected
                  </button>
                  <button onClick={() => openBulkModal('DELETE')}
                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                    Delete Selected
                  </button>
                </PermissionGuard>
                <PermissionGuard require="edit_project">
                  <button onClick={() => openBulkModal('UPDATE_STATUS')}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Change Status
                  </button>
                </PermissionGuard>
                <button onClick={() => setSelectedProjects(new Set())}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  Clear Selection
                </button>
              </div>
            </div>
          )}
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left">
                  <input type="checkbox"
                    checked={selectedProjects.size === projects.length && projects.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold/50"
                  />
                </th>
                {['Project', 'Visibility', 'Sector', 'Category', 'Country', 'Stage', 'Risk', 'Est. Cost', 'Health', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projects.length > 0 ? projects.map(p => {
                const stage = projectStage(p);
                const projectType = p.projectType || p.project_type;
                const typeConfig = PROJECT_TYPES.find(pt => pt.value === projectType);
                const riskRating = p.riskRating || typeConfig?.risk;
                const isPublished = ['ACTIVE', 'FUNDED', 'CLOSED'].includes(p.status || '');
                const isSelected = selectedProjects.has(String(p.id));
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-brand-gold/5' : ''}`}>
                    <td className="px-5 py-3">
                      <input type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectProject(String(p.id))}
                        className="w-4 h-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold/50"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 text-sm">{projectTitle(p)}</div>
                      {p.description && <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{p.description}</div>}
                    </td>
                    <td className="px-5 py-3">
                      {isPublished ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full border border-green-200">
                          👁️ Published
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-300">
                          🔒 Draft
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {p.sector && <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">{p.sector}</span>}
                    </td>
                    <td className="px-5 py-3">
                      {projectType && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full font-medium">
                          {typeConfig?.label || projectType}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {p.country ? `${countryFlag(p.country)} ${p.country}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-800'}`}>{stage}</span>
                    </td>
                    <td className="px-5 py-3">
                      {riskRating && (
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${RISK_COLORS[riskRating] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {riskRating}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{formatCost(projectCost(p))}</td>
                    <td className="px-5 py-3"><HealthBadge project={p} /></td>
                    <td className="px-5 py-3 text-right space-x-2 text-sm whitespace-nowrap">
                      <button onClick={() => setSelectedProject(p)} className="text-brand-gold hover:underline">View</button>
                      <PermissionGuard require="edit_project">
                        <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline">Edit</button>
                      </PermissionGuard>
                      <PermissionGuard require="delete_project">
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">Delete</button>
                      </PermissionGuard>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={11} className="px-5 py-12 text-center text-gray-500 text-sm">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {showBulkModal && bulkAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  Bulk {bulkAction.replace('_', ' ')}
                </h2>
                <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                {bulkAction === 'ARCHIVE' && `Archive ${selectedProjects.size} project${selectedProjects.size !== 1 ? 's' : ''}?`}
                {bulkAction === 'DELETE' && `Permanently delete ${selectedProjects.size} project${selectedProjects.size !== 1 ? 's' : ''}? This action cannot be undone.`}
                {bulkAction === 'RESTORE' && `Restore ${selectedProjects.size} archived project${selectedProjects.size !== 1 ? 's' : ''}?`}
                {bulkAction === 'UPDATE_STATUS' && `Update status for ${selectedProjects.size} project${selectedProjects.size !== 1 ? 's' : ''}:`}
                {bulkAction === 'ASSIGN_OWNER' && `Reassign owner for ${selectedProjects.size} project${selectedProjects.size !== 1 ? 's' : ''}:`}
              </p>

              {bulkAction === 'UPDATE_STATUS' && (
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50 mb-4">
                  {PROJECT_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              )}

              {bulkAction === 'ASSIGN_OWNER' && (
                <input type="text" value={bulkOwnerId} onChange={(e) => setBulkOwnerId(e.target.value)}
                  placeholder="Enter owner user ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50 mb-4"
                />
              )}

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isBulkSubmitting}>
                  Cancel
                </button>
                <button onClick={handleBulkAction}
                  disabled={isBulkSubmitting || (bulkAction === 'ASSIGN_OWNER' && !bulkOwnerId)}
                  className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${
                    bulkAction === 'DELETE' ? 'bg-red-600 hover:bg-red-700' :
                    bulkAction === 'ARCHIVE' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-brand-gold hover:bg-brand-gold-dark text-brand-navy'
                  }`}>
                  {isBulkSubmitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <ProjectFormModal
          title="Create New Project"
          form={newForm}
          setForm={setNewForm as React.Dispatch<React.SetStateAction<ProjectCreate>>}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          isSubmitting={isSubmitting}
          submitLabel="Create Project"
        />
      )}
      {showEditModal && editingProject && (
        <ProjectFormModal
          title="Edit Project"
          form={editForm}
          setForm={setEditForm as React.Dispatch<React.SetStateAction<ProjectCreate>>}
          onClose={() => { setShowEditModal(false); setEditingProject(null); }}
          onSubmit={handleEdit}
          isSubmitting={isSubmitting}
          submitLabel="Save Changes"
        />
      )}
      {selectedProject && (
        <ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />
      )}
    </div>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({ project, compact = false, verificationLevel, onView, onEdit, onDelete }: {
  project: Project
  compact?: boolean
  verificationLevel?: string
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const stage = projectStage(project);
  const cost  = projectCost(project);
  const score = projectHealthScore(project);
  const vKey  = verificationLevel?.substring(0, 2);
  const projectType = project.projectType || project.project_type;
  const typeConfig = PROJECT_TYPES.find(pt => pt.value === projectType);
  const riskRating = project.riskRating || typeConfig?.risk;
  const isPublished = ['ACTIVE', 'FUNDED', 'CLOSED'].includes(project.status || '');

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition flex flex-col relative">
      {/* Published/Draft Badge */}
      {isPublished ? (
        <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full border border-green-200">
          👁️ Published
        </div>
      ) : (
        <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-300">
          🔒 Internal Only
        </div>
      )}
      <div className="p-4 flex-1 pt-8">
        {/* Flag + Title */}
        <div className="flex items-start gap-2 mb-2">
          <span className="text-xl shrink-0 mt-0.5">{countryFlag(project.country)}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm line-clamp-2">{projectTitle(project)}</p>
            {project.country && !compact && (
              <p className="text-xs text-gray-500 mt-0.5">{project.country}{project.region ? ` · ${project.region}` : ''}</p>
            )}
          </div>
          {projectType && (
            <span className="text-lg shrink-0">{TYPE_ICONS[projectType] || '📋'}</span>
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.sector && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">{project.sector}</span>
          )}
          {stage && stage !== '—' && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-800'}`}>
              {stage.replace(/_/g, ' ')}
            </span>
          )}
          {projectType && (
            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full font-medium">
              {typeConfig?.label || projectType}
            </span>
          )}
          {riskRating && (
            <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${RISK_COLORS[riskRating] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              Risk: {riskRating}
            </span>
          )}
          {vKey && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${VERIFY_COLORS[vKey] ?? 'bg-gray-100 text-gray-700'}`}>
              {vKey}
            </span>
          )}
        </div>

        {/* Cost + Health */}
        {!compact && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            {cost ? <span className="font-semibold text-gray-800">{formatCost(cost)}</span> : <span />}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${healthScoreColor(score)}`}>
              {score} · {healthScoreLabel(score)}
            </span>
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="px-4 pb-3 flex gap-2 border-t mt-2 pt-3">
        <button onClick={onView}
          className="flex-1 px-2 py-1 text-xs text-center text-brand-gold border border-brand-gold rounded-lg hover:bg-brand-gold/5 font-medium">
          View
        </button>
        <PermissionGuard require="edit_project">
          <button onClick={onEdit}
            className="flex-1 px-2 py-1 text-xs text-center text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
            Edit
          </button>
        </PermissionGuard>
        <PermissionGuard require="delete_project">
          <button onClick={onDelete}
            className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
            <XIcon className="w-3 h-3" />
          </button>
        </PermissionGuard>
      </div>
    </div>
  );
}

// ── HealthBadge ───────────────────────────────────────────────────────────────

function HealthBadge({ project }: { project: Project }) {
  const score = projectHealthScore(project);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${healthScoreColor(score)}`}>
      <span className="font-bold">{score}</span>
      <span className="hidden sm:inline">{healthScoreLabel(score)}</span>
    </span>
  );
}

// ── Shared form fields ────────────────────────────────────────────────────────

function ProjectFormModal({ title, form, setForm, onClose, onSubmit, isSubmitting, submitLabel }: {
  title: string
  form: ProjectCreate
  setForm: React.Dispatch<React.SetStateAction<ProjectCreate>>
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  submitLabel: string
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="w-5 h-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
              <input required value={form.project_name}
                onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
              <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                <option value="">Select sector</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Category</label>
              <select value={form.project_type} onChange={e => {
                const selectedType = PROJECT_TYPES.find(pt => pt.value === e.target.value);
                setForm(f => ({ ...f, project_type: e.target.value }));
              }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                <option value="">Select category</option>
                {PROJECT_TYPES.map(pt => (
                  <option key={pt.value} value={pt.value}>{pt.label} — Risk: {pt.risk}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Stage</label>
              <select value={form.dealStage || form.status} onChange={e => setForm(f => ({ ...f, dealStage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                {DEAL_STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Visibility Status *
                <span className="ml-1 text-xs text-gray-500">(Controls partner access)</span>
              </label>
              <select value={form.status || 'DRAFT'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50">
                {PROJECT_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.description}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                💡 Set to <strong>ACTIVE</strong>, <strong>FUNDED</strong>, or <strong>CLOSED</strong> to publish to external partners
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost (USD)</label>
              <input type="number" value={form.estimated_cost ?? ''}
                onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="e.g. 500000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Strategic Notes</label>
              <textarea rows={2} value={form.strategic_notes}
                onChange={e => setForm(f => ({ ...f, strategic_notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/50" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-brand-gold text-brand-navy rounded-lg hover:bg-brand-gold-dark disabled:opacity-50">
              {isSubmitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ProjectDetailModal ────────────────────────────────────────────────────────

function ProjectDetailModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const cost = projectCost(project);
  const projectType = project.projectType || project.project_type;
  const typeConfig = PROJECT_TYPES.find(pt => pt.value === projectType);
  const riskRating = project.riskRating || typeConfig?.risk;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{countryFlag(project.country)}</span>
            <h2 className="text-lg font-bold text-gray-900">{projectTitle(project)}</h2>
            {projectType && (
              <span className="text-2xl">{TYPE_ICONS[projectType] || '📋'}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4">
            <DItem label="Sector"        val={project.sector || '—'} />
            <DItem label="Country"       val={project.country || '—'} />
            <DItem label="Region"        val={project.region || '—'} />
            <DItem label="Stage"         val={projectStage(project)} />
            <div>
              <p className="text-xs text-gray-500">Project Category</p>
              <p className="text-sm font-medium text-gray-900">{typeConfig?.label || projectType || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Risk Rating</p>
              <span className={`inline-block mt-1 px-3 py-1 text-xs rounded-full border font-medium ${riskRating ? RISK_COLORS[riskRating] : ''} ${!riskRating ? 'bg-gray-100 text-gray-700 border-gray-200' : ''}`}>
                {riskRating || '—'}
              </span>
            </div>
            <DItem label="Estimated Cost" val={formatCost(cost)} />
            {project.description && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-900">{project.description}</p>
              </div>
            )}
            {project.strategic_notes && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Strategic Notes</p>
                <p className="text-sm text-gray-900">{project.strategic_notes}</p>
              </div>
            )}
            {project.source_url && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Source URL</p>
                <a href={project.source_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline">{project.source_url}</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DItem({ label, val }: { label: string; val: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{val}</p>
    </div>
  );
}
