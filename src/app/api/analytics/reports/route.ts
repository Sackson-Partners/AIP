import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { v4 as uuidv4 } from 'uuid'

// Reports have no DB model — stored in-memory per process (sufficient for demo)
// Replace with a real Prisma model + migration for production persistence
const reports: Record<string, unknown>[] = []

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const report = {
    id:         uuidv4(),
    title:      body.title,
    type:       body.type,
    sector:     body.sector  ?? null,
    country:    body.country ?? null,
    content:    body.content ?? null,
    data:       body.data    ?? null,
    created_by: session.user.id,
    created_at: new Date().toISOString(),
  }

  reports.push(report)
  return NextResponse.json({ data: report }, { status: 201 })
}
