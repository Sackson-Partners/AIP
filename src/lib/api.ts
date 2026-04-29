// src/lib/api.ts
import axios, { AxiosInstance } from 'axios'
import { getSession } from 'next-auth/react'
import { logger } from '@/lib/logger'

// Use relative /api path so all requests route through the Next.js rewrite
// (next.config.ts: /api/* → NEXT_PUBLIC_API_URL/api/*).
// This avoids CORS entirely and keeps the backend URL server-side only.
export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request interceptor ─────────────────────────────────────────
// Injects NextAuth JWT token into every outgoing request
api.interceptors.request.use(
  async (config) => {
    try {
      const session = await getSession()
      if (session?.user) {
        // Send user context headers for backend consumers
        config.headers['X-User-Id'] = session.user.id
        config.headers['X-User-Role'] = session.user.role
        // accessToken is forwarded if present (e.g. Azure AD id_token)
        const s = session as typeof session & { accessToken?: string; idToken?: string }
        const token = s.accessToken ?? s.idToken ?? null
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    } catch (err) {
      // Session fetch failed — continue without token
      logger.warn('[api.ts] Could not get session for request', { detail: err instanceof Error ? err.message : String(err) })
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Statuses that are worth retrying (server-side transient errors)
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504])
// Statuses that should never be retried
const NO_RETRY_STATUSES = new Set([400, 401, 403, 404, 422])

const MAX_RETRIES = 3

// ─── Response interceptor ────────────────────────────────────────
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status: number | undefined = error.response?.status

    if (status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/signin'
      }
      return Promise.reject(error)
    }

    if (status === 403) {
      if (typeof window !== 'undefined') {
        window.location.href = '/unauthorized'
      }
      return Promise.reject(error)
    }

    // Retry logic for transient server errors
    const config = error.config as typeof error.config & { _retryCount?: number }
    if (
      config &&
      RETRYABLE_STATUSES.has(status ?? 0) &&
      !NO_RETRY_STATUSES.has(status ?? 0)
    ) {
      config._retryCount = (config._retryCount ?? 0) + 1
      if (config._retryCount <= MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** (config._retryCount - 1), 8000) // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay))
        return api(config)
      }
    }

    return Promise.reject(error)
  }
)

// Helper that unwraps AxiosResponse.data
const get  = <T>(url: string, params?: object) => api.get<T>(url, params ? { params } : {}).then((r) => r.data)
const post = <T>(url: string, data?: unknown) => api.post<T>(url, data).then((r) => r.data)
const patch = <T>(url: string, data?: unknown) => api.patch<T>(url, data).then((r) => r.data)
const del  = <T>(url: string) => api.delete<T>(url).then((r) => r.data)

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface Project {
  id: string | number
  // Prisma / Next.js API fields (camelCase)
  title?: string
  code?: string
  totalCost?: number
  dealStage?: string
  ownerId?: string
  createdAt?: string
  updatedAt?: string
  // Legacy Python API fields (snake_case) — kept for backward compat with existing components
  project_name?: string
  name?: string
  sector?: string
  country?: string
  region?: string
  stage?: string
  description?: string
  project_type?: string
  capex?: number
  estimated_capex?: number
  estimated_cost?: number
  funding_gap?: number
  currency?: string
  status?: string
  technology?: string
  gps_location?: string
  revenue_model?: string
  offtaker?: string
  tariff_mechanism?: string
  fx_exposure?: string
  concession_length?: number
  epc_status?: string
  permits_status?: string
  land_acquisition_status?: string
  timeline_fid?: string
  timeline_cod?: string
  esg_category?: string
  political_risk_mitigation?: string
  sovereign_support?: string
  strategic_notes?: string
  source_url?: string
  created_at?: string
  updated_at?: string
}

export interface ProjectCreate {
  project_name: string
  sector: string
  country: string
  region?: string
  stage?: string
  description?: string
  project_type?: string
  capex?: number
  estimated_cost?: number
  currency?: string
  status?: string
  strategic_notes?: string
  source_url?: string
}

export interface Investor {
  id: string | number
  fund_name: string
  ticket_size_min: number
  ticket_size_max: number
  instruments: string[]
  investor_type?: string
  sectors?: string[]
  geographies?: string[]
  sector_focus?: string[]
  country_focus?: string[]
  esg_constraints?: string
  aum?: number
  target_irr?: number
  created_at?: string
}

