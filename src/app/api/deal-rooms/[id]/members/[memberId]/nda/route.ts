import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import crypto from 'crypto'

type Ctx = { params: Promise<{ id: string; memberId: string }> }

/**
 * POST /api/deal-rooms/[id]/members/[memberId]/nda
 * Signs NDA for a deal room member and generates access code
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: dealRoomId, memberId } = await params

  try {
    // Verify member exists and user has permission
    const member = await prisma.dealRoomMember.findUnique({
      where: { id: memberId },
      include: { dealRoom: true },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (member.dealRoomId !== dealRoomId) {
      return NextResponse.json({ error: 'Invalid deal room' }, { status: 400 })
    }

    // Only the member themselves can sign their NDA
    if (member.userId !== session.user.id) {
      return NextResponse.json({ error: 'You can only sign your own NDA' }, { status: 403 })
    }

    if (member.ndaSigned) {
      return NextResponse.json({
        error: 'NDA already signed',
        data: { ndaSigned: true, ndaSignedAt: member.ndaSignedAt }
      }, { status: 400 })
    }

    // Generate 6-digit access code
    const accessCode = crypto.randomInt(100000, 999999).toString()

    // Mark NDA as signed
    const updated = await prisma.dealRoomMember.update({
      where: { id: memberId },
      data: {
        ndaSigned: true,
        ndaSignedAt: new Date(),
      },
    })

    // Store access code in a separate table or cache (for now, return it)
    // TODO: Store in Redis or dedicated AccessCode table

    // Audit log
    await createAuditLog({
      userId: session.user.id,
      email: session.user.email ?? undefined,
      action: 'NDA_SIGNED',
      tableName: 'DealRoomMember',
      recordId: memberId,
      newValues: {
        dealRoomId,
        dealRoomName: member.dealRoom.name,
        memberEmail: member.email,
      },
    })

    console.log(`[NDA] Member ${member.email} signed NDA for deal room ${member.dealRoom.name}. Access code: ${accessCode}`)

    return NextResponse.json({
      success: true,
      data: {
        memberId: updated.id,
        ndaSigned: updated.ndaSigned,
        ndaSignedAt: updated.ndaSignedAt?.toISOString(),
        accessCode, // 6-digit code
        message: 'NDA signed successfully. Use this access code to unlock Data Rooms and Deal Rooms.',
      },
    })
  } catch (error: unknown) {
    console.error('[NDA Sign] Error:', error)
    return NextResponse.json({ error: 'Failed to sign NDA' }, { status: 500 })
  }
}
