import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  const body = await req.json().catch(() => ({}))
  const action = body.action === 'DOWNLOAD' ? 'DOWNLOAD' : 'VIEW'

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? null

  await prisma.documentAccessLog.create({
    data: {
      documentId: id,
      userId:     session?.user?.id ?? null,
      email:      session?.user?.email ?? null,
      action,
      ipAddress:  ip,
    },
  })

  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = await prisma.documentAccessLog.findMany({
    where:   { documentId: id },
    orderBy: { createdAt: 'desc' },
    take:    100,
  })

  return NextResponse.json({ data: logs })
}
