import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

/** Map a Prisma PETFELAnalysis record to the shape the frontend expects. */
function normalize(record: {
  id: string; projectId: string
  politicalScore: number | null; economicScore: number | null
  technicalScore: number | null; financialScore: number | null
  environmentalScore: number | null; legalScore: number | null
  overallScore: number | null; rating: string | null
  aiMemo: string | null; riskFactors: string | null
  mitigants: string | null; recommendations: string | null
}) {
  const pillarScores = {
    political:     record.politicalScore ?? 0,
    economic:      record.economicScore ?? 0,
    technical:     record.technicalScore ?? 0,
    financial:     record.financialScore ?? 0,
    environmental: record.environmentalScore ?? 0,
    legal:         record.legalScore ?? 0,
  }
  const hasScores = Object.values(pillarScores).some(s => s > 0)
  return {
    id:            record.id,
    project_id:    record.projectId,
    status:        record.rating ? 'submitted' : hasScores ? 'scored' : 'draft',
    overall_score: record.overallScore,
    rating:        record.rating,
    gating_result: record.overallScore
      ? record.overallScore >= 3.5 ? 'GO' : record.overallScore >= 2.5 ? 'WATCH' : 'NO-GO'
      : null,
    pillar_scores: pillarScores,
    scores:        [],
    flags:         [],
    ai_memo:       record.aiMemo,
    risk_factors:  record.riskFactors,
    mitigants:     record.mitigants,
    recommendations: record.recommendations,
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const record = await prisma.pETFELAnalysis.upsert({
    where:  { projectId },
    create: { projectId, ...body },
    update: { ...body },
  })
  return NextResponse.json({ data: normalize(record) }, { status: 201 })
}
