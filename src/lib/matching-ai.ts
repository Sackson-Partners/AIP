import Anthropic from '@anthropic-ai/sdk'
import { MatchResult, PartnerProfile, ProjectProfile } from './matching'

export interface MatchWithProject {
  match: MatchResult
  project: ProjectProfile & { title: string }
  partner: PartnerProfile & { name: string; organizationType: string | null }
}

/**
 * Generate human-readable match explanation using Claude
 * @param data Match result with project and partner details
 * @returns AI-generated explanation string
 */
export async function generateMatchExplanation(
  data: MatchWithProject
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackExplanation(data)
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `You are an infrastructure investment analyst. Generate a concise 2-3 sentence explanation for why this investor-project match scored ${data.match.score}/100 (${data.match.matchTier || 'MODERATE'} tier).

Investor: ${data.partner.name}
- Type: ${data.partner.organizationType || 'Not specified'}
- Sector focus: ${data.partner.sectorFocus.join(', ') || 'None specified'}
- Country focus: ${data.partner.countryFocus.join(', ') || 'Global'}
- Stage focus: ${data.partner.stageFocus.join(', ') || 'All stages'}
- Ticket range: $${data.partner.minTicket?.toLocaleString() || '0'} - $${data.partner.maxTicket?.toLocaleString() || 'unlimited'}

Project: ${data.project.title}
- Sector: ${data.project.sector || 'Not specified'}
- Country: ${data.project.country || 'Not specified'}
- Stage: ${data.project.dealStage || 'Not specified'}
- Cost: $${data.project.totalCost?.toLocaleString() || 'Not specified'}
- Type: ${data.project.projectType || 'Not specified'}
- Risk: ${data.project.riskRating || 'Not specified'}

Score breakdown:
- Sector: ${data.match.breakdown.sector} pts
- Country: ${data.match.breakdown.country} pts
- Stage: ${data.match.breakdown.stage} pts
- Ticket: ${data.match.breakdown.ticket} pts
- Partner type: ${data.match.breakdown.partnerType} pts
- Risk: ${data.match.breakdown.risk} pts

Write a professional explanation focusing on: (1) strongest alignment factors, (2) any gaps or partial matches, (3) overall strategic fit. Keep it under 100 words.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text
      : fallbackExplanation(data)

    return text.trim()
  } catch (error) {
    console.error('[generateMatchExplanation] AI call failed:', error)
    return fallbackExplanation(data)
  }
}

/**
 * Fallback explanation generator (used when AI is unavailable)
 */
function fallbackExplanation(data: MatchWithProject): string {
  const { match, project, partner } = data
  const tier = match.matchTier || 'MODERATE'
  const reasons = match.reasons.slice(0, 3).join('; ')

  if (tier === 'EXCELLENT') {
    return `Strong alignment: ${reasons}. ${partner.name} is well-positioned for ${project.title} given matching sector, geography, and investment criteria.`
  }

  if (tier === 'STRONG') {
    return `Good fit: ${reasons}. ${partner.name} shows strong compatibility with ${project.title}, though some criteria are partially aligned.`
  }

  return `Moderate fit: ${reasons}. ${partner.name} may be interested in ${project.title}, but alignment is partial across key investment criteria.`
}