export interface InvestorCreate {
  fund_name: string
  ticket_size_min: number
  ticket_size_max: number
  instruments: string[]
  investor_type?: string
  sectors?: string[]
  geographies?: string[]
  sector_focus?: string[]
  country_focus?: string[]
  esg_constraints?: string
  aum?: number
  target_irr?: number
}

export interface Event {
  id: string | number
  name: string
  description?: string
  event_date: string
  location?: string
  type?: string
  project_id?: string | number
  projects_involved?: (string | number)[]
  created_at?: string
}

export interface EventCreate {
  name: string
  description?: string
  event_date: string
  location?: string
  type?: string
  project_id?: string | number
  projects_involved?: (string | number)[]
}

export interface Verification {
  id: string | number
  project_id: string | number
  level: string
  status?: string
  bankability?: {
    overall_score: number
    technical_readiness: number
    financial_robustness: number
    legal_clarity: number
    esg_compliance: number
  }
  created_at?: string
}

export interface VerificationCreate {
  project_id: string | number
  level: string
  technical_readiness?: number
  financial_robustness?: number
  legal_clarity?: number
  esg_compliance?: number
  bankability?: {
    overall_score: number
    technical_readiness: number
    financial_robustness: number
    legal_clarity: number
    esg_compliance: number
    risk_flags?: unknown[]
    last_verified?: string
  }
}

export interface PipelineStage {
  id: string | number
  name: string
  code?: string
  order: number
  description?: string
  sla_days?: number
}

export interface ProjectPipelineStatus {
  id: string | number
  project_id: string | number
  project_name?: string
  stage_id: string | number
  stage_name?: string
  current_stage?: string
  entered_at?: string
  days_in_stage?: number
  sla_status?: string
  sla_remaining?: number
  sla_days?: number
  notes?: string
}

export interface PipelineLog {
  id: string | number
  project_id: string | number
  from_stage?: string
  to_stage: string
  moved_at: string
  timestamp?: string
  moved_by?: string
  notes?: string
  days_in_previous_stage?: number
  sla_breached?: boolean
}

export interface DataRoom {
  id: string | number
  name: string
  project_id: string | number
  description?: string
  require_nda?: boolean
  files?: DataRoomFile[]
  documents?: Record<string, string>
  access_users?: string[]
  created_at?: string
}

export interface DataRoomFile {
  id: string | number
  name: string
  url: string
  size?: number
  uploaded_at?: string
}

export interface DealRoom {
  id: string | number
  name: string
  project_id: string | number
  description?: string | null
  status?: string
  deal_value?: number | null
  deal_currency?: string
  target_close_date?: string | null
  is_video_enabled?: boolean
  is_chat_enabled?: boolean
  require_nda?: boolean
  participants?: string[]
  member_count?: number
  document_count?: number
  created_at?: string
}

export interface EIN {
  id: string | number
  project_id: string | number
  title?: string
  status?: string
  sections?: EINSection[]
  template?: EINTemplate
  executive_summary?: string
  recommendation?: string
  key_gaps?: string
  next_steps?: string
  petfel_score?: number
  red_flags_count?: number
  version?: number
  is_valid?: boolean
  issues?: string[]
  created_at?: string
  updated_at?: string
}

export interface EINSection {
  id: string | number
  title: string
  section_name?: string
  content: string
  section_code?: string
  is_reviewed?: boolean
  generated_by?: string
  order?: number
}

export interface EINTemplate {
  id: string | number
  name: string
  code?: string
  sections: string[]
  objective?: string
  key_questions?: string[]
  output_guidance?: string
}

export interface PETFELAssessment {
  id: string | number
  project_id: string | number
  overall_score?: number
  status?: string
  rating?: string
  gating_result?: string
  criteria?: PETFELCriterion[]
  scores?: ScoreInput[]
  augmented_scores?: ScoreInput[]
  pillar_scores?: Record<string, number>
  flags?: Array<{ id?: string | number; pillar: string; criterion: string; message: string; description?: string; severity?: string; is_resolved?: boolean }>
  created_at?: string
}

export interface PETFELCriterion {
  id: string | number
  name: string
  category: string
  code?: string
  score?: number
  weight?: number
  notes?: string
}

export interface ScoreInput {
  criterion_id: string | number
  score: number
  notes?: string
  pillar?: string
  sub_criterion?: string
  evidence_notes?: string
  mitigation?: string
  owner?: string
}

export interface ICCommittee {
  id: string | number
  committee_id?: string | number
  name: string
  project_id?: string | number
  status?: string
  meeting_date?: string
  members?: string[]
  votes?: ICVote[]
  decision?: string
  created_at?: string
}

