import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { deleteCached, CacheKeys } from '@/lib/redis'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const record = await prisma.pETFELAnalysis.findUnique({ where: { id }, include: { project: { select: { id: true, title: true, code: true } } } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: record })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Allow internal staff to update any field including scores, rating, and status
  const updateData: { [key: string]: unknown } = {}

  // Score fields
  if (body.politicalScore !== undefined) updateData.politicalScore = Number(body.politicalScore)
  if (body.economicScore !== undefined) updateData.economicScore = Number(body.economicScore)
  if (body.technicalScore !== undefined) updateData.technicalScore = Number(body.technicalScore)
  if (body.financialScore !== undefined) updateData.financialScore = Number(body.financialScore)
  if (body.environmentalScore !== undefined) updateData.environmentalScore = Number(body.environmentalScore)
  if (body.legalScore !== undefined) updateData.legalScore = Number(body.legalScore)
  if (body.overallScore !== undefined) updateData.overallScore = Number(body.overallScore)

  // Rating and status
  if (body.rating !== undefined) updateData.rating = body.rating
  if (body.status !== undefined) updateData.status = body.status

  // Text fields
  if (body.aiMemo !== undefined) updateData.aiMemo = body.aiMemo
  if (body.riskFactors !== undefined) updateData.riskFactors = body.riskFactors
  if (body.mitigants !== undefined) updateData.mitigants = body.mitigants
  if (body.recommendations !== undefined) updateData.recommendations = body.recommendations

  const record = await prisma.pETFELAnalysis.update({
    where: { id },
    data: updateData
  })

  // Invalidate PESTEL cache for this project
  await deleteCached(CacheKeys.pestel.assessment(record.projectId))
  console.log(`[PATCH /api/petfel/${id}] Cache invalidated for project ${record.projectId}`)

  return NextResponse.json({ data: record })
}
