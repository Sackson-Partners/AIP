import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const verifications = await prisma.verification.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { createdAt: 'desc' },
    include: { project: { select: { id: true, title: true } } },
  })

  const data = verifications.map(v => ({
    id: v.id,
    project_id: v.projectId,
    project_name: v.project.title,
    level: v.level,
    status: v.status,
    bankability: {
      overall_score: v.overallScore,
      technical_readiness: v.technicalReadiness,
      financial_robustness: v.financialRobustness,
      legal_clarity: v.legalClarity,
      esg_compliance: v.esgCompliance,
    },
    notes: v.notes,
    verified_by: v.verifiedBy,
    verified_at: v.verifiedAt?.toISOString() ?? null,
    created_at: v.createdAt.toISOString(),
  }))

  return NextResponse.json({ data, pagination: { page: 1, limit: 100, total: data.length, pages: 1 } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const projectId = String(body.project_id ?? '')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const tech  = Number(body.technical_readiness  ?? body.bankability?.technical_readiness  ?? 0)
  const fin   = Number(body.financial_robustness  ?? body.bankability?.financial_robustness ?? 0)
  const legal = Number(body.legal_clarity         ?? body.bankability?.legal_clarity        ?? 0)
  const esg   = Number(body.esg_compliance        ?? body.bankability?.esg_compliance       ?? 0)
  const overall = (tech + fin + legal + esg) / 4

  const v = await prisma.verification.create({
    data: {
      projectId,
      level:               body.level ?? 'V1',
      status:              body.status ?? 'PENDING',
      technicalReadiness:  tech,
      financialRobustness: fin,
      legalClarity:        legal,
      esgCompliance:       esg,
      overallScore:        overall,
      notes:               body.notes ?? null,
      verifiedBy:          session.user.id,
    },
    include: { project: { select: { id: true, title: true } } },
  })

  return NextResponse.json({
    data: {
      id: v.id,
      project_id: v.projectId,
      project_name: v.project.title,
      level: v.level,
      status: v.status,
      bankability: {
        overall_score: v.overallScore,
        technical_readiness: v.technicalReadiness,
        financial_robustness: v.financialRobustness,
        legal_clarity: v.legalClarity,
        esg_compliance: v.esgCompliance,
      },
      created_at: v.createdAt.toISOString(),
    },
  }, { status: 201 })
}
