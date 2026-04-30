import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'

type Ctx = { params: Promise<{ id: string; memberId: string }> }

// Stub: marks NDA as signed. When DealRoomMember table is added to Prisma,
// update this to: prisma.dealRoomMember.update({ where: { id: memberId }, data: { ndaSigned: true } })
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { memberId } = await params
  return NextResponse.json({ data: { memberId, nda_signed: true, message: 'NDA marked as signed.' } })
}
