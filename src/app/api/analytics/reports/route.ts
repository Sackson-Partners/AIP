import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reports = await prisma.analyticReport.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    data:       reports,
    pagination: { page: 1, limit: 100, total: reports.length, pages: 1 },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!body.type)  return NextResponse.json({ error: 'type required' },  { status: 400 })

  const report = await prisma.analyticReport.create({
    data: {
      title:     body.title,
      type:      body.type,
      sector:    body.sector  ?? null,
      country:   body.country ?? null,
      content:   body.content ?? null,
      data:      body.data != null ? JSON.stringify(body.data) : null,
      createdBy: session.user.id,
    },
  })

  return NextResponse.json({ data: report }, { status: 201 })
}
