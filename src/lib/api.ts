import axios from 'axios';
import { supabase } from '@/lib/supabase';
import { getMsalInstance, acquireAccessToken } from '@/lib/azure-auth';

// ============================================================================
// Auth Provider Configuration
// ============================================================================

export type AuthProvider = 'supabase' | 'azure_b2c';

// Set via environment variable: NEXT_PUBLIC_AUTH_PROVIDER=azure_b2c
const AUTH_PROVIDER: AuthProvider = (process.env.NEXT_PUBLIC_AUTH_PROVIDER as AuthProvider) || 'supabase';

// ============================================================================
// API URL Configuration
// ============================================================================

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }
  // Default for production (Azure Container App)
  return 'https://aip-api.politesea-b4c1d412.southafricanorth.azurecontainerapps.io';
};

const API_BASE_URL = getApiUrl();

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================================
// Token Acquisition Functions
// ============================================================================

async function getSupabaseToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function getAzureB2CToken(): Promise<string | null> {
  try {
    const msalInstance = getMsalInstance();
    if (!msalInstance) return null;
    return await acquireAccessToken(msalInstance);
  } catch {
    return null;
  }
}

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  if (AUTH_PROVIDER === 'azure_b2c') {
    return getAzureB2CToken();
  }
  return getSupabaseToken();
}

// ============================================================================
// Request Interceptor - Add Auth Token
// ============================================================================

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ============================================================================
// Response Interceptor - Handle Auth Errors
// ============================================================================

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        if (AUTH_PROVIDER === 'azure_b2c') {
          // Azure AD B2C: Let MSAL handle token refresh
          // The AzureAuthContext will trigger re-auth if needed
          console.warn('Azure AD B2C token expired or invalid');
        } else {
          // Supabase: Check if session is missing
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            await supabase.auth.signOut();
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// Export auth provider for conditional logic elsewhere
export { AUTH_PROVIDER };

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email); // Backend expects email in username field
    formData.append('password', password);
    const response = await api.post('/auth/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },
  register: async (email: string, password: string, full_name: string, phone?: string) => {
    const response = await api.post('/auth/register', { email, password, full_name, phone });
    return response.data;
  },
};

// Projects API
export const projectsApi = {
  list: async (params?: { sector?: string; country?: string; status?: string; region?: string }) => {
    const response = await api.get('/projects', { params });
    return response.data;
  },
  get: async (id: string) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },
  create: async (project: ProjectCreate) => {
    const response = await api.post('/projects', project);
    return response.data;
  },
  update: async (id: string, project: Partial<ProjectCreate>) => {
    const response = await api.put(`/projects/${id}`, project);
    return response.data;
  },
  delete: async (id: string) => {
    await api.delete(`/projects/${id}`);
  },
};

// Investors API
export const investorsApi = {
  list: async () => {
    const response = await api.get('/investors/');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/investors/${id}`);
    return response.data;
  },
  create: async (investor: InvestorCreate) => {
    const response = await api.post('/investors/', investor);
    return response.data;
  },
  match: async (investorId: number) => {
    const response = await api.get(`/investors/${investorId}/match`);
    return response.data;
  },
};

// Verifications API
export const verificationsApi = {
  list: async () => {
    const response = await api.get('/verifications/');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/verifications/${id}`);
    return response.data;
  },
  create: async (verification: VerificationCreate) => {
    const response = await api.post('/verifications/', verification);
    return response.data;
  },
  getByProject: async (projectId: number) => {
    const response = await api.get(`/verifications/project/${projectId}`);
    return response.data;
  },
};

// Introductions API
export const introductionsApi = {
  list: async () => {
    const response = await api.get('/introductions/');
    return response.data;
  },
  create: async (introduction: IntroductionCreate) => {
    const response = await api.post('/introductions/', introduction);
    return response.data;
  },
  updateStatus: async (id: number, status: string) => {
    const response = await api.patch(`/introductions/${id}/status`, { status });
    return response.data;
  },
};

