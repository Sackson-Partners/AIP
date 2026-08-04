import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit-log'
import Anthropic from '@anthropic-ai/sdk'
import { applyRateLimit, rateLimiters } from '@/middleware/rateLimit'

type Ctx = { params: Promise<{ id: string }> }

// Synchronous AI generation (fallback when Inngest not configured)
async function generatePISSync(pisId: string, projectId: string, userId: string) {
  // Load data
  const pisReport = await prisma.pISReport.findUnique({
    where: { id: pisId },
    include: { project: true },
  })

  if (!pisReport) throw new Error(`PIS report ${pisId} not found`)

  const [petfelResult, einResult] = await Promise.allSettled([
    prisma.pETFELAnalysis.findUnique({ where: { projectId } }),
    prisma.eINReport.findUnique({ where: { projectId } }),
  ])

  const project = pisReport.project
  const petfel = petfelResult.status === 'fulfilled' ? petfelResult.value : null
  const ein = einResult.status === 'fulfilled' ? einResult.value : null

  // AWS Anthropic Claude AI generation
  let generated: Record<string, string> = {}

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `You are an expert infrastructure investment analyst. Generate a professional Project Information Sheet (PIS) for the following project. Return ONLY valid JSON with no markdown, no code blocks, no additional text.

PROJECT DATA:
- Name: ${project.title ?? 'N/A'}
- Country: ${project.country ?? 'N/A'}
- Region: ${project.region ?? 'N/A'}
- Sector: ${project.sector ?? 'N/A'}
- Project Type: ${project.projectType ?? 'N/A'}
- Deal Stage: ${project.dealStage ?? 'N/A'}
- Total Cost: ${project.totalCost ? `USD ${project.totalCost.toLocaleString()}` : 'N/A'}
- Risk Rating: ${project.riskRating ?? 'N/A'}
- Description: ${project.description ?? 'N/A'}
${petfel ? `- PETFEL Score: ${petfel.overallScore ?? 'N/A'}` : ''}
${ein ? `- EIN Summary: ${ein.projectSummary ?? 'N/A'}` : ''}

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

    generated = JSON.parse(jsonText)
    console.log('[PIS] Generated with AWS Anthropic Claude')
  } catch (aiError) {
    console.error('[PIS] AI generation failed:', aiError)
    throw aiError
  }

  // Save results
  const updated = await prisma.pISReport.update({
    where: { id: pisId },
    data: {
      executiveSummary: generated.executiveSummary ?? pisReport.executiveSummary,
      projectBackground: generated.projectBackground ?? pisReport.projectBackground,
      financialStructure: generated.financialStructure ?? pisReport.financialStructure,
      marketAnalysis: generated.marketAnalysis ?? pisReport.marketAnalysis,
      riskFactors: generated.riskFactors ?? pisReport.riskFactors,
      investmentHighlights: generated.investmentHighlights ?? pisReport.investmentHighlights,
      aiGenerated: true,
      generatedAt: new Date(),
    },
  })

  // Log audit
  await logAudit({
    userId,
    action: 'pis.ai_generate',
    tableName: 'PISReport',
    recordId: pisId,
    metadata: {
      projectId,
      fieldsGenerated: Object.keys(generated).length,
      generatedAt: updated.generatedAt,
    },
  })

  return updated
}

export async function POST(req: NextRequest, { params }: Ctx) {
  // Apply rate limiting (5 requests per hour)
  const rateLimitResponse = await applyRateLimit(req, rateLimiters.generate)
  if (rateLimitResponse) return rateLimitResponse

  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pisReport = await prisma.pISReport.findUnique({
    where: { id },
    include: { project: true },
  })
  if (!pisReport) return NextResponse.json({ error: 'PIS report not found' }, { status: 404 })

  try {
    // Run synchronously (fallback mode for demo without Inngest)
    console.log(`[PIS generate] Running synchronous generation for PIS ${id}`)

    const updated = await generatePISSync(id, pisReport.projectId, session.user.id)

    return NextResponse.json({
      success: true,
      message: 'PIS generated successfully with AI',
      pisId: id,
      data: updated,
    })
  } catch (err) {
    console.error('[PIS generate] Failed:', err)
    return NextResponse.json({
      error: 'Failed to generate PIS',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 })
  }
}
