import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { getDataRoomAccessStatus, signNDAAndIssueCode } from '@/lib/data-room-access'

type Ctx = { params: Promise<{ projectId: string }> }

// GET - Check access status
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await getDataRoomAccessStatus(session.user.id, projectId)

  return NextResponse.json({ data: status })
}

// POST - Sign NDA and get access code
export async function POST(req: NextRequest, { params }: Ctx) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { accessId, agreedToNDA } = body

  if (!accessId) {
    return NextResponse.json({ error: 'accessId required' }, { status: 400 })
  }

  if (!agreedToNDA) {
    return NextResponse.json({ error: 'You must agree to the NDA terms' }, { status: 400 })
  }

  try {
    const updated = await signNDAAndIssueCode(accessId)

    return NextResponse.json({
      data: {
        success: true,
        accessCode: updated.accessCode,
        ndaSignedAt: updated.ndaSignedAt,
        message: 'NDA signed successfully. Your access code is displayed below.',
      },
    })
  } catch (error) {
    console.error('[data-room-access] Sign NDA error:', error)
    return NextResponse.json({ error: 'Failed to process NDA signature' }, { status: 500 })
  }
}
