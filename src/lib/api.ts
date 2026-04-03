import axios, { AxiosInstance } from 'axios';
import { supabase } from './supabase';

export const AUTH_PROVIDER = 'supabase';

// Use relative /api path so all requests route through the Next.js rewrite
// (next.config.ts: /api/* → NEXT_PUBLIC_API_URL/api/*).
// This avoids CORS entirely and keeps the backend URL server-side only.
export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return config;
});

// Statuses that are worth retrying (server-side transient errors)
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
// Statuses that should never be retried
const NO_RETRY_STATUSES  = new Set([400, 401, 403, 404, 422]);

const MAX_RETRIES = 3;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status: number | undefined = error.response?.status;

    // Auth error — try to refresh session before signing out.
    // A backend 401 can mean the JWT just expired; refresh may fix it.
    // Only sign out if the Supabase session itself is gone.
    if (status === 401) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        await supabase.auth.signOut();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }

    // Retry logic for transient server errors
    const config = error.config as typeof error.config & { _retryCount?: number };
    if (
      config &&
      RETRYABLE_STATUSES.has(status ?? 0) &&
      !NO_RETRY_STATUSES.has(status ?? 0)
    ) {
      config._retryCount = (config._retryCount ?? 0) + 1;
      if (config._retryCount <= MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** (config._retryCount - 1), 8000); // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

// Helper that unwraps AxiosResponse.data
const get  = <T>(url: string, params?: object) => api.get<T>(url, params ? { params } : {}).then(r => r.data);
const post = <T>(url: string, data?: unknown) => api.post<T>(url, data).then(r => r.data);
const patch = <T>(url: string, data?: unknown) => api.patch<T>(url, data).then(r => r.data);
const del  = <T>(url: string) => api.delete<T>(url).then(r => r.data);

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface Project {
  id: string | number;
  project_name: string;
  name?: string;
  sector: string;
  country: string;
  region?: string;
  stage: string;
  description?: string;
  project_type?: string;
  capex?: number;
  estimated_capex?: number;
  estimated_cost?: number;
  funding_gap?: number;
  currency?: string;
  status?: string;
  technology?: string;
  gps_location?: string;
  revenue_model?: string;
  offtaker?: string;
  tariff_mechanism?: string;
  fx_exposure?: string;
  concession_length?: number;
  epc_status?: string;
  permits_status?: string;
  land_acquisition_status?: string;
  timeline_fid?: string;
  timeline_cod?: string;
  esg_category?: string;
  political_risk_mitigation?: string;
  sovereign_support?: string;
  strategic_notes?: string;
  source_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectCreate {
  project_name: string;
  sector: string;
  country: string;
  region?: string;
  stage?: string;
  description?: string;
  project_type?: string;
  capex?: number;
  estimated_cost?: number;
  currency?: string;
  status?: string;
  strategic_notes?: string;
  source_url?: string;
}

export interface Investor {
  id: string | number;
  fund_name: string;
  ticket_size_min: number;
  ticket_size_max: number;
  instruments: string[];
  sectors?: string[];
  geographies?: string[];
  sector_focus?: string[];
  country_focus?: string[];
  esg_constraints?: string;
  aum?: number;
  target_irr?: number;
  created_at?: string;
}

export interface InvestorCreate {
  fund_name: string;
  ticket_size_min: number;
  ticket_size_max: number;
  instruments: string[];
  sectors?: string[];
  geographies?: string[];
  sector_focus?: string[];
  country_focus?: string[];
  esg_constraints?: string;
  aum?: number;
  target_irr?: number;
}

export interface Event {
  id: string | number;
  name: string;
  description?: string;
  event_date: string;
  location?: string;
  type?: string;
  project_id?: string | number;
  projects_involved?: (string | number)[];
  created_at?: string;
}

export interface EventCreate {
  name: string;
  description?: string;
  event_date: string;
  location?: string;
  type?: string;
  project_id?: string | number;
  projects_involved?: (string | number)[];
}

export interface Verification {
  id: string | number;
  project_id: string | number;
  level: string;
  status?: string;
  bankability?: {
    overall_score: number;
    technical_readiness: number;
    financial_robustness: number;
    legal_clarity: number;
    esg_compliance: number;
  };
  created_at?: string;
}

export interface VerificationCreate {
  project_id: string | number;
  level: string;
  technical_readiness?: number;
  financial_robustness?: number;
  legal_clarity?: number;
  esg_compliance?: number;
  bankability?: {
    overall_score: number;
    technical_readiness: number;
    financial_robustness: number;
    legal_clarity: number;
    esg_compliance: number;
    risk_flags?: unknown[];
    last_verified?: string;
  };
}

export interface PipelineStage {
  id: string | number;
  name: string;
  code?: string;
  order: number;
  description?: string;
  sla_days?: number;
}

export interface ProjectPipelineStatus {
  id: string | number;
  project_id: string | number;
  project_name?: string;
  stage_id: string | number;
  stage_name?: string;
  current_stage?: string;
  entered_at?: string;
  days_in_stage?: number;
  sla_status?: string;
  sla_remaining?: number;
  sla_days?: number;
  notes?: string;
}

export interface PipelineLog {
  id: string | number;
  project_id: string | number;
  from_stage?: string;
  to_stage: string;
  moved_at: string;
  timestamp?: string;
  moved_by?: string;
  notes?: string;
  days_in_previous_stage?: number;
  sla_breached?: boolean;
}

export interface DataRoom {
  id: string | number;
  name: string;
  project_id: string | number;
  description?: string;
  require_nda?: boolean;
  files?: DataRoomFile[];
  documents?: Record<string, string>;
  access_users?: string[];
  created_at?: string;
}

export interface DataRoomFile {
  id: string | number;
  name: string;
  url: string;
  size?: number;
  uploaded_at?: string;
}

export interface DealRoom {
  id: string | number;
  name: string;
  project_id: string | number;
  description?: string | null;
  status?: string;
  deal_value?: number | null;
  deal_currency?: string;
  target_close_date?: string | null;
  is_video_enabled?: boolean;
  is_chat_enabled?: boolean;
  require_nda?: boolean;
  participants?: string[];
  member_count?: number;
  document_count?: number;
  created_at?: string;
}

export interface EIN {
  id: string | number;
  project_id: string | number;
  title?: string;
  status?: string;
  sections?: EINSection[];
  template?: EINTemplate;
  executive_summary?: string;
  recommendation?: string;
  key_gaps?: string;
  next_steps?: string;
  petfel_score?: number;
  red_flags_count?: number;
  version?: number;
  is_valid?: boolean;
  issues?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface EINSection {
  id: string | number;
  title: string;
  section_name?: string;
  content: string;
  section_code?: string;
  is_reviewed?: boolean;
  generated_by?: string;
  order?: number;
}

export interface EINTemplate {
  id: string | number;
  name: string;
  code?: string;
  sections: string[];
  objective?: string;
  key_questions?: string[];
  output_guidance?: string;
}

export interface PETFELAssessment {
  id: string | number;
  project_id: string | number;
  overall_score?: number;
  status?: string;
  rating?: string;
  gating_result?: string;
  criteria?: PETFELCriterion[];
  scores?: ScoreInput[];
  augmented_scores?: ScoreInput[];
  pillar_scores?: Record<string, number>;
  flags?: Array<{ id?: string | number; pillar: string; criterion: string; message: string; description?: string; severity?: string; is_resolved?: boolean }>;
  created_at?: string;
}

export interface PETFELCriterion {
  id: string | number;
  name: string;
  category: string;
  code?: string;
  score?: number;
  weight?: number;
  notes?: string;
}

export interface ScoreInput {
  criterion_id: string | number;
  score: number;
  notes?: string;
  pillar?: string;
  sub_criterion?: string;
  evidence_notes?: string;
  mitigation?: string;
  owner?: string;
}

export interface ICCommittee {
  id: string | number;
  committee_id?: string | number;
  name: string;
  project_id?: string | number;
  status?: string;
  meeting_date?: string;
  members?: string[];
  votes?: ICVote[];
  decision?: string;
  created_at?: string;
}

export interface ICVote {
  id: string | number;
  committee_id: string | number;
  member_id: string;
  vote: 'approve' | 'reject' | 'abstain';
  comments?: string;
  voted_at?: string;
}

export interface AnalyticReport {
  id: string | number;
  title: string;
  type: string;
  sector?: string;
  country?: string;
  content?: string;
  data?: Record<string, unknown>;
  created_at?: string;
}

export interface AnalyticReportCreate {
  title: string;
  type: string;
  sector?: string;
  country?: string;
  content?: string;
  data?: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  user_type_slug?: string | null;
  organization?: string | null;
  phone?: string | null;
  country?: string | null;
  is_verified?: boolean;
  is_active?: boolean;
  avatar_url?: string | null;
  subscription_tier?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── API Objects ──────────────────────────────────────────────────────────────

export const authAPI = {
  me: () => get<User>('/auth/me'),
};

export const projectsAPI = {
  list:   (params?: object) => get<Project[]>('/projects', params),
  get:    (id: string | number) => get<Project>(`/projects/${id}`),
  create: (d: ProjectCreate) => post<Project>('/projects', d),
  update: (id: string | number, d: Partial<ProjectCreate>) => patch<Project>(`/projects/${id}`, d),
  delete: (id: string | number) => del<void>(`/projects/${id}`),
};
export const projectsApi = projectsAPI;

export const investorsAPI = {
  list:   (params?: object) => get<Investor[]>('/investors', params),
  get:    (id: string | number) => get<Investor>(`/investors/${id}`),
  create: (d: InvestorCreate) => post<Investor>('/investors', d),
  update: (id: string | number, d: Partial<InvestorCreate>) => patch<Investor>(`/investors/${id}`, d),
};
export const investorsApi = investorsAPI;

export const verificationsAPI = {
  list:         (params?: object) => get<Verification[]>('/verifications', params),
  get:          (id: string | number) => get<Verification>(`/verifications/${id}`),
  getByProject: (projectId: string | number) => get<Verification[]>(`/verifications?project_id=${projectId}`),
  create:       (d: VerificationCreate) => post<Verification>('/verifications', d),
  update:       (id: string | number, d: Partial<VerificationCreate>) => patch<Verification>(`/verifications/${id}`, d),
};
export const verificationsApi = verificationsAPI;

export const eventsAPI = {
  list:   (params?: object) => get<Event[]>('/events', params),
  get:    (id: string | number) => get<Event>(`/events/${id}`),
  create: (d: EventCreate) => post<Event>('/events', d),
  update: (id: string | number, d: Partial<EventCreate>) => patch<Event>(`/events/${id}`, d),
  delete: (id: string | number) => del<void>(`/events/${id}`),
};
export const eventsApi = eventsAPI;

export const pipelineAPI = {
  stages:           () => get<PipelineStage[]>('/pipeline/stages'),
  getStages:        () => get<PipelineStage[]>('/pipeline/stages'),
  overview:         () => get<unknown>('/pipeline/overview'),
  seed:             () => post<unknown>('/pipeline/init'),
  statuses:         () => get<ProjectPipelineStatus[]>('/pipeline/statuses'),
  getProjectStatus: (projectId: string | number) => get<ProjectPipelineStatus>(`/pipeline/statuses/${projectId}`),
  getSLAAlerts:     () => get<ProjectPipelineStatus[]>('/pipeline/sla-alerts'),
  logs:             (projectId?: string | number) => get<PipelineLog[]>('/pipeline/logs', projectId ? { project_id: projectId } : {}),
  getHistory:       (projectId: string | number) => get<PipelineLog[]>(`/pipeline/logs?project_id=${projectId}`),
  move:             (projectId: string | number, d: object) => post<unknown>('/pipeline/move', { project_id: projectId, ...d }),
};
export const pipelineApi = pipelineAPI;

export const analyticsAPI = {
  list:    () => get<AnalyticReport[]>('/analytics/reports'),
  summary: () => get<unknown>('/analytics'),
  reports: () => get<AnalyticReport[]>('/analytics/reports'),
  get:     (id: string | number) => get<AnalyticReport>(`/analytics/reports/${id}`),
  create:  (d: AnalyticReportCreate) => post<AnalyticReport>('/analytics/reports', d),
  track:   (d: object) => post<unknown>('/analytics/track', d),
};
export const analyticsApi = analyticsAPI;

export interface UserStats {
  total: number;
  active: number;
  by_role?: Record<string, number>;
}

export const usersAPI = {
  list:           (params?: object) => get<User[]>('/users', params),
  listUsers:      (params?: object) => get<User[]>('/users', params),
  get:            (id: string) => get<User>(`/users/${id}`),
  getStats:       () => get<UserStats>('/users/stats'),
  create:         (d: object) => post<User>('/users', d),
  createUser:     (d: object) => post<User>('/users', d),
  update:         (id: string, d: Partial<User>) => patch<User>(`/users/${id}`, d),
  updateUser:     (id: string, d: Partial<User>) => patch<User>(`/users/${id}`, d),
  delete:         (id: string) => del<void>(`/users/${id}`),
  deleteUser:     (id: string) => del<void>(`/users/${id}`),
  deactivateUser: (id: string) => post<User>(`/users/${id}/deactivate`),
  activateUser:   (id: string) => post<User>(`/users/${id}/activate`),
  verifyUser:     (id: string) => post<User>(`/users/${id}/verify`),
};
export const usersApi = usersAPI;

export const dataRoomsAPI = {
  list:   () => get<DataRoom[]>('/data-rooms'),
  get:    (id: string | number) => get<DataRoom>(`/data-rooms/${id}`),
  create: (d: object) => post<DataRoom>('/data-rooms', d),
  delete: (id: string | number) => del<void>(`/data-rooms/${id}`),
};
export const dataRoomsApi = dataRoomsAPI;

export const dealRoomsAPI = {
  list:   () => get<DealRoom[]>('/deal-rooms'),
  get:    (id: string | number) => get<DealRoom>(`/deal-rooms/${id}`),
  create: (d: object) => post<DealRoom>('/deal-rooms', d),
  delete: (id: string | number) => del<void>(`/deal-rooms/${id}`),
};
export const dealRoomsApi = dealRoomsAPI;

export const petfelAPI = {
  list:             () => get<PETFELAssessment[]>('/petfel'),
  get:              (id: string | number) => get<PETFELAssessment>(`/petfel/${id}`),
  getAssessment:    (id: string | number) => get<PETFELAssessment>(`/petfel/${id}`),
  getByProject:     (projectId: string | number) => get<PETFELAssessment>(`/petfel/project/${projectId}`),
  getCriteria:      (projectId?: string | number) => get<PETFELCriterion[]>(projectId ? `/petfel/criteria/${projectId}` : '/petfel/criteria'),
  assess:           (projectId: string | number, d: object) => post<PETFELAssessment>(`/petfel/assess/${projectId}`, d),
  createAssessment: (projectId: string | number, d?: object) => post<PETFELAssessment>(`/petfel/assess/${projectId}`, d ?? {}),
  score:            (assessmentId: string | number, scores: ScoreInput[]) => post<PETFELAssessment>(`/petfel/${assessmentId}/scores`, { scores }),
  updateScores:     (assessmentId: string | number, scores: ScoreInput[]) => post<PETFELAssessment>(`/petfel/${assessmentId}/scores`, { scores }),
  calculate:        (assessmentId: string | number) => post<PETFELAssessment>(`/petfel/${assessmentId}/calculate`),
  submit:           (assessmentId: string | number) => post<PETFELAssessment>(`/petfel/${assessmentId}/submit`),
};
export const petfelApi = petfelAPI;

export const einAPI = {
  list:          () => get<EIN[]>('/ein'),
  get:           (projectId: string | number) => get<EIN>(`/ein/${projectId}`),
  getById:       (id: string | number) => get<EIN>(`/ein/${id}`),
  create:        (projectId: string | number) => post<EIN>(`/ein/${projectId}`, {}),
  update:        (id: string | number, d: Partial<EIN>) => patch<EIN>(`/ein/${id}`, d),
  updateSection: (einId: string | number, sectionId: string | number, d: Partial<EINSection>) => patch<EINSection>(`/ein/${einId}/sections/${sectionId}`, d),
  updateSummary: (id: string | number, d: Partial<EIN>) => patch<EIN>(`/ein/${id}`, d),
  validate:      (id: string | number) => post<EIN>(`/ein/${id}/validate`),
  submit:        (id: string | number) => post<EIN>(`/ein/${id}/submit`),
  approve:       (id: string | number) => post<EIN>(`/ein/${id}/approve`),
  templates:     () => get<EINTemplate[]>('/ein/templates'),
  getTemplates:  () => get<EINTemplate[]>('/ein/templates'),
  generate:      (projectId: string | number) => post<EIN>(`/ein/generate/${projectId}`, {}),
};
export const einApi = einAPI;

export const icAPI = {
  list:            () => get<ICCommittee[]>('/ic'),
  committees:      () => get<ICCommittee[]>('/ic/committees'),
  listCommittees:  () => get<ICCommittee[]>('/ic/committees'),
  get:             (id: string | number) => get<ICCommittee>(`/ic/committees/${id}`),
  getCommittee:    (id: string | number) => get<ICCommittee>(`/ic/committees/${id}`),
  create:          (d: object) => post<ICCommittee>('/ic/committees', d),
  createCommittee: (d: object) => post<ICCommittee>('/ic/committees', d),
  vote:            (id: string | number, d: object) => post<ICVote>(`/ic/committees/${id}/vote`, d),
  submitVote:      (id: string | number, vote: string, rationale?: string) => post<ICVote>(`/ic/committees/${id}/vote`, { vote, rationale }),
  recordDecision:  (id: string | number, outcome: string | object) => post<ICCommittee>(`/ic/committees/${id}/decision`, typeof outcome === 'string' ? { outcome } : outcome),
};
export const icApi = icAPI;

export const matchingAPI = {
  list: () => get<unknown[]>('/matching'),
  run:  (projectId: string | number) => post<unknown>(`/matching/run/${projectId}`, {}),
  get:  (projectId: string | number) => get<unknown>(`/matching/${projectId}`),
};
export const matchingApi = matchingAPI;

export const radarAPI = {
  list:    () => get<unknown[]>('/radar'),
  results: () => get<unknown[]>('/radar/results'),
  scan:    () => post<unknown>('/radar/scan', {}),
};
export const radarApi = radarAPI;

export interface EINGenerated {
  sections?: Record<string, string>;
  executive_summary?: string;
  recommendation?: string;
  key_gaps?: string;
  next_steps?: string;
}

export const aiApi = {
  analyze:       (d: object) => post<unknown>('/ai/analyze', d),
  generate:      (d: object) => post<unknown>('/ai/generate', d),
  generateEIN:   (d: object) => post<EINGenerated>('/ai/generate-ein', d),
  augmentPETFEL: (d: object) => post<PETFELAssessment>('/ai/augment-petfel', d),
};

export default api;