// Data Rooms API
export const dataRoomsApi = {
  list: async () => {
    const response = await api.get('/data-rooms/');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/data-rooms/${id}`);
    return response.data;
  },
  create: async (dataRoom: DataRoomCreate) => {
    const response = await api.post('/data-rooms/', dataRoom);
    return response.data;
  },
};

// Deal Rooms API
export const dealRoomsApi = {
  list: async () => {
    const response = await api.get('/deal-rooms/');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/deal-rooms/${id}`);
    return response.data;
  },
  create: async (dealRoom: DealRoomCreateInput) => {
    const response = await api.post('/deal-rooms/', dealRoom);
    return response.data;
  },
};

// Analytics API
export const analyticsApi = {
  list: async () => {
    const response = await api.get('/analytics/');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/analytics/${id}`);
    return response.data;
  },
  create: async (report: AnalyticReportCreate) => {
    const response = await api.post('/analytics/', report);
    return response.data;
  },
};

// Events API
export const eventsApi = {
  list: async () => {
    const response = await api.get('/events/');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },
  create: async (event: EventCreate) => {
    const response = await api.post('/events/', event);
    return response.data;
  },
};

// Types
export interface ProjectCreate {
  project_name: string;
  country?: string;
  region?: string;
  sector?: string;
  project_type?: string;
  estimated_cost?: string;
  status?: string;
  description?: string;
  strategic_notes?: string;
  latitude?: number;
  longitude?: number;
  source_url?: string;
}

export interface Project extends ProjectCreate {
  id: string;
  has_ai_brief: boolean;
  name?: string;
  stage?: string;
  estimated_capex?: number;
  funding_gap?: number;
  committee_id?: string;
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
  created_at?: string;
  updated_at?: string;
  airtable_record_id?: string;
  investors?: string;
  developers?: string;
  source_url?: string;
  ai_brief?: string;
  project_type?: string;
  estimated_cost?: string;
}

export interface InvestorCreate {
  fund_name: string;
  aum?: number;
  ticket_size_min: number;
  ticket_size_max: number;
  instruments: string[];
  target_irr?: number;
  country_focus: string[];
  sector_focus: string[];
  esg_constraints?: string;
}

export interface Investor extends InvestorCreate {
  id: number;
}

export interface VerificationCreate {
  project_id: number;
  level: string;
  bankability?: {
    technical_readiness: number;
    financial_robustness: number;
    legal_clarity: number;
    esg_compliance: number;
    overall_score: number;
    risk_flags: string[];
    last_verified: string;
  };
}

export interface Verification extends VerificationCreate {
  id: number;
}

export interface IntroductionCreate {
  investor_id: number;
  project_id: number;
  message?: string;
  nda_executed?: boolean;
  sponsor_approved?: boolean;
  status?: string;
}

export interface Introduction extends IntroductionCreate {
  id: number;
}

export interface DataRoomCreate {
  project_id: number;
  name: string;
  description?: string;
  require_nda?: boolean;
  require_verification?: boolean;
  min_verification_level?: string;
  enable_watermark?: boolean;
  allow_download?: boolean;
  allow_print?: boolean;
}

export interface DataRoom extends DataRoomCreate {
  id: number;
  created_at: string;
  status?: string;
  documents?: Record<string, unknown>;
  access_users?: string[];
}

export interface DealRoomCreateInput {
  project_id: number;
  name: string;
  description?: string;
  deal_value?: number | null;
  deal_currency?: string;
  target_close_date?: string | null;
  is_video_enabled?: boolean;
  is_chat_enabled?: boolean;
  require_nda?: boolean;
}

export interface AnalyticReportCreate {
  title: string;
  sector?: string;
  country?: string;
  content: string;
}

export interface AnalyticReport extends AnalyticReportCreate {
  id: number;
  created_at: string;
}

export interface EventCreate {
  name: string;
  description: string;
  event_date: string;
  type: string;
  projects_involved?: number[];
}

export interface Event extends EventCreate {
  id: number;
}

// ============================================================================
// PETFEL Types & API
// ============================================================================

export interface PETFELCriterion {
  pillar: string;
  code: string;
  name: string;
  weight: number;
}

export interface PETFELScore {
  id: number;
  pillar: string;
  sub_criterion: string;
  score: number;
  evidence_notes?: string;
  mitigation?: string;
  owner?: string;
}

export interface PETFELFlag {
  id: number;
  flag_type: string;
  pillar: string;
  description: string;
  is_resolved: boolean;
}

export interface PETFELAssessment {
  id: number;
  project_id: number;
  version: number;
  status: string;
  overall_score?: number;
  rating?: string;
  gating_result?: string;
  recommendation?: string;
  pillar_scores?: Record<string, number>;
  scores: PETFELScore[];
  flags: PETFELFlag[];
  created_at: string;
  assessed_at?: string;
}

export interface ScoreInput {
  pillar: string;
  sub_criterion: string;
  score: number;
  evidence_notes?: string;
  mitigation?: string;
  owner?: string;
}

export const petfelApi = {
  getCriteria: async (): Promise<Record<string, PETFELCriterion[]>> => {
    const response = await api.get('/petfel/criteria');
    return response.data;
  },
  createAssessment: async (projectId: number | string): Promise<PETFELAssessment> => {
    const response = await api.post(`/petfel/assess/${projectId}`);
    return response.data;
  },
  getAssessment: async (projectId: number | string): Promise<PETFELAssessment> => {
    const response = await api.get(`/petfel/${projectId}`);
    return response.data;
  },
  getAssessmentById: async (assessmentId: number): Promise<PETFELAssessment> => {
    const response = await api.get(`/petfel/assessment/${assessmentId}`);
    return response.data;
  },
  updateScores: async (assessmentId: number, scores: ScoreInput[]): Promise<PETFELAssessment> => {
    const response = await api.post(`/petfel/${assessmentId}/score`, { scores });
    return response.data;
  },
  calculate: async (assessmentId: number): Promise<PETFELAssessment> => {
    const response = await api.post(`/petfel/${assessmentId}/calculate`);
    return response.data;
  },
  submit: async (assessmentId: number): Promise<PETFELAssessment> => {
    const response = await api.post(`/petfel/${assessmentId}/submit`);
    return response.data;
  },
  listAssessments: async (projectId?: number): Promise<PETFELAssessment[]> => {
    const params = projectId ? { project_id: projectId } : {};
    const response = await api.get('/petfel/assessments', { params });
    return response.data;
  },
};

// ============================================================================
// EIN (Executive Investment Note) Types & API
// ============================================================================

export interface EINSection {
  id: number;
  section_code: number;
  section_name: string;
  content?: string;
  generated_by?: string;
  is_reviewed: boolean;
  updated_at: string;
}

export interface EIN {
  id: number;
  project_id: number;
  title?: string;
  version: number;
  status: string;
  author_id?: number;
  executive_summary?: string;
  recommendation?: string;
  key_gaps?: string;
  next_steps?: string;
  petfel_assessment_id?: number;
  petfel_score?: number;
  red_flags_count: number;
  export_ready: boolean;
  sections: EINSection[];
  created_at: string;
  updated_at: string;
  approved_at?: string;
  sent_at?: string;
}

export interface EINTemplate {
  code: number;
  name: string;
  objective: string;
  key_questions: string[];
  output_guidance: string;
}

export const einApi = {
  getTemplates: async (): Promise<EINTemplate[]> => {
    const response = await api.get('/ein/templates');
    return response.data;
  },
  create: async (projectId: number, petfelAssessmentId?: number): Promise<EIN> => {
    const response = await api.post(`/ein/${projectId}`, {
      project_id: projectId,
      petfel_assessment_id: petfelAssessmentId,
    });
    return response.data;
  },
  get: async (projectId: number | string): Promise<EIN> => {
    const response = await api.get(`/ein/${projectId}`);
    return response.data;
  },
  getById: async (einId: number): Promise<EIN> => {
    const response = await api.get(`/ein/note/${einId}`);
    return response.data;
  },
  getApproved: async (projectId: number | string): Promise<EIN> => {
    const response = await api.get(`/ein/${projectId}/approved`);
    return response.data;
  },
  updateSection: async (einId: number, sectionCode: number, content: string, generatedBy: string = 'analyst'): Promise<EINSection> => {
    const response = await api.put(`/ein/${einId}/section/${sectionCode}`, {
      content,
      generated_by: generatedBy,
    });
    return response.data;
  },
  reviewSection: async (einId: number, sectionCode: number): Promise<EINSection> => {
    const response = await api.post(`/ein/${einId}/section/${sectionCode}/review`);
    return response.data;
  },
  updateSummary: async (einId: number, data: {
    executive_summary: string;
    recommendation: string;
    key_gaps?: string;
    next_steps?: string;
  }): Promise<EIN> => {
    const response = await api.put(`/ein/${einId}/summary`, data);
    return response.data;
  },
  submit: async (einId: number): Promise<EIN> => {
    const response = await api.post(`/ein/${einId}/submit`);
    return response.data;
  },
  approve: async (einId: number): Promise<EIN> => {
    const response = await api.post(`/ein/${einId}/approve`);
    return response.data;
  },
  markSent: async (einId: number): Promise<EIN> => {
    const response = await api.post(`/ein/${einId}/send`);
    return response.data;
  },
  validate: async (einId: number): Promise<{ is_valid: boolean; issues: string[] }> => {
    const response = await api.get(`/ein/${einId}/validate`);
    return response.data;
  },
};

// ============================================================================
// AI Intelligence API
// ============================================================================

export interface AIAnalysisResult {
  project_id: number;
  analysis_type: string;
  content: string;
  confidence_score?: number;
  sources?: string[];
  created_at: string;
}

export interface AIEINDraft {
  ein_draft: string;
  sections: Record<number, string>;
  executive_summary: string;
  recommendation: string;
}

export const aiApi = {
  analyzeProject: async (projectId: number | string): Promise<AIAnalysisResult> => {
    const response = await api.post(`/ai/analyze/${projectId}`);
    return response.data;
  },
  generateEIN: async (projectId: number | string): Promise<AIEINDraft> => {
    const response = await api.post(`/ai/generate-ein/${projectId}`);
    return response.data;
  },
  augmentPETFEL: async (assessmentId: number): Promise<{ augmented_scores: ScoreInput[]; suggestions: string[] }> => {
    const response = await api.post(`/ai/petfel-augment/${assessmentId}`);
    return response.data;
  },
  countryRisk: async (country: string): Promise<{ country: string; risk_brief: string; risk_factors: Record<string, string> }> => {
    const response = await api.post(`/ai/country-risk/${country}`);
    return response.data;
  },
  runMatching: async (projectId: number | string): Promise<{ matches: { investor_id: number; score: number; rationale: string }[] }> => {
    const response = await api.post(`/ai/matching/run/${projectId}`);
    return response.data;
  },
};

// ============================================================================
// Pipeline Management API
// ============================================================================

export interface PipelineStage {
  id: number;
  name: string;
  code: string;
  order_index: number;
  sla_days?: number;
  description?: string;
}

export interface PipelineLog {
  id: number;
  project_id: number;
  from_stage?: string;
  to_stage: string;
  changed_by: number;
  timestamp: string;
  notes?: string;
  days_in_previous_stage?: number;
  sla_breached: boolean;
}

export interface ProjectPipelineStatus {
  project_id: number;
  project_name: string;
  current_stage: string;
  entered_at: string;
  days_in_stage: number;
  sla_days?: number;
  sla_status: string;
  sla_remaining?: number;
}

export const pipelineApi = {
  getStages: async (): Promise<PipelineStage[]> => {
    const response = await api.get('/pipeline/stages');
    return response.data;
  },
  move: async (projectId: number, toStage: string, notes?: string): Promise<PipelineLog> => {
    const response = await api.post('/pipeline/move', {
      project_id: projectId,
      to_stage: toStage,
      notes,
    });
    return response.data;
  },
  getHistory: async (projectId: number | string): Promise<PipelineLog[]> => {
    const response = await api.get(`/pipeline/history/${projectId}`);
    return response.data;
  },
  getProjectStatus: async (projectId: number | string): Promise<ProjectPipelineStatus> => {
    const response = await api.get(`/pipeline/project/${projectId}`);
    return response.data;
  },
  getOverview: async () => {
    const response = await api.get('/pipeline/overview');
    return response.data;
  },
  getSLAAlerts: async (): Promise<ProjectPipelineStatus[]> => {
    const response = await api.get('/pipeline/sla-alerts');
    return response.data;
  },
};

// ============================================================================
// Investment Committee (IC) API
// ============================================================================

export interface ICCommittee {
  committee_id?: string;  // alias for id
  id: number;
  project_id: number;
  ein_id?: number;
  scheduled_date: string;
  meeting_type: string;
  status: string;
  decision?: string;
  decision_notes?: string;
  quorum_required: number;
  quorum_met: boolean;
  vote_count: number;
  approve_count: number;
  reject_count: number;
  defer_count: number;
  created_at: string;
  completed_at?: string;
  votes: ICVote[];
}

export interface ICVote {
  id: number;
  committee_id: number;
  voter_id: number;
  vote: string;
  rationale?: string;
  conditions?: string;
  voted_at: string;
}

export const icApi = {
  createCommittee: async (data: {
    project_id: number;
    ein_id?: number;
    scheduled_date: string;
    meeting_type?: string;
    quorum_required?: number;
  }): Promise<ICCommittee> => {
    const response = await api.post('/ic/committees', data);
    return response.data;
  },
  listCommittees: async (status?: string): Promise<ICCommittee[]> => {
    const params = status ? { status_filter: status } : {};
    const response = await api.get('/ic/committees', { params });
    return response.data;
  },
  getCommittee: async (committeeId: number): Promise<ICCommittee> => {
    const response = await api.get(`/ic/committees/${committeeId}`);
    return response.data;
  },
  startMeeting: async (committeeId: number): Promise<ICCommittee> => {
    const response = await api.post(`/ic/committees/${committeeId}/start`);
    return response.data;
  },
  submitVote: async (committeeId: number, vote: string, rationale?: string, conditions?: string): Promise<ICVote> => {
    const response = await api.post(`/ic/committees/${committeeId}/vote`, {
      vote,
      rationale,
      conditions,
    });
    return response.data;
  },
  getVotes: async (committeeId: number): Promise<ICVote[]> => {
    const response = await api.get(`/ic/committees/${committeeId}/votes`);
    return response.data;
  },
  completeMeeting: async (committeeId: number, decision: string, decisionNotes?: string): Promise<ICCommittee> => {
    const response = await api.post(`/ic/committees/${committeeId}/complete`, {
      decision,
      decision_notes: decisionNotes,
    });
    return response.data;
  },
  cancelMeeting: async (committeeId: number): Promise<ICCommittee> => {
    const response = await api.post(`/ic/committees/${committeeId}/cancel`);
    return response.data;
  },
  getProjectHistory: async (projectId: number) => {
    const response = await api.get(`/ic/projects/${projectId}/history`);
    return response.data;
  },
  // Record final IC decision (approve / reject / defer)
  recordDecision: async (committeeId: number | string, outcome: string, outcome_notes?: string) => {
    const response = await api.post(`/ic/committees/${committeeId}/decide`, { outcome, outcome_notes });
    return response.data;
  },
};

// ============================================================================
// User Roles & Profile
// ============================================================================

export type UserRole = 'admin' | 'project_manager' | 'analyst' | 'investor' | 'viewer';

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  organization?: string;
  created_at: string;
}

export const usersApi = {
  getProfile: async (): Promise<UserProfile> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  updateProfile: async (data: Partial<UserProfile>): Promise<UserProfile> => {
    const response = await api.put('/auth/me', data);
    return response.data;
  },
  // Admin user management — backed by /api/users
  listUsers: async (params?: { role?: string; search?: string }): Promise<UserProfile[]> => {
    const response = await api.get('/users', { params });
    return response.data;
  },
  getUser: async (id: string): Promise<UserProfile> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  createUser: async (data: {
    email: string;
    password: string;
    full_name?: string;
    organisation?: string;
    role?: string;
  }): Promise<UserProfile> => {
    const response = await api.post('/users', data);
    return response.data;
  },
  updateUser: async (id: string, data: Partial<UserProfile>): Promise<UserProfile> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },
  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
  activateUser: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/users/${id}/activate`);
    return response.data;
  },
  deactivateUser: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/users/${id}/deactivate`);
    return response.data;
  },
  verifyUser: async (id: string): Promise<{ message: string }> => {
    const response = await api.post(`/users/${id}/verify`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/users/stats/summary');
    return response.data;
  },
};

export default api;
