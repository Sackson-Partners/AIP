import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'

export const maxDuration = 60 // seconds — AI calls need more than the 10s default

// Map AI section codes → EINReport Prisma fields
const SECTION_FIELD_MAP: Record<string, string> = {
  '1': 'projectSummary',
  '3': 'marketAnalysis',
  '4': 'financialSummary',
  '6': 'riskSummary',
  '8': 'comparables',
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const projectId = body.project_id as string
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: { petfelAnalysis: true },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const petfel = project.petfelAnalysis

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are a senior infrastructure investment analyst at an African infrastructure fund. Generate concise EIN sections (2-3 sentences each) for the following project.

Project: ${project.title}
Country: ${project.country ?? 'Africa'}
Sector: ${project.sector ?? 'Infrastructure'}
Deal Stage: ${project.dealStage ?? 'FEASIBILITY'}
Total Cost: ${project.totalCost ? `USD ${project.totalCost.toLocaleString()}` : 'Not specified'}
Description: ${project.description ?? 'No description provided'}
${petfel ? `PETFEL Score: ${petfel.overallScore?.toFixed(1) ?? 'N/A'} / 5.0 (${petfel.rating ?? 'unrated'})
Risk Factors: ${petfel.riskFactors ?? 'None noted'}
Mitigants: ${petfel.mitigants ?? 'None noted'}` : ''}

Respond ONLY with valid JSON (no markdown):
{
  "sections": {
    "1": "<Strategy Perspective — 2-3 sentences>",
    "2": "<Political Perspective — 2-3 sentences>",
    "3": "<Economic Perspective — 2-3 sentences>",
    "4": "<Financial Perspective — 2-3 sentences>",
    "5": "<Legal & Regulatory — 2-3 sentences>",
    "6": "<Top 3 risks with mitigants>",
    "7": "<Next steps: 30/60/90 day>",
    "8": "<Required annexes list>"
  },
  "executive_summary": "<2 sentence summary>",
  "recommendation": "go|hold|no_go",
  "key_gaps": "<top 3 gaps>",
  "next_steps": "<top 3 actions>"
}`

  let message
  try {
    message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate-ein] Anthropic API error:', msg)
    return NextResponse.json({ error: 'AI service error', detail: msg }, { status: 502 })
  }

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  let result: Record<string, unknown>
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    result = JSON.parse(cleaned)
  } catch {
    console.error('[generate-ein] JSON parse failed, raw:', text.slice(0, 300))
    return NextResponse.json({ error: 'AI response was not valid JSON', raw: text.slice(0, 300) }, { status: 502 })
  }

  // Save AI content to EINReport (upsert so it works with or without existing report)
  const sections = result.sections as Record<string, string> | undefined
  const dbFields: Record<string, string> = {}
  if (sections) {
    for (const [code, content] of Object.entries(sections)) {
      const field = SECTION_FIELD_MAP[code]
      if (field) dbFields[field] = content
    }
  }
  if (result.executive_summary) dbFields.investmentThesis = String(result.executive_summary)

  const report = await prisma.eINReport.upsert({
    where:  { projectId },
    update: dbFields,
    create: {
      projectId,
      einNumber: `EIN-${uuidv4().slice(0, 8).toUpperCase()}`,
      ...dbFields,
    },
  })

  // Build normalized sections array for the UI
  const allSections = sections ?? {}
  const normalizedSections = [
    { id: `${report.id}-0`, section_code: '0', title: 'Executive Summary',              content: report.investmentThesis ?? '',  generated_by: 'ai', is_reviewed: false },
    { id: `${report.id}-1`, section_code: '1', title: 'Strategy Perspective',           content: allSections['1'] ?? report.projectSummary ?? '', generated_by: 'ai', is_reviewed: false },
    { id: `${report.id}-2`, section_code: '2', title: 'Political Perspective',          content: allSections['2'] ?? '',         generated_by: 'ai', is_reviewed: false },
    { id: `${report.id}-3`, section_code: '3', title: 'Economic Perspective',           content: allSections['3'] ?? report.marketAnalysis ?? '', generated_by: 'ai', is_reviewed: false },
    { id: `${report.id}-4`, section_code: '4', title: 'Financial Perspective',          content: allSections['4'] ?? report.financialSummary ?? '', generated_by: 'ai', is_reviewed: false },
    { id: `${report.id}-5`, section_code: '5', title: 'Legal & Regulatory Perspective', content: allSections['5'] ?? '',         generated_by: 'ai', is_reviewed: false },
    { id: `${report.id}-6`, section_code: '6', title: 'Risk Register & Mitigation',     content: allSections['6'] ?? report.riskSummary ?? '', generated_by: 'ai', is_reviewed: false },
    { id: `${report.id}-7`, section_code: '7', title: 'Required Next Steps',            content: allSections['7'] ?? '',         generated_by: 'ai', is_reviewed: false },
    { id: `${report.id}-8`, section_code: '8', title: 'Annexes',                        content: allSections['8'] ?? report.comparables ?? '', generated_by: 'ai', is_reviewed: false },
  ]

  return NextResponse.json({
    // AI raw output (for compatibility)
    sections:          allSections,
    executive_summary: result.executive_summary,
    recommendation:    result.recommendation,
    key_gaps:          result.key_gaps,
    next_steps:        result.next_steps,
    // Full normalized EIN (so UI can set state directly)
    ein: {
      id:                report.id,
      project_id:        report.projectId,
      ein_number:        report.einNumber,
      status:            'draft',
      version:           1,
      sections:          normalizedSections,
      executive_summary: report.investmentThesis ?? '',
      recommendation:    String(result.recommendation ?? 'hold'),
      key_gaps:          String(result.key_gaps ?? ''),
      next_steps:        String(result.next_steps ?? ''),
      petfel_score:      null,
      red_flags_count:   0,
      is_valid:          false,
      issues:            [],
      created_at:        report.createdAt.toISOString(),
      updated_at:        report.updatedAt.toISOString(),
    },
  })
}
