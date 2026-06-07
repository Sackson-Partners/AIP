import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { filterByProjectVisibility } from '@/lib/project-visibility'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const records = await prisma.pISReport.findMany({
    include: {
      project: {
        select: { id: true, title: true, country: true, sector: true, dealStage: true, totalCost: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Filter by project visibility
  const filtered = await filterByProjectVisibility(records, session.user.role as string)

  const data = filtered.map((r) => ({
    id: r.id,
    project_id: r.projectId,
    project_title: r.project.title,
    project_country: r.project.country,
    project_sector: r.project.sector,
    project_deal_stage: r.project.dealStage,
    project_total_cost: r.project.totalCost,
    status: r.status,
    executive_summary: r.executiveSummary,
    project_background: r.projectBackground,
    financial_structure: r.financialStructure,
    market_analysis: r.marketAnalysis,
    risk_factors: r.riskFactors,
    investment_highlights: r.investmentHighlights,
    use_of_proceeds: r.useOfProceeds,
    exit_strategy: r.exitStrategy,
    team_background: r.teamBackground,
    legal_structure: r.legalStructure,
    ai_generated: r.aiGenerated,
    generated_at: r.generatedAt,
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { projectId, ...rest } = body

  if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

  const existing = await prisma.pISReport.findUnique({ where: { projectId } })
  if (existing) return NextResponse.json({ error: 'PIS report already exists for this project' }, { status: 409 })

  const record = await prisma.pISReport.create({
    data: {
      projectId,
      createdBy: session.user.id,
      executiveSummary: rest.executiveSummary ?? null,
      projectBackground: rest.projectBackground ?? null,
      financialStructure: rest.financialStructure ?? null,
      marketAnalysis: rest.marketAnalysis ?? null,
      riskFactors: rest.riskFactors ?? null,
      investmentHighlights: rest.investmentHighlights ?? null,
      useOfProceeds: rest.useOfProceeds ?? null,
      exitStrategy: rest.exitStrategy ?? null,
      teamBackground: rest.teamBackground ?? null,
      legalStructure: rest.legalStructure ?? null,
    },
    include: {
      project: {
        select: { id: true, title: true, country: true, sector: true, dealStage: true, totalCost: true },
      },
    },
  })

  const data = {
    id: record.id,
    project_id: record.projectId,
    project_title: record.project.title,
    project_country: record.project.country,
    project_sector: record.project.sector,
    status: record.status,
    executive_summary: record.executiveSummary,
    project_background: record.projectBackground,
    financial_structure: record.financialStructure,
    market_analysis: record.marketAnalysis,
    risk_factors: record.riskFactors,
    investment_highlights: record.investmentHighlights,
    use_of_proceeds: record.useOfProceeds,
    exit_strategy: record.exitStrategy,
    team_background: record.teamBackground,
    legal_structure: record.legalStructure,
    ai_generated: record.aiGenerated,
    generated_at: record.generatedAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  }

  return NextResponse.json({ data }, { status: 201 })
}
