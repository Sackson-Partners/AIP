import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { v4 as uuidv4 } from 'uuid'

// Events have no DB model — POST returns a synthetic record
// (replace with a real model + migration if persistence is needed)

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.name)       return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!body.event_date) return NextResponse.json({ error: 'event_date required' }, { status: 400 })

  const event = {
    id:         uuidv4(),
    name:       body.name,
    description: body.description ?? null,
    event_date: body.event_date,
    location:   body.location ?? null,
    type:       body.type ?? 'general',
    project_id: body.project_id ?? null,
    created_at: new Date().toISOString(),
  }

  return NextResponse.json({ data: event }, { status: 201 })
}
