/**
 * Partner–Project matching engine
 *
 * Weighted scoring algorithm:
 *   Sector alignment     30 pts
 *   Country match        25 pts
 *   Deal stage match     20 pts
 *   Ticket size fit      15 pts
 *   Partner type fit     10 pts
 *   ──────────────────── ─────
 *   Total               100 pts
 */

export interface PartnerProfile {
  id: string
  sectorFocus:      string[]   // e.g. ["ENERGY","TRANSPORT"]
  countryFocus:     string[]   // e.g. ["Kenya","Nigeria","Global"]
  stageFocus:       string[]   // e.g. ["CONCEPT","FEASIBILITY"]
  minTicket:        number | null
  maxTicket:        number | null
  organizationType: string | null  // EPC | SPONSOR | INVESTOR | GOVERNMENT | DFI
}

export interface ProjectProfile {
  id: string
  sector:      string | null
  country:     string | null
  dealStage:   string | null
  totalCost:   number | null
  projectType: string | null  // PPP | BOT | IPP ...
}

export interface MatchResult {
  projectId:  string
  score:      number   // 0-100
  breakdown:  {
    sector:    number
    country:   number
    stage:     number
    ticket:    number
    partnerType: number
  }
  reasons: string[]
}

const SECTOR_SCORE = 30
const COUNTRY_SCORE = 25
const STAGE_SCORE = 20
const TICKET_SCORE = 15
const TYPE_SCORE = 10

// Project types that suit each partner org type
const TYPE_AFFINITY: Record<string, string[]> = {
  EPC:        ['BOT', 'BOO', 'DBFOM', 'SERVICE_CONTRACT'],
  SPONSOR:    ['IPP', 'BOT', 'CONCESSION', 'PPP'],
  INVESTOR:   ['IPP', 'PPP', 'BOT', 'CONCESSION'],
  GOVERNMENT: ['PPP', 'CONCESSION'],
  DFI:        ['PPP', 'IPP', 'BOT', 'CONCESSION'],
}

function parseJson(s: string | null | undefined): string[] {
  if (!s) return []
  try { return JSON.parse(s) as string[] } catch { return [] }
}

export function scoreMatch(partner: PartnerProfile, project: ProjectProfile): MatchResult {
  const reasons: string[] = []
  const breakdown = { sector: 0, country: 0, stage: 0, ticket: 0, partnerType: 0 }

  // ── Sector ────────────────────────────────────────────────────────────────
  if (partner.sectorFocus.length === 0) {
    breakdown.sector = SECTOR_SCORE * 0.5   // neutral — no preference
    reasons.push('No sector preference (partial score)')
  } else if (project.sector && partner.sectorFocus.includes(project.sector)) {
    breakdown.sector = SECTOR_SCORE
    reasons.push(`Sector match: ${project.sector}`)
  }

  // ── Country ───────────────────────────────────────────────────────────────
  if (partner.countryFocus.length === 0) {
    breakdown.country = COUNTRY_SCORE * 0.5
  } else if (
    partner.countryFocus.some(c => c === 'Global') ||
    (project.country && partner.countryFocus.some(c =>
      c.toLowerCase() === project.country!.toLowerCase()
    ))
  ) {
    breakdown.country = COUNTRY_SCORE
    reasons.push(`Country match: ${project.country ?? 'Global'}`)
  }

  // ── Deal Stage ────────────────────────────────────────────────────────────
  if (partner.stageFocus.length === 0) {
    breakdown.stage = STAGE_SCORE * 0.5
  } else if (project.dealStage && partner.stageFocus.includes(project.dealStage)) {
    breakdown.stage = STAGE_SCORE
    reasons.push(`Stage match: ${project.dealStage}`)
  }

  // ── Ticket Size ───────────────────────────────────────────────────────────
  const cost = project.totalCost
  if (!cost || (partner.minTicket === null && partner.maxTicket === null)) {
    breakdown.ticket = TICKET_SCORE * 0.5
  } else {
    const min = partner.minTicket ?? 0
    const max = partner.maxTicket ?? Infinity
    if (cost >= min && cost <= max) {
      breakdown.ticket = TICKET_SCORE
      reasons.push('Project size within ticket range')
    } else if (cost >= min * 0.5 && cost <= max * 2) {
      // Partial: within 50%–200% of range
      breakdown.ticket = TICKET_SCORE * 0.5
    }
  }

  // ── Partner Type fit ──────────────────────────────────────────────────────
  const pType = partner.organizationType
  if (!pType || !project.projectType) {
    breakdown.partnerType = TYPE_SCORE * 0.5
  } else {
    const affinities = TYPE_AFFINITY[pType] ?? []
    if (affinities.includes(project.projectType)) {
      breakdown.partnerType = TYPE_SCORE
      reasons.push(`${pType} suited for ${project.projectType}`)
    }
  }

  const score = Math.round(
    breakdown.sector + breakdown.country + breakdown.stage +
    breakdown.ticket + breakdown.partnerType
  )

  return { projectId: project.id, score, breakdown, reasons }
}

export function buildPartnerProfile(inv: {
  id: string
  sectorFocus:      string | null
  countryFocus:     string | null
  stageFocus:       string | null
  minTicket:        number | null
  maxTicket:        number | null
  organizationType: string | null
}): PartnerProfile {
  return {
    id:               inv.id,
    sectorFocus:      parseJson(inv.sectorFocus),
    countryFocus:     parseJson(inv.countryFocus),
    stageFocus:       parseJson(inv.stageFocus),
    minTicket:        inv.minTicket,
    maxTicket:        inv.maxTicket,
    organizationType: inv.organizationType,
  }
}

/** Compute 0–100 profile completeness score for an Investor record */
export function profileCompleteness(inv: Record<string, unknown>): number {
  const fields: Array<[string, number]> = [
    ['name',             10],
    ['email',            10],
    ['organizationType', 10],
    ['countryOfOrigin',   5],
    ['sectorFocus',      15],
    ['countryFocus',     15],
    ['stageFocus',        5],
    ['minTicket',         5],
    ['maxTicket',         5],
    ['instruments',       5],
    ['description',       5],
    ['website',           5],
    ['targetIRR',         5],
  ]
  let score = 0
  for (const [field, weight] of fields) {
    const val = inv[field]
    if (val !== null && val !== undefined && val !== '' && val !== '[]') {
      score += weight
    }
  }
  return Math.min(100, score)
}
