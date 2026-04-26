import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const existing = await prisma.eINReport.findUnique({ where: { projectId } })
  if (existing) return NextResponse.json({ data: existing })
  const einNumber = `EIN-${Date.now()}`
  const record = await prisma.eINReport.create({ data: { projectId, einNumber } })
  return NextResponse.json({ data: record }, { status: 201 })
}
