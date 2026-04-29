import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const v = await prisma.verification.findUnique({ where: { id }, include: { project: { select: { title: true } } } })
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: v })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const v = await prisma.verification.update({ where: { id }, data: body }).catch(() => null)
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: v })
}
