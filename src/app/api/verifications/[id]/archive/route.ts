import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const verification = await prisma.verification.update({
    where: { id },
    data: { archived: true, archivedAt: new Date() },
  })

  return NextResponse.json({ data: verification })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const verification = await prisma.verification.update({
    where: { id },
    data: { archived: false, archivedAt: null },
  })

  return NextResponse.json({ data: verification })
}
