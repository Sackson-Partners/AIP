import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

/** Radar scan — no AI needed. Flags projects based on DB state. */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await prisma.project.findMany({
    include: { petfelAnalysis: true },
    orderBy: { createdAt: 'desc' },
  })

  const flags = projects.flatMap((p) => {
    const results: { project_id: string; project_title: string; flag: string; severity: 'low' | 'medium' | 'high' }[] = []
    const base = { project_id: p.id, project_title: p.title }

    if (!p.petfelAnalysis) {
      results.push({ ...base, flag: 'No PETFEL assessment completed', severity: 'medium' })
    } else if ((p.petfelAnalysis.overallScore ?? 0) < 2.5) {
      results.push({ ...base, flag: `Low PETFEL score: ${p.petfelAnalysis.overallScore?.toFixed(1)}/5`, severity: 'high' })
    }

    if (!p.totalCost) {
      results.push({ ...base, flag: 'Total cost not specified', severity: 'low' })
    }

    if (p.status === 'DRAFT' && p.dealStage !== 'CONCEPT' && p.dealStage !== 'PREFEASIBILITY') {
      results.push({ ...base, flag: `Still in DRAFT status at ${p.dealStage} stage`, severity: 'medium' })
    }

    if (!p.description || p.description.length < 50) {
      results.push({ ...base, flag: 'Project description incomplete', severity: 'low' })
    }

    return results
  })

  const summary = {
    total_projects:  projects.length,
    flagged_count:   new Set(flags.map(f => f.project_id)).size,
    high_severity:   flags.filter(f => f.severity === 'high').length,
    medium_severity: flags.filter(f => f.severity === 'medium').length,
    low_severity:    flags.filter(f => f.severity === 'low').length,
  }

  return NextResponse.json({
    data: { flags, summary, scanned_at: new Date().toISOString() },
  })
}
