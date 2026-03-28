-- ============================================================
-- AIP Platform — Full Database Schema
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── PROJECTS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name                TEXT NOT NULL,
  sector                      TEXT,
  country                     TEXT,
  region                      TEXT,
  project_type                TEXT,   -- PPP, Greenfield, Brownfield, etc.
  stage                       TEXT DEFAULT 'planned',
  status                      TEXT DEFAULT 'planned',
  description                 TEXT,
  estimated_cost              NUMERIC,
  currency                    TEXT DEFAULT 'USD',
  capex                       NUMERIC,
  funding_gap                 NUMERIC,
  technology                  TEXT,
  revenue_model               TEXT,
  offtaker                    TEXT,
  tariff_mechanism            TEXT,
  fx_exposure                 TEXT,
  concession_length           INTEGER,
  epc_status                  TEXT,
  permits_status              TEXT,
  land_acquisition_status     TEXT,
  timeline_fid                TEXT,
  timeline_cod                TEXT,
  esg_category                TEXT,
  political_risk_mitigation   TEXT,
  sovereign_support           TEXT,
  strategic_notes             TEXT,
  source_url                  TEXT,
  is_verified                 BOOLEAN DEFAULT FALSE,
  is_active                   BOOLEAN DEFAULT TRUE,
  created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_sector   ON public.projects(sector);
CREATE INDEX IF NOT EXISTS idx_projects_country  ON public.projects(country);
CREATE INDEX IF NOT EXISTS idx_projects_status   ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON public.projects FOR SELECT
  USING (
    is_active = TRUE
    OR (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')))
  );

CREATE POLICY "projects_insert" ON public.projects FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi','epc_contractor')
    )
  );

CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  USING (
    created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

CREATE POLICY "projects_delete" ON public.projects FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'super_admin')
  );

-- ─── INVESTORS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_name         TEXT NOT NULL,
  fund_type         TEXT,   -- PE, DFI, Sovereign, Family Office, etc.
  aum               NUMERIC,
  ticket_size_min   NUMERIC NOT NULL DEFAULT 0,
  ticket_size_max   NUMERIC NOT NULL DEFAULT 0,
  target_irr        NUMERIC,
  instruments       TEXT[] DEFAULT '{}',
  sector_focus      TEXT[] DEFAULT '{}',
  country_focus     TEXT[] DEFAULT '{}',
  esg_constraints   TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  website           TEXT,
  linkedin          TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investors_fund_name ON public.investors(fund_name);

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "investors_select" ON public.investors FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi','government','investor')
    )
  );

CREATE POLICY "investors_insert" ON public.investors FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

