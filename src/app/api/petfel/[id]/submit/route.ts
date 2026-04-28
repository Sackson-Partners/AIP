import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const record = await prisma.pETFELAnalysis.findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!record.overallScore) return NextResponse.json({ error: 'Calculate scores before submitting' }, { status: 422 })

  // Mark as submitted by ensuring rating is set
  const updated = await prisma.pETFELAnalysis.update({
    where: { id },
    data:  { rating: record.rating ?? 'C', updatedAt: new Date() },
  })

  const pillarScores = {
    political:     updated.politicalScore ?? 0,
    economic:      updated.economicScore ?? 0,
    technical:     updated.technicalScore ?? 0,
    financial:     updated.financialScore ?? 0,
    environmental: updated.environmentalScore ?? 0,
    legal:         updated.legalScore ?? 0,
  }

  return NextResponse.json({
    data: {
      id:            updated.id,
      project_id:    updated.projectId,
      status:        'submitted',
      overall_score: updated.overallScore,
      rating:        updated.rating,
      gating_result: updated.overallScore
        ? updated.overallScore >= 3.5 ? 'GO' : updated.overallScore >= 2.5 ? 'WATCH' : 'NO-GO'
        : null,
      pillar_scores: pillarScores,
      scores:        [],
      flags:         [],
    }
  })
}
