import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const PILLARS = ['political', 'economic', 'technical', 'financial', 'environmental', 'legal']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const assessmentId = body.assessment_id as string
  if (!assessmentId) return NextResponse.json({ error: 'assessment_id required' }, { status: 400 })

  const assessment = await prisma.pETFELAnalysis.findUnique({
    where:   { id: assessmentId },
    include: { project: { select: { title: true, country: true, sector: true, description: true, totalCost: true, dealStage: true } } },
  })
  if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

  const project = assessment.project

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are an infrastructure investment analyst. Assess the following project using the PETFEL framework (Political, Economic, Technical, Financial, Environmental, Legal). Score each pillar from 1–5 where: 1=Critical Risk, 2=High Risk, 3=Moderate, 4=Good, 5=Best Practice.

Project: ${project.title}
Country: ${project.country ?? 'Africa'}
Sector: ${project.sector ?? 'Infrastructure'}
Deal Stage: ${project.dealStage ?? 'FEASIBILITY'}
Total Cost: ${project.totalCost ? `USD ${project.totalCost.toLocaleString()}` : 'Not specified'}
Description: ${project.description ?? 'No description provided'}

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):
{
  "political": { "score": <1-5>, "rationale": "<brief rationale>" },
  "economic": { "score": <1-5>, "rationale": "<brief rationale>" },
  "technical": { "score": <1-5>, "rationale": "<brief rationale>" },
  "financial": { "score": <1-5>, "rationale": "<brief rationale>" },
  "environmental": { "score": <1-5>, "rationale": "<brief rationale>" },
  "legal": { "score": <1-5>, "rationale": "<brief rationale>" },
  "summary": "<2-3 sentence investment memo>",
  "risk_factors": "<key risks, comma separated>",
  "mitigants": "<key mitigants, comma separated>",
  "recommendations": "<recommended next steps>"
}`

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  let aiResult: Record<string, { score?: number; rationale?: string } & Record<string, string>>
  try {
    aiResult = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON', raw: text }, { status: 502 })
  }

  // Save AI scores back to the assessment
  const updates: Record<string, number | string> = {}
  if (aiResult.political?.score)     updates.politicalScore     = Number(aiResult.political.score)
  if (aiResult.economic?.score)      updates.economicScore      = Number(aiResult.economic.score)
  if (aiResult.technical?.score)     updates.technicalScore     = Number(aiResult.technical.score)
  if (aiResult.financial?.score)     updates.financialScore     = Number(aiResult.financial.score)
  if (aiResult.environmental?.score) updates.environmentalScore = Number(aiResult.environmental.score)
  if (aiResult.legal?.score)         updates.legalScore         = Number(aiResult.legal.score)
  if (aiResult.summary)              updates.aiMemo             = String(aiResult.summary)
  if (aiResult.risk_factors)         updates.riskFactors        = String(aiResult.risk_factors)
  if (aiResult.mitigants)            updates.mitigants          = String(aiResult.mitigants)
  if (aiResult.recommendations)      updates.recommendations    = String(aiResult.recommendations)

  await prisma.pETFELAnalysis.update({ where: { id: assessmentId }, data: updates })

  // Return augmented scores in the format the UI expects
  const augmented_scores = PILLARS.map(pillar => ({
    pillar,
    sub_criterion: pillar,
    criterion_id:  pillar,
    score:         Number(aiResult[pillar]?.score ?? 3),
    evidence_notes: aiResult[pillar]?.rationale ?? '',
    mitigation:    '',
    owner:         'AI',
  }))

  return NextResponse.json({
    augmented_scores,
    summary:         aiResult.summary,
    risk_factors:    aiResult.risk_factors,
    mitigants:       aiResult.mitigants,
    recommendations: aiResult.recommendations,
  })
}
