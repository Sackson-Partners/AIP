import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

const WEIGHTS = { political: 0.15, economic: 0.15, technical: 0.20, financial: 0.20, environmental: 0.15, legal: 0.15 }

function getRating(score: number): string {
  if (score >= 4.0) return 'A'
  if (score >= 3.0) return 'B'
  if (score >= 2.0) return 'C'
  return 'D'
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.pETFELAnalysis.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const p = existing.politicalScore ?? 0
  const e = existing.economicScore ?? 0
  const t = existing.technicalScore ?? 0
  const f = existing.financialScore ?? 0
  const en = existing.environmentalScore ?? 0
  const l = existing.legalScore ?? 0

  const overallScore =
    p  * WEIGHTS.political +
    e  * WEIGHTS.economic +
    t  * WEIGHTS.technical +
    f  * WEIGHTS.financial +
    en * WEIGHTS.environmental +
    l  * WEIGHTS.legal

  const rating = getRating(overallScore)

  const record = await prisma.pETFELAnalysis.update({
    where: { id },
    data:  {
      overallScore,
      rating,
    },
  })

  const pillarScores = {
    political:     record.politicalScore ?? 0,
    economic:      record.economicScore ?? 0,
    technical:     record.technicalScore ?? 0,
    financial:     record.financialScore ?? 0,
    environmental: record.environmentalScore ?? 0,
    legal:         record.legalScore ?? 0,
  }

  return NextResponse.json({
    data: {
      id:            record.id,
      projectId:     record.projectId,
      project_id:    record.projectId,
      overall_score: record.overallScore,
      overallScore:  record.overallScore,
      rating:        record.rating,
      gating_result: record.overallScore
        ? record.overallScore >= 3.5 ? 'GO' : record.overallScore >= 2.5 ? 'WATCH' : 'NO-GO'
        : null,
      pillar_scores: pillarScores,
      scores:        [],
      flags:         [],
    }
  })
}
