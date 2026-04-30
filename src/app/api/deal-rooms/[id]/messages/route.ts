import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'

type Ctx = { params: Promise<{ id: string }> }

const chat: Record<string, unknown[]> = {}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: chat[id] ?? [] })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const msg = {
    id: Date.now().toString(),
    user_id: session.user.id,
    user_name: session.user.name ?? session.user.email,
    message: body.message ?? '',
    message_type: 'text',
    created_at: new Date().toISOString(),
  }
  if (!chat[id]) chat[id] = []
  chat[id].push(msg)
  return NextResponse.json({ data: msg }, { status: 201 })
}
