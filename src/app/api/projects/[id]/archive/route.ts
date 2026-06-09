import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit-log'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.update({
    where: { id },
    data: {
      archived: true,
      archivedAt: new Date(),
      archivedBy: session.user.id,
    },
  })

  await logAudit({
    userId: session.user.id,
    action: 'project.archive',
    tableName: 'Project',
    recordId: id,
    metadata: { title: project.title },
  })

  return NextResponse.json({ data: project })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.update({
    where: { id },
    data: {
      archived: false,
      archivedAt: null,
      archivedBy: null,
    },
  })

  await logAudit({
    userId: session.user.id,
    action: 'project.restore',
    tableName: 'Project',
    recordId: id,
    metadata: { title: project.title },
  })

  return NextResponse.json({ data: project })
}
