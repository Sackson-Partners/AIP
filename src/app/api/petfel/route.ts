import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await prisma.pETFELAnalysis.findMany({ include: { project: { select: { id: true, title: true, code: true } } }, orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({ data })
}

export async function POST() {
  return NextResponse.json({ error: 'Use POST /api/petfel/assess/[projectId] to create an assessment' }, { status: 400 })
}
