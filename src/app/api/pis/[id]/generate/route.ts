import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

// Allow up to 120 seconds for AI generation (requires Vercel Pro/Enterprise plan)
export const maxDuration = 120
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pisReport = await prisma.pISReport.findUnique({
    where: { id },
    include: {
      project: true,
    },
  })
  if (!pisReport) return NextResponse.json({ error: 'PIS report not found' }, { status: 404 })

  const project = pisReport.project

  // Fetch additional context in parallel
  const [petfelResult, einResult] = await Promise.allSettled([
    prisma.pETFELAnalysis.findUnique({ where: { projectId: project.id } }),
    prisma.eINReport.findUnique({ where: { projectId: project.id } }),
  ])

  const petfel = petfelResult.status === 'fulfilled' ? petfelResult.value : null
  const ein    = einResult.status === 'fulfilled'    ? einResult.value    : null

  const prompt = `You are an expert infrastructure investment analyst. Generate a professional Project Information Sheet (PIS) for the following project. Return ONLY valid JSON with no markdown, no code blocks, no additional text.

PROJECT DATA:
- Name: ${project.title ?? 'N/A'}
- Country: ${project.country ?? 'N/A'}
- Region: ${project.region ?? 'N/A'}
- Sector: ${project.sector ?? 'N/A'}
- Project Type: ${project.projectType ?? 'N/A'}
- Deal Stage: ${project.dealStage ?? 'N/A'}
- Total Cost: ${project.totalCost ? `${project.currency ?? 'USD'} ${project.totalCost.toLocaleString()}` : 'N/A'}
- Equity Required: ${project.equityRequired ?? 'N/A'}
- Debt Required: ${project.debtRequired ?? 'N/A'}
- Grant Required: ${project.grantRequired ?? 'N/A'}
- Expected Close: ${project.expectedClose ?? 'N/A'}
- Risk Rating: ${project.riskRating ?? 'N/A'}
- ESG Rating: ${project.esgRating ?? 'N/A'}
- Description: ${project.description ?? 'N/A'}
${petfel ? `- PETFEL Score: ${petfel.overallScore ?? 'N/A'}` : ''}
${ein ? `- EIN Project Summary: ${ein.projectSummary ?? 'N/A'}` : ''}

Generate detailed, professional content for each section. Each section should be 2-4 paragraphs of substantive analysis appropriate for institutional investors.

Return JSON with exactly these keys:
{
  "executiveSummary": "...",
  "projectBackground": "...",
  "financialStructure": "...",
  "marketAnalysis": "...",
  "riskFactors": "...",
  "investmentHighlights": "..."
}`

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[PIS generate] ANTHROPIC_API_KEY not configured')
    return NextResponse.json({ error: 'AI service not configured. Please contact administrator.' }, { status: 503 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let generated: {
    executiveSummary?: string
    projectBackground?: string
    financialStructure?: string
    marketAnalysis?: string
    riskFactors?: string
    investmentHighlights?: string
  } = {}

  try {
    console.log(`[PIS generate] Starting AI generation for PIS ${id}`)
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    console.log(`[PIS generate] Received ${text.length} chars from AI`)

    // Try to parse JSON, handle potential markdown code blocks
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '')
    }

    generated = JSON.parse(jsonText)
    console.log(`[PIS generate] Successfully parsed JSON response`)
  } catch (err) {
    console.error('[PIS generate] AI generation failed:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({
      error: 'AI generation failed',
      details: errorMessage
    }, { status: 500 })
  }

  const updated = await prisma.pISReport.update({
    where: { id },
    data: {
      executiveSummary:    generated.executiveSummary    ?? pisReport.executiveSummary,
      projectBackground:   generated.projectBackground   ?? pisReport.projectBackground,
      financialStructure:  generated.financialStructure  ?? pisReport.financialStructure,
      marketAnalysis:      generated.marketAnalysis      ?? pisReport.marketAnalysis,
      riskFactors:         generated.riskFactors         ?? pisReport.riskFactors,
      investmentHighlights: generated.investmentHighlights ?? pisReport.investmentHighlights,
      aiGenerated:         true,
      generatedAt:         new Date(),
    },
    include: {
      project: { select: { id: true, title: true, country: true, sector: true, dealStage: true, totalCost: true } },
    },
  })

  const data = {
    id: updated.id,
    project_id: updated.projectId,
    project_title: updated.project.title,
    project_country: updated.project.country,
    project_sector: updated.project.sector,
    status: updated.status,
    executive_summary: updated.executiveSummary,
    project_background: updated.projectBackground,
    financial_structure: updated.financialStructure,
    market_analysis: updated.marketAnalysis,
    risk_factors: updated.riskFactors,
    investment_highlights: updated.investmentHighlights,
    use_of_proceeds: updated.useOfProceeds,
    exit_strategy: updated.exitStrategy,
    team_background: updated.teamBackground,
    legal_structure: updated.legalStructure,
    ai_generated: updated.aiGenerated,
    generated_at: updated.generatedAt,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  }

  return NextResponse.json({ data })
}