CREATE POLICY "investors_update" ON public.investors FOR UPDATE
  USING (
    created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

-- ─── PROJECT INFORMATION SHEETS (PIS) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pis (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title             TEXT,
  executive_summary TEXT,
  project_overview  TEXT,
  technical_details TEXT,
  financial_summary TEXT,
  risk_overview     TEXT,
  contact_info      TEXT,
  version           INTEGER DEFAULT 1,
  status            TEXT DEFAULT 'draft',  -- draft, submitted, approved
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pis_project_id ON public.pis(project_id);

ALTER TABLE public.pis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pis_select" ON public.pis FOR SELECT
  USING (
    status = 'approved'
    OR created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

CREATE POLICY "pis_insert" ON public.pis FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi','epc_contractor')
    )
  );

CREATE POLICY "pis_update" ON public.pis FOR UPDATE
  USING (
    created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

-- ─── PESTEL ANALYSES ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pestel_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  overall_score   NUMERIC,
  rating          TEXT,   -- A, B, C, D
  status          TEXT DEFAULT 'draft',  -- draft, submitted, approved
  gating_result   TEXT,
  pillar_scores   JSONB DEFAULT '{}',
  scores          JSONB DEFAULT '[]',
  flags           JSONB DEFAULT '[]',
  notes           TEXT,
  version         INTEGER DEFAULT 1,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pestel_project_id ON public.pestel_analyses(project_id);

ALTER TABLE public.pestel_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pestel_select" ON public.pestel_analyses FOR SELECT
  USING (
    (status = 'approved' AND auth.uid() IN (SELECT id FROM public.profiles WHERE role NOT IN ('epc_contractor')))
    OR created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

CREATE POLICY "pestel_insert" ON public.pestel_analyses FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

CREATE POLICY "pestel_update" ON public.pestel_analyses FOR UPDATE
  USING (
    created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

-- ─── EIN NOTES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ein_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title               TEXT,
  executive_summary   TEXT,
  recommendation      TEXT,   -- go, hold, no_go
  key_gaps            TEXT,
  next_steps          TEXT,
  petfel_score        NUMERIC,
  red_flags_count     INTEGER DEFAULT 0,
  sections            JSONB DEFAULT '[]',
  version             INTEGER DEFAULT 1,
  status              TEXT DEFAULT 'draft',  -- draft, in_review, approved, sent
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ein_project_id ON public.ein_notes(project_id);

ALTER TABLE public.ein_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ein_select" ON public.ein_notes FOR SELECT
  USING (
    (status IN ('approved','sent') AND auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('private_fund','dfi','government','investor')))
    OR created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

CREATE POLICY "ein_insert" ON public.ein_notes FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

-- ─── VERIFICATIONS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.verifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  level               TEXT NOT NULL,  -- L1, L2, L3
  status              TEXT DEFAULT 'pending',  -- pending, in_progress, verified, failed
  technical_score     NUMERIC,
  financial_score     NUMERIC,
  legal_score         NUMERIC,
  esg_score           NUMERIC,
  overall_score       NUMERIC,
  evidence_notes      TEXT,
  risk_flags          JSONB DEFAULT '[]',
  verified_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_project_id ON public.verifications(project_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status     ON public.verifications(status);

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verifications_select" ON public.verifications FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi','government','investor')
    )
  );

CREATE POLICY "verifications_insert" ON public.verifications FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

-- ─── DATA ROOMS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  description   TEXT,
  require_nda   BOOLEAN DEFAULT FALSE,
  access_users  UUID[] DEFAULT '{}',
  documents     JSONB DEFAULT '{}',
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_room_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_room_id  UUID REFERENCES public.data_rooms(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  size          BIGINT,
  mime_type     TEXT,
  uploaded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_rooms_project_id ON public.data_rooms(project_id);

ALTER TABLE public.data_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_rooms_select" ON public.data_rooms FOR SELECT
  USING (
    created_by = auth.uid()
    OR auth.uid() = ANY(access_users)
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

CREATE POLICY "data_rooms_insert" ON public.data_rooms FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi','epc_contractor')
    )
  );

-- ─── DEAL ROOMS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deal_rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  project_id          UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  description         TEXT,
  status              TEXT DEFAULT 'open',  -- open, negotiating, closed, cancelled
  deal_value          NUMERIC,
  deal_currency       TEXT DEFAULT 'USD',
  target_close_date   DATE,
  is_video_enabled    BOOLEAN DEFAULT FALSE,
  is_chat_enabled     BOOLEAN DEFAULT TRUE,
  require_nda         BOOLEAN DEFAULT TRUE,
  participants        UUID[] DEFAULT '{}',
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_rooms_project_id ON public.deal_rooms(project_id);

ALTER TABLE public.deal_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal_rooms_select" ON public.deal_rooms FOR SELECT
  USING (
    created_by = auth.uid()
    OR auth.uid() = ANY(participants)
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi'))
  );

CREATE POLICY "deal_rooms_insert" ON public.deal_rooms FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

-- ─── IC MEETINGS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ic_meetings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT,
  project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status          TEXT DEFAULT 'scheduled',  -- scheduled, in_progress, decided
  meeting_date    TIMESTAMPTZ,
  quorum_required INTEGER DEFAULT 3,
  outcome         TEXT,   -- approved, rejected, deferred
  decision_notes  TEXT,
  members         UUID[] DEFAULT '{}',
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ic_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id    UUID REFERENCES public.ic_meetings(id) ON DELETE CASCADE,
  member_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote          TEXT NOT NULL,  -- approve, reject, abstain, defer
  rationale     TEXT,
  voted_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_meetings_project_id ON public.ic_meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_ic_votes_meeting_id    ON public.ic_votes(meeting_id);

ALTER TABLE public.ic_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_votes    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ic_meetings_select" ON public.ic_meetings FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

CREATE POLICY "ic_meetings_insert" ON public.ic_meetings FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','dfi')
    )
  );

CREATE POLICY "ic_votes_select" ON public.ic_votes FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

CREATE POLICY "ic_votes_insert" ON public.ic_votes FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

-- ─── PIPELINE ITEMS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  "order"     INTEGER NOT NULL,
  description TEXT,
  sla_days    INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.pipeline_stages (name, code, "order", sla_days) VALUES
  ('Sourcing',    'sourcing',    1, 30),
  ('Screening',   'screening',   2, 21),
  ('Diligence',   'diligence',   3, 45),
  ('IC',          'ic',          4, 14),
  ('Execution',   'execution',   5, 90)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pipeline_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id        UUID REFERENCES public.pipeline_stages(id),
  current_stage   TEXT NOT NULL DEFAULT 'sourcing',
  entered_at      TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

CREATE TABLE IF NOT EXISTS public.pipeline_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  from_stage              TEXT,
  to_stage                TEXT NOT NULL,
  notes                   TEXT,
  days_in_previous_stage  INTEGER,
  sla_breached            BOOLEAN DEFAULT FALSE,
  moved_by                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  moved_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_items_project_id ON public.pipeline_items(project_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_project_id  ON public.pipeline_logs(project_id);

ALTER TABLE public.pipeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_logs  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_items_select" ON public.pipeline_items FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi','epc_contractor','government')
    )
  );

CREATE POLICY "pipeline_items_all" ON public.pipeline_items FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

CREATE POLICY "pipeline_logs_select" ON public.pipeline_logs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi','epc_contractor')
    )
  );

-- ─── EVENTS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  event_date          DATE NOT NULL,
  event_time          TIME,
  location            TEXT,
  type                TEXT,   -- conference, webinar, site_visit, ic_meeting
  project_id          UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  projects_involved   UUID[] DEFAULT '{}',
  is_public           BOOLEAN DEFAULT TRUE,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON public.events FOR SELECT
  USING (is_public = TRUE OR auth.uid() IS NOT NULL);

CREATE POLICY "events_insert" ON public.events FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role IN ('super_admin','private_fund','dfi')
    )
  );

-- ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT DEFAULT 'info',  -- info, warning, success, action_required
  entity_type TEXT,                 -- project, investor, ic_meeting, etc.
  entity_id   UUID,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ─── UPDATED_AT TRIGGERS ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects','investors','pis','pestel_analyses','ein_notes',
    'verifications','data_rooms','deal_rooms','ic_meetings',
    'pipeline_items','events'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ─── GRANT USAGE ────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