export interface ICVote {
  id: string | number
  committee_id: string | number
  member_id: string
  vote: 'approve' | 'reject' | 'abstain'
  comments?: string
  voted_at?: string
}

export interface AnalyticReport {
  id: string | number
  title: string
  type: string
  sector?: string
  country?: string
  content?: string
  data?: Record<string, unknown>
  created_at?: string
}

export interface AnalyticReportCreate {
  title: string
  type: string
  sector?: string
  country?: string
  content?: string
  data?: Record<string, unknown>
}

export interface User {
  id: string
  email: string
  full_name?: string | null
  role?: string | null
  user_type_slug?: string | null
  organization?: string | null
  phone?: string | null
  country?: string | null
  is_verified?: boolean
  is_active?: boolean
  avatar_url?: string | null
  subscription_tier?: string
  created_at?: string
  updated_at?: string
}

// ─── API Objects ──────────────────────────────────────────────────────────────

export const authAPI = {
  me: () => get<User>('/auth/me'),
}

// Single canonical exports — camelCase only
export const projectsApi = {
  list:   (params?: object) => get<{ data: Project[] }>('/projects', params).then(r => r.data),
  get:    (id: string | number) => get<Project>(`/projects/${id}`),
  create: (d: ProjectCreate) => post<Project>('/projects', d),
  update: (id: string | number, d: Partial<ProjectCreate>) => patch<Project>(`/projects/${id}`, d),
  delete: (id: string | number) => del<void>(`/projects/${id}`),
}

export const investorsApi = {
  list:   (params?: object) => get<{ data: Investor[] }>('/investors', params).then(r => r.data),
  get:    (id: string | number) => get<Investor>(`/investors/${id}`),
  create: (d: InvestorCreate) => post<Investor>('/investors', d),
  update: (id: string | number, d: Partial<InvestorCreate>) => patch<Investor>(`/investors/${id}`, d),
}

export const verificationsApi = {
  list:         (params?: object) => get<{ data: Verification[] }>('/verifications', params).then(r => r.data),
  get:          (id: string | number) => get<Verification>(`/verifications/${id}`),
  getByProject: (projectId: string | number) => get<{ data: Verification[] }>(`/verifications?project_id=${projectId}`).then(r => r.data),
  create:       (d: VerificationCreate) => post<Verification>('/verifications', d),
  update:       (id: string | number, d: Partial<VerificationCreate>) => patch<Verification>(`/verifications/${id}`, d),
}

export const eventsApi = {
  list:   (params?: object) => get<{ data: Event[] }>('/events', params).then(r => r.data),
  get:    (id: string | number) => get<Event>(`/events/${id}`),
  create: (d: EventCreate) => post<Event>('/events', d),
  update: (id: string | number, d: Partial<EventCreate>) => patch<Event>(`/events/${id}`, d),
  delete: (id: string | number) => del<void>(`/events/${id}`),
}

export const pipelineApi = {
  stages:           () => get<{ data: PipelineStage[] }>('/pipeline/stages').then(r => r.data),
  getStages:        () => get<{ data: PipelineStage[] }>('/pipeline/stages').then(r => r.data),
  overview:         () => get<{ data: unknown }>('/pipeline/overview').then(r => r.data),
  seed:             () => post<unknown>('/pipeline/init'),
  statuses:         () => get<{ data: ProjectPipelineStatus[] }>('/pipeline/statuses').then(r => r.data),
  getProjectStatus: (projectId: string | number) => get<ProjectPipelineStatus>(`/pipeline/statuses/${projectId}`),
  getSLAAlerts:     () => get<{ data: ProjectPipelineStatus[] }>('/pipeline/sla-alerts').then(r => r.data),
  logs:             (projectId?: string | number) => get<{ data: PipelineLog[] }>('/pipeline/logs', projectId ? { project_id: projectId } : {}).then(r => r.data),
  getHistory:       (projectId: string | number) => get<{ data: PipelineLog[] }>(`/pipeline/logs?project_id=${projectId}`).then(r => r.data),
  move:             (projectId: string | number, d: object) => post<unknown>('/pipeline/move', { project_id: projectId, ...d }),
}

export const analyticsApi = {
  list:    () => get<{ data: AnalyticReport[] }>('/analytics/reports').then(r => r.data),
  summary: () => get<{ data: unknown }>('/analytics').then(r => r.data),
  reports: () => get<{ data: AnalyticReport[] }>('/analytics/reports').then(r => r.data),
  get:     (id: string | number) => get<AnalyticReport>(`/analytics/reports/${id}`),
  create:  (d: AnalyticReportCreate) => post<AnalyticReport>('/analytics/reports', d),
  track:   (d: object) => post<unknown>('/analytics/track', d),
}

