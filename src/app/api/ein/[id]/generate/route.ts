import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit-log'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60 // AI generation needs extended timeout

type Ctx = { params: Promise<{ id: string }> }

// Synchronous AI generation for EIN
async function generateEINSync(einId: string, projectId: string, userId: string) {
  // Load context data
  const [einReport, project, petfelResult, verificationsResult] = await Promise.allSettled([
    prisma.eINReport.findUnique({ where: { id: einId } }),
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.pETFELAnalysis.findUnique({ where: { projectId } }),
    prisma.verification.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 1 }),
  ])

  if (einReport.status === 'rejected' || !einReport.value) {
    throw new Error(`EIN report ${einId} not found`)
  }
  if (project.status === 'rejected' || !project.value) {
    throw new Error(`Project ${projectId} not found`)
  }

  const ein = einReport.value
  const proj = project.value
  const petfel = petfelResult.status === 'fulfilled' ? petfelResult.value : null
  const verification = verificationsResult.status === 'fulfilled' && verificationsResult.value.length > 0
    ? verificationsResult.value[0]
    : null

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are an infrastructure investment analyst. Generate a comprehensive Executive Information Note (EIN) for the following project. Return ONLY valid JSON with no markdown, no code blocks, no additional text.

PROJECT DATA:
- Name: ${proj.title ?? 'N/A'}
- Code: ${proj.code ?? 'N/A'}
- Country: ${proj.country ?? 'N/A'}
- Region: ${proj.region ?? 'N/A'}
- Sector: ${proj.sector ?? 'N/A'}
- Project Type: ${proj.projectType ?? 'N/A'}
- Deal Stage: ${proj.dealStage ?? 'N/A'}
- Total Cost: ${proj.totalCost ? `USD ${proj.totalCost.toLocaleString()}` : 'N/A'}
- Equity Required: ${proj.equityRequired ? `USD ${proj.equityRequired.toLocaleString()}` : 'N/A'}
- Debt Required: ${proj.debtRequired ? `USD ${proj.debtRequired.toLocaleString()}` : 'N/A'}
- Risk Rating: ${proj.riskRating ?? 'N/A'}
- ESG Rating: ${proj.esgRating ?? 'N/A'}
- Description: ${proj.description ?? 'N/A'}

${petfel ? `PETFEL RISK ANALYSIS:
- Overall Score: ${petfel.overallScore ?? 'N/A'} / 5.0
- Rating: ${petfel.rating ?? 'N/A'}
- Political: ${petfel.politicalScore ?? 0}
- Economic: ${petfel.economicScore ?? 0}
- Technical: ${petfel.technicalScore ?? 0}
- Financial: ${petfel.financialScore ?? 0}
- Environmental: ${petfel.environmentalScore ?? 0}
- Legal: ${petfel.legalScore ?? 0}
- AI Memo: ${petfel.aiMemo ?? 'N/A'}
` : ''}

${verification ? `VERIFICATION STATUS:
- Level: ${verification.level ?? 'V0'}
- Status: ${verification.status ?? 'PENDING'}
- Overall Score: ${verification.overallScore ?? 0}
- Technical Readiness: ${verification.technicalReadiness ?? 0}
- Financial Robustness: ${verification.financialRobustness ?? 0}
- Legal Clarity: ${verification.legalClarity ?? 0}
- ESG Compliance: ${verification.esgCompliance ?? 0}
` : ''}

Generate comprehensive, professional content for each section. Each section should be 2-4 paragraphs suitable for executive decision-making and institutional investors.

Return JSON with exactly these keys:
{
  "projectSummary": "...",
  "strategicObjectives": "...",
  "sectorContext": "...",
  "financialStructure": "...",
  "riskProfile": "...",
  "investmentRationale": "..."
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Handle potential markdown code blocks
  let jsonText = text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '')
  }

  const generated = JSON.parse(jsonText) as Record<string, string>
  console.log('[EIN] Generated with AWS Anthropic Claude')

  // Save results
  const updated = await prisma.eINReport.update({
    where: { id: einId },
    data: {
      projectSummary: generated.projectSummary ?? ein.projectSummary,
      strategicObjectives: generated.strategicObjectives,
      sectorContext: generated.sectorContext,
      financialStructure: generated.financialStructure,
      riskProfile: generated.riskProfile,
      investmentRationale: generated.investmentRationale,
      status: 'COMPLETE',
      lastGeneratedAt: new Date(),
    },
  })

  // Log audit
  await logAudit({
    userId,
    action: 'ein.ai_generate' as never,
    tableName: 'EINReport',
    recordId: einId,
    metadata: {
      projectId,
      fieldsGenerated: Object.keys(generated).length,
      generatedAt: updated.lastGeneratedAt,
    },
  })

  return updated
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Block external partners from generating EIN
  if (session.user.role === 'INSTITUTIONAL_INVESTOR' || session.user.role === 'GOVERNMENT' ||
      session.user.role === 'SPONSOR_DEVELOPER' || session.user.role === 'EPC_OPERATOR') {
    return NextResponse.json(
      { error: 'External partners cannot generate EIN reports' },
      { status: 403 }
    )
  }

  const einReport = await prisma.eINReport.findUnique({ where: { id } })
  if (!einReport) {
    return NextResponse.json({ error: 'EIN report not found' }, { status: 404 })
  }

  try {
    console.log(`[EIN generate] Running synchronous generation for EIN ${id}`)
    const updated = await generateEINSync(id, einReport.projectId, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'EIN generated successfully with AI',
      einId: id,
      data: updated,
    })
  } catch (err) {
    console.error('[EIN generate] Failed:', err)
    return NextResponse.json({
      error: 'Failed to generate EIN',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 })
  }
}
