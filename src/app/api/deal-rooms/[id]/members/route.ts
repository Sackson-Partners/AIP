import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'

type Ctx = { params: Promise<{ id: string }> }

// Members are not persisted yet — return empty list for now
export async function GET(_req: NextRequest, { params }: Ctx) {
  await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: [] })
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: { message: 'Member invitation sent (email not configured yet).' } }, { status: 201 })
}