export interface UserStats {
  total: number
  active: number
  inactive: number
  verified: number
  by_role?: Record<string, number>
}

export const usersApi = {
  list:           (params?: object) => get<{ users: User[] }>('/admin/users', params).then(r => r.users),
  get:            (id: string) => get<{ user: User }>(`/admin/users/${id}`).then(r => r.user),
  getStats:       () => get<{ totalUsers: number; usersByStatus: Record<string, number>; usersByRole: Record<string, number> }>('/admin/stats').then(r => ({
    total:    r.totalUsers,
    active:   r.usersByStatus?.ACTIVE    ?? 0,
    inactive: (r.usersByStatus?.SUSPENDED ?? 0) + (r.usersByStatus?.DEACTIVATED ?? 0),
    verified: r.totalUsers,
    by_role:  r.usersByRole,
  } as UserStats)),
  create:         (d: object) => post<{ user: User }>('/admin/users', d).then(r => r.user),
  update:         (id: string, d: Partial<User>) => patch<{ user: User }>(`/admin/users/${id}`, d).then(r => r.user),
  delete:         (id: string) => del<void>(`/admin/users/${id}`),
  deactivateUser: (id: string) => patch<{ user: User }>(`/admin/users/${id}`, { status: 'DEACTIVATED' }).then(r => r.user),
  activateUser:   (id: string) => patch<{ user: User }>(`/admin/users/${id}`, { status: 'ACTIVE' }).then(r => r.user),
  verifyUser:     (id: string) => patch<{ user: User }>(`/admin/users/${id}`, { emailVerified: true }).then(r => r.user),
}

export const dataRoomsApi = {
  list:   () => get<DataRoom[]>('/deal-rooms'),
  get:    (id: string | number) => get<DataRoom>(`/deal-rooms/${id}`),
  create: (d: object) => post<DataRoom>('/deal-rooms', d),
  delete: (id: string | number) => del<void>(`/deal-rooms/${id}`),
}

export const dealRoomsApi = {
  list:   () => get<DealRoom[]>('/deal-rooms'),
  get:    (id: string | number) => get<DealRoom>(`/deal-rooms/${id}`),
  create: (d: object) => post<DealRoom>('/deal-rooms', d),
  delete: (id: string | number) => del<void>(`/deal-rooms/${id}`),
}

export const petfelApi = {
  list:             () => get<{ data: PETFELAssessment[] }>('/petfel').then(r => r.data),
  get:              (id: string | number) => get<{ data: PETFELAssessment }>(`/petfel/${id}`).then(r => r.data),
  // Use project-based lookup — PETFEL assessment ID ≠ project ID
  getAssessment:    (projectId: string | number) => get<{ data: PETFELAssessment }>(`/petfel/project/${projectId}`).then(r => r.data),
  getByProject:     (projectId: string | number) => get<{ data: PETFELAssessment }>(`/petfel/project/${projectId}`).then(r => r.data),
  getCriteria:      (projectId?: string | number) => get<{ data: PETFELCriterion[] }>(projectId ? `/petfel/criteria/${projectId}` : '/petfel/criteria').then(r => r.data ?? []),
  assess:           (projectId: string | number, d: object) => post<{ data: PETFELAssessment }>(`/petfel/assess/${projectId}`, d).then(r => r.data),
  createAssessment: (projectId: string | number, d?: object) => post<{ data: PETFELAssessment }>(`/petfel/assess/${projectId}`, d ?? {}).then(r => r.data),
  score:            (assessmentId: string | number, scores: ScoreInput[]) => post<{ data: PETFELAssessment }>(`/petfel/${assessmentId}/scores`, { scores }).then(r => r.data),
  updateScores:     (assessmentId: string | number, scores: ScoreInput[]) => post<{ data: PETFELAssessment }>(`/petfel/${assessmentId}/scores`, { scores }).then(r => r.data),
  calculate:        (assessmentId: string | number) => post<{ data: PETFELAssessment }>(`/petfel/${assessmentId}/calculate`).then(r => r.data),
  submit:           (assessmentId: string | number) => post<{ data: PETFELAssessment }>(`/petfel/${assessmentId}/submit`).then(r => r.data),
}

