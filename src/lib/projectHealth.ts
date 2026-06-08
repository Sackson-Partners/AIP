// Computes a 0-100 health score from project fields available without extra API calls.
// Score bands: 0-39 = red, 40-69 = yellow, 70-100 = green

const STAGE_SCORE: Record<string, number> = {
  planned: 5,
  'pre-feasibility': 15,
  feasibility: 25,
  procurement: 40,
  construction: 60,
  operational: 80,
};

const PIPELINE_STAGE_SCORE: Record<string, number> = {
  sourcing: 5,
  screening: 8,
  diligence: 12,
  ic: 16,
  execution: 20,
};

const SLA_MODIFIER: Record<string, number> = {
  ok: 0,
  warning: -5,
  breached: -15,
};

interface ProjectHealthInput {
  status?: string | null;
  stage?: string | null;
  sector?: string | null;
  country?: string | null;
  description?: string | null;
  estimated_cost?: number | null;
  capex?: number | null;
  estimated_capex?: number | null;
  pipeline_stage?: string | null;
  sla_status?: string | null;
}

export function projectHealthScore(p: ProjectHealthInput): number {
  let score = 0;

  // Stage maturity (max 80)
  const stageScore = STAGE_SCORE[p.status ?? p.stage ?? ''] ?? 0;
  score += stageScore;

  // Profile completeness (max 20)
  if (p.sector) score += 5;
  if (p.country) score += 5;
  if (p.description) score += 5;
  if (p.estimated_cost ?? p.capex ?? p.estimated_capex) score += 5;

  // Pipeline stage bonus (max 20)
  const pipelineScore = PIPELINE_STAGE_SCORE[p.pipeline_stage ?? ''] ?? 0;
  score += pipelineScore;

  // SLA penalty (max -15)
  const slaPenalty = SLA_MODIFIER[p.sla_status ?? ''] ?? 0;
  score += slaPenalty;

  // Ensure minimum score if any data exists
  if (score === 0 && (p.sector || p.country)) {
    score = 15; // Baseline for projects with minimal data
  }

  return Math.max(0, Math.min(100, score));
}

export function healthScoreColor(score: number): string {
  if (score >= 70) return 'text-green-700 bg-green-100';
  if (score >= 40) return 'text-yellow-700 bg-yellow-100';
  return 'text-red-700 bg-red-100';
}

export function healthScoreLabel(score: number): string {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'Moderate';
  return 'At Risk';
}
