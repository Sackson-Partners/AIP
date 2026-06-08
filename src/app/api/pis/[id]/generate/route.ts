import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest/client'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pisReport = await prisma.pISReport.findUnique({
    where: { id },
    include: { project: true },
  })
  if (!pisReport) return NextResponse.json({ error: 'PIS report not found' }, { status: 404 })

  // Trigger background job instead of running inline
  try {
    await inngest.send({
      name: 'pis/generate',
      data: {
        pisId: id,
        projectId: pisReport.projectId,
        userId: session.user.id,
      },
    })

    console.log(`[PIS generate] Background job triggered for PIS ${id}`)

    return NextResponse.json({
      success: true,
      message: 'AI generation started in background. Refresh the page in a minute to see results.',
      pisId: id,
      status: 'processing',
    })
  } catch (err) {
    console.error('[PIS generate] Failed to trigger background job:', err)
    return NextResponse.json({
      error: 'Failed to start AI generation',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 })
  }
}