export const einApi = {
  list:          () => get<{ data: EIN[] }>('/ein').then(r => r.data),
  // Use project-based routes — EINReport.id ≠ project.id
  get:           (projectId: string | number) => get<{ data: EIN }>(`/ein/project/${projectId}`).then(r => r.data),
  getById:       (id: string | number) => get<{ data: EIN }>(`/ein/${id}`).then(r => r.data),
  create:        (projectId: string | number) => post<{ data: EIN }>(`/ein/project/${projectId}`, {}).then(r => r.data),
  update:        (id: string | number, d: Partial<EIN>) => patch<{ data: EIN }>(`/ein/${id}`, d).then(r => r.data),
  updateSection: (einId: string | number, sectionId: string | number, d: Partial<EINSection>) => patch<EINSection>(`/ein/${einId}/sections/${sectionId}`, d),
  updateSummary: (id: string | number, d: Partial<EIN>) => patch<{ data: EIN }>(`/ein/${id}`, d).then(r => r.data),
  validate:      (id: string | number) => post<EIN>(`/ein/${id}/validate`),
  submit:        (id: string | number) => post<{ data: EIN }>(`/ein/${id}/submit`).then(r => r.data),
  approve:       (id: string | number) => post<{ data: EIN }>(`/ein/${id}/approve`).then(r => r.data),
  templates:     () => get<{ data: EINTemplate[] }>('/ein/templates').then(r => r.data ?? []),
  getTemplates:  () => get<{ data: EINTemplate[] }>('/ein/templates').then(r => r.data ?? []),
  generate:      (projectId: string | number) => post<EIN>(`/ein/generate/${projectId}`, {}),
}

export const icApi = {
  list:            () => get<{ data: ICCommittee[] }>('/ic-committees').then(r => r.data),
  committees:      () => get<{ data: ICCommittee[] }>('/ic-committees').then(r => r.data),
  listCommittees:  () => get<{ data: ICCommittee[] }>('/ic-committees').then(r => r.data),
  get:             (id: string | number) => get<ICCommittee>(`/ic-committees/${id}`),
  getCommittee:    (id: string | number) => get<ICCommittee>(`/ic-committees/${id}`),
  create:          (d: object) => post<ICCommittee>('/ic-committees', d),
  createCommittee: (d: object) => post<ICCommittee>('/ic-committees', d),
  vote:            (id: string | number, d: object) => post<ICVote>(`/ic-committees/${id}/vote`, d),
  submitVote:      (id: string | number, vote: string, rationale?: string) => post<ICVote>(`/ic-committees/${id}/vote`, { vote, rationale }),
  recordDecision:  (id: string | number, outcome: string | object) => post<ICCommittee>(`/ic-committees/${id}/decision`, typeof outcome === 'string' ? { outcome } : outcome),
}

export const matchingApi = {
  list: () => get<{ data: unknown[] }>('/matching').then(r => r.data),
  run:  (projectId: string | number) => post<unknown>(`/matching/run/${projectId}`, {}),
  get:  (projectId: string | number) => get<unknown>(`/matching/${projectId}`),
}

export const radarApi = {
  list:    () => get<{ data: unknown[] }>('/radar').then(r => r.data),
  results: () => get<{ data: unknown[] }>('/radar/results').then(r => r.data),
  scan:    () => post<unknown>('/radar/scan', {}),
}

export interface EINGenerated {
  sections?: Record<string, string>
  executive_summary?: string
  recommendation?: string
  key_gaps?: string
  next_steps?: string
  ein?: EIN
}

export const aiApi = {
  analyze:       (d: object) => post<unknown>('/ai/analyze', d),
  generate:      (d: object) => post<unknown>('/ai/generate', d),
  generateEIN:   (d: object) => post<EINGenerated>('/ai/generate-ein', d),
  augmentPETFEL: (d: object) => post<PETFELAssessment>('/ai/augment-petfel', d),
}

export interface Notification {
  id: string
  userId?: string
  type?: string
  title: string
  message: string
  text: string        // alias for message — kept for backward compat
  link?: string | null
  read: boolean
  is_read: boolean    // alias for read — kept for backward compat
  readAt?: string | null
  createdAt: string
  created_at: string  // alias for createdAt — kept for backward compat
}

export const notificationsApi = {
  list: () =>
    api
      .get<{ notifications: Omit<Notification, 'is_read' | 'created_at' | 'text'>[]; unreadCount: number }>('/notifications')
      .then((r) => r.data.notifications.map((n) => ({ ...n, is_read: n.read, created_at: n.createdAt, text: n.message }))),
  markRead:    (id: string) => patch<Notification>(`/notifications/${id}`),
  markAllRead: () => api.patch('/notifications').then((r) => r.data),
}

export default api
