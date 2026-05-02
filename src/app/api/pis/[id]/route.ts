import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

const ADMIN_ROLES = new Set<string>([UserRole.SUPER_ADMIN, UserRole.ADMIN])

type Ctx = { params: Promise<{ id: string }> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSnake(r: any) {
  if (!r) return null
  return {
    id: r.id,
    project_id: r.projectId,
    project_title: r.project?.title,
    project_country: r.project?.country,
    project_sector: r.project?.sector,
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
  }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const record = await prisma.pISReport.findUnique({
    where: { id },
    include: { project: { select: { id: true, title: true, country: true, sector: true, dealStage: true, totalCost: true } } },
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: toSnake(record) })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Map snake_case body keys to Prisma camelCase
  const updateData: Record<string, unknown> = {}
  if (body.status !== undefined)               updateData.status               = body.status
  if (body.executive_summary !== undefined)    updateData.executiveSummary     = body.executive_summary
  if (body.project_background !== undefined)   updateData.projectBackground    = body.project_background
  if (body.financial_structure !== undefined)  updateData.financialStructure   = body.financial_structure
  if (body.market_analysis !== undefined)      updateData.marketAnalysis       = body.market_analysis
  if (body.risk_factors !== undefined)         updateData.riskFactors          = body.risk_factors
  if (body.investment_highlights !== undefined) updateData.investmentHighlights = body.investment_highlights
  if (body.use_of_proceeds !== undefined)      updateData.useOfProceeds        = body.use_of_proceeds
  if (body.exit_strategy !== undefined)        updateData.exitStrategy         = body.exit_strategy
  if (body.team_background !== undefined)      updateData.teamBackground       = body.team_background
  if (body.legal_structure !== undefined)      updateData.legalStructure       = body.legal_structure

  const record = await prisma.pISReport.update({
    where: { id },
    data: updateData,
    include: { project: { select: { id: true, title: true, country: true, sector: true, dealStage: true, totalCost: true } } },
  })

  return NextResponse.json({ data: toSnake(record) })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const record = await prisma.pISReport.findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = ADMIN_ROLES.has(session.user.role as string)
  if (!isAdmin && record.createdBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.pISReport.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
