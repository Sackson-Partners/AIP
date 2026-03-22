'use client';

import { useEffect, useState } from 'react';
import { projectsApi, pipelineApi, Project, PipelineStage, ProjectPipelineStatus, PipelineLog } from '../../../lib/api';

const STAGE_COLORS: Record<string, string> = {
  sourcing: 'bg-blue-500',
  screening: 'bg-yellow-500',
  diligence: 'bg-purple-500',
  ic: 'bg-orange-500',
  execution: 'bg-green-500',
};

const SLA_STATUS_COLORS: Record<string, string> = {
  ok: 'text-green-600 bg-green-50',
  warning: 'text-yellow-600 bg-yellow-50',
  breached: 'text-red-600 bg-red-50',
};

export default function PipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<Record<number, ProjectPipelineStatus>>({});
  const [slaAlerts, setSlaAlerts] = useState<ProjectPipelineStatus[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectHistory, setProjectHistory] = useState<PipelineLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ project: Project; stage: string } | null>(null);
  const [moveNotes, setMoveNotes] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [stagesData, projectsData, alertsData] = await Promise.all([
        pipelineApi.getStages(),
        projectsApi.list(),
        pipelineApi.getSLAAlerts(),
      ]);
      setStages(stagesData);
      setProjects(projectsData);
      setSlaAlerts(alertsData);

      // Fetch status for each project
      const statuses: Record<number, ProjectPipelineStatus> = {};
      await Promise.all(
        projectsData.map(async (p: Project) => {
          try {
            const status = await pipelineApi.getProjectStatus(p.id);
            statuses[p.id] = status;
          } catch {
            // Project may not have pipeline status yet
          }
        })
      );
      setProjectStatuses(statuses);
    } catch (err) {
      console.error('Failed to fetch pipeline data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getProjectsByStage = (stageCode: string): Project[] => {
    return projects.filter((p) => {
      const status = projectStatuses[p.id];
      if (!status) return stageCode === 'sourcing'; // Default to sourcing
      return status.current_stage === stageCode;
    });
  };

  const handleProjectClick = async (project: Project) => {
    setSelectedProject(project);
    try {
      const history = await pipelineApi.getHistory(project.id);
      setProjectHistory(history);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setProjectHistory([]);
    }
  };

  const handleMoveProject = (project: Project, stage: string) => {
    setMoveTarget({ project, stage });
    setMoveNotes('');
    setShowMoveModal(true);
  };

  const confirmMove = async () => {
    if (!moveTarget) return;
    setIsMoving(true);
    try {
      await pipelineApi.move(moveTarget.project.id, moveTarget.stage, moveNotes);
      setShowMoveModal(false);
      setMoveTarget(null);
      fetchData(); // Refresh
    } catch (err) {
      console.error('Failed to move project:', err);
      alert('Failed to move project');
    } finally {
      setIsMoving(false);
    }
  };

  const getStatusForProject = (projectId: number): ProjectPipelineStatus | undefined => {
    return projectStatuses[projectId];
  };

  if (isLoading) {
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
        <h1 className="text-3xl font-bold text-gray-900">Pipeline Management</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{projects.length} Projects</span>
          {slaAlerts.length > 0 && (
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
              {slaAlerts.length} SLA Alerts
            </span>
          )}
        </div>
      </div>

      {/* SLA Alerts */}
      {slaAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <WarningIcon className="w-5 h-5" />
            SLA Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {slaAlerts.map((alert) => (
              <div key={alert.project_id} className="bg-white rounded-lg p-3 border border-red-200">
                <div className="font-medium text-gray-900">{alert.project_name}</div>
                <div className="text-sm text-gray-600">
                  Stage: <span className="capitalize">{alert.current_stage}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-500">{alert.days_in_stage} days</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${SLA_STATUS_COLORS[alert.sla_status]}`}>
                    {alert.sla_status === 'breached' ? `${Math.abs(alert.sla_remaining || 0)} days over` : `${alert.sla_remaining} days left`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageProjects = getProjectsByStage(stage.code);
          return (
            <div
              key={stage.code}
              className="flex-shrink-0 w-72 bg-gray-50 rounded-xl"
            >
              {/* Stage Header */}
              <div className={`px-4 py-3 rounded-t-xl ${STAGE_COLORS[stage.code]} bg-opacity-10 border-b-2 ${STAGE_COLORS[stage.code].replace('bg-', 'border-')}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${STAGE_COLORS[stage.code]}`}></span>
                    <span className="font-semibold text-gray-900">{stage.name}</span>
                  </div>
                  <span className="bg-white px-2 py-1 rounded-full text-sm font-medium text-gray-600">
                    {stageProjects.length}
                  </span>
                </div>
                {stage.sla_days && (
                  <div className="text-xs text-gray-500 mt-1">
                    SLA: {stage.sla_days} days
                  </div>
                )}
              </div>

              {/* Project Cards */}
              <div className="p-3 space-y-3 min-h-[200px]">
                {stageProjects.map((project) => {
                  const status = getStatusForProject(project.id);
                  return (
                    <div
                      key={project.id}
                      className="bg-white rounded-lg shadow-sm p-3 cursor-pointer hover:shadow-md transition"
                      onClick={() => handleProjectClick(project)}
                    >
                      <div className="font-medium text-gray-900 text-sm">{project.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{project.country} - {project.sector}</div>
                      {status && (
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">{status.days_in_stage}d</span>
                          {status.sla_status !== 'ok' && (
                            <span className={`text-xs px-2 py-0.5 rounded ${SLA_STATUS_COLORS[status.sla_status]}`}>
                              {status.sla_status}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Move buttons */}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-gray-100">
                        {stages
                          .filter((s) => s.code !== stage.code)
                          .slice(0, 3)
                          .map((s) => (
                            <button
                              key={s.code}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveProject(project, s.code);
                              }}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition truncate"
                              title={`Move to ${s.name}`}
                            >
                              → {s.name.split(' ')[0]}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })}
                {stageProjects.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-8">
                    No projects
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Detail Sidebar */}
      {selectedProject && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">{selectedProject.name}</h2>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Country</span>
                  <div className="font-medium">{selectedProject.country}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Sector</span>
                  <div className="font-medium">{selectedProject.sector}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Stage</span>
                  <div className="font-medium">{selectedProject.stage}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Est. CAPEX</span>
                  <div className="font-medium">${(selectedProject.estimated_capex / 1000000).toFixed(1)}M</div>
                </div>
              </div>

              {/* Current Pipeline Status */}
              {projectStatuses[selectedProject.id] && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">Pipeline Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Current Stage</span>
                      <span className="font-medium capitalize">{projectStatuses[selectedProject.id].current_stage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Days in Stage</span>
                      <span className="font-medium">{projectStatuses[selectedProject.id].days_in_stage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">SLA Status</span>
                      <span className={`px-2 py-0.5 rounded text-sm ${SLA_STATUS_COLORS[projectStatuses[selectedProject.id].sla_status]}`}>
                        {projectStatuses[selectedProject.id].sla_status}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pipeline History */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Pipeline History</h4>
                {projectHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No history yet</p>
                ) : (
                  <div className="space-y-3">
                    {projectHistory.map((log, idx) => (
                      <div key={log.id} className="relative pl-6">
                        {idx < projectHistory.length - 1 && (
                          <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-gray-200"></div>
                        )}
                        <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-blue-500"></div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm">
                            {log.from_stage && (
                              <>
                                <span className="capitalize">{log.from_stage}</span>
                                <span>→</span>
                              </>
                            )}
                            <span className="font-medium capitalize">{log.to_stage}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(log.timestamp).toLocaleDateString()}
                            {log.days_in_previous_stage && ` • ${log.days_in_previous_stage} days`}
                            {log.sla_breached && <span className="text-red-600 ml-2">SLA Breached</span>}
                          </div>
                          {log.notes && (
                            <div className="text-sm text-gray-600 mt-2">{log.notes}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && moveTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Move Project
            </h3>
            <p className="text-gray-600 mb-4">
              Move <strong>{moveTarget.project.name}</strong> to{' '}
              <strong className="capitalize">{moveTarget.stage.replace('_', ' ')}</strong>?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={moveNotes}
                onChange={(e) => setMoveNotes(e.target.value)}
                placeholder="Add notes about this stage transition..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmMove}
                disabled={isMoving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isMoving ? 'Moving...' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon Components
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
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
