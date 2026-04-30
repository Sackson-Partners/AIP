import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'

type Ctx = { params: Promise<{ id: string }> }

const meetings: Record<string, unknown[]> = {}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: meetings[id] ?? [] })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const meeting = { id: Date.now().toString(), ...body, status: 'scheduled', created_by: session.user.id }
  if (!meetings[id]) meetings[id] = []
  meetings[id].push(meeting)
  return NextResponse.json({ data: meeting }, { status: 201 })
}
