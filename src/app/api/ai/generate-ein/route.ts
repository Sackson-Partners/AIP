import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60 // seconds — AI calls need more than the 10s default

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

  const prompt = `You are a senior infrastructure investment analyst at an African infrastructure fund. Generate a comprehensive Executive Investment Note (EIN) for the following project.

Project: ${project.title}
Country: ${project.country ?? 'Africa'}
Sector: ${project.sector ?? 'Infrastructure'}
Deal Stage: ${project.dealStage ?? 'FEASIBILITY'}
Total Cost: ${project.totalCost ? `USD ${project.totalCost.toLocaleString()}` : 'Not specified'}
Description: ${project.description ?? 'No description provided'}
${petfel ? `PETFEL Overall Score: ${petfel.overallScore?.toFixed(1) ?? 'Not assessed'} / 5.0
PETFEL Rating: ${petfel.rating ?? 'Not rated'}
Risk Factors: ${petfel.riskFactors ?? 'None noted'}
Mitigants: ${petfel.mitigants ?? 'None noted'}` : ''}

Generate professional EIN sections. Respond ONLY with valid JSON (no markdown):
{
  "sections": {
    "1": "<Strategy Perspective — 2-3 paragraphs on strategic rationale and fit>",
    "2": "<Political Perspective — analysis of political risk and government support>",
    "3": "<Economic Perspective — macroeconomic context and market analysis>",
    "4": "<Financial Perspective — financing structure, returns, and key financial metrics>",
    "5": "<Legal & Regulatory Perspective — regulatory framework and key legal considerations>",
    "6": "<Risk Register — top 5 risks with mitigation strategies>",
    "7": "<Required Next Steps — 30/60/90 day action plan>",
    "8": "<Annexes — list of supporting documents needed>"
  },
  "executive_summary": "<2-3 sentence investment summary>",
  "recommendation": "go|hold|no_go",
  "key_gaps": "<bullet list of information gaps that need to be addressed>",
  "next_steps": "<immediate priority actions>"
}`

  const message = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  let result: Record<string, unknown>
  try {
    // Strip any accidental markdown code fences
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    result = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON', raw: text.slice(0, 500) }, { status: 502 })
  }

  return NextResponse.json(result)
}
