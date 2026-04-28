import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

// Accept array of { pillar, score } entries — average per pillar, save to PETFELAnalysis
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const scores: Array<{ pillar?: string; score?: number }> = body.scores ?? []

  // Group scores by pillar and compute averages
  const pillarMap: Record<string, number[]> = {}
  for (const s of scores) {
    if (!s.pillar || typeof s.score !== 'number' || s.score <= 0) continue
    if (!pillarMap[s.pillar]) pillarMap[s.pillar] = []
    pillarMap[s.pillar].push(s.score)
  }
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  const updates: Record<string, number> = {}
  if (pillarMap.political)     updates.politicalScore     = avg(pillarMap.political)
  if (pillarMap.economic)      updates.economicScore      = avg(pillarMap.economic)
  if (pillarMap.technical)     updates.technicalScore     = avg(pillarMap.technical)
  if (pillarMap.financial)     updates.financialScore     = avg(pillarMap.financial)
  if (pillarMap.environmental) updates.environmentalScore = avg(pillarMap.environmental)
  if (pillarMap.legal)         updates.legalScore         = avg(pillarMap.legal)

  const record = await prisma.pETFELAnalysis.update({
    where: { id },
    data:  updates,
  })

  const pillarScores = {
    political:     record.politicalScore ?? 0,
    economic:      record.economicScore ?? 0,
    technical:     record.technicalScore ?? 0,
    financial:     record.financialScore ?? 0,
    environmental: record.environmentalScore ?? 0,
    legal:         record.legalScore ?? 0,
  }
  const hasScores = Object.values(pillarScores).some(s => s > 0)

  return NextResponse.json({
    data: {
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
    }
  })
}
