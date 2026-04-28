import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

/** Map Prisma EINReport to the shape the frontend EIN page expects. */
function normalize(record: {
  id: string; projectId: string; einNumber: string
  projectSummary: string | null; financialSummary: string | null
  riskSummary: string | null; investmentThesis: string | null
  creditRating: string | null; riskRating: string | null; esgScore: number | null
  comparables: string | null; marketAnalysis: string | null
  publishedAt: Date | null; createdAt: Date; updatedAt: Date
}) {
  // Build EIN sections from stored report fields
  const sections = [
    { id: `${record.id}-0`, section_code: '0', title: 'Executive Summary', content: record.investmentThesis ?? '', generated_by: null, is_reviewed: false },
    { id: `${record.id}-1`, section_code: '1', title: 'Strategy Perspective', content: record.projectSummary ?? '', generated_by: null, is_reviewed: false },
    { id: `${record.id}-2`, section_code: '2', title: 'Political Perspective', content: '', generated_by: null, is_reviewed: false },
    { id: `${record.id}-3`, section_code: '3', title: 'Economic Perspective', content: record.marketAnalysis ?? '', generated_by: null, is_reviewed: false },
    { id: `${record.id}-4`, section_code: '4', title: 'Financial Perspective', content: record.financialSummary ?? '', generated_by: null, is_reviewed: false },
    { id: `${record.id}-5`, section_code: '5', title: 'Legal & Regulatory Perspective', content: '', generated_by: null, is_reviewed: false },
    { id: `${record.id}-6`, section_code: '6', title: 'Risk Register & Mitigation Plan', content: record.riskSummary ?? '', generated_by: null, is_reviewed: false },
    { id: `${record.id}-7`, section_code: '7', title: 'Required Next Steps', content: '', generated_by: null, is_reviewed: false },
    { id: `${record.id}-8`, section_code: '8', title: 'Annexes', content: record.comparables ?? '', generated_by: null, is_reviewed: false },
  ]

  return {
    id:                record.id,
    project_id:        record.projectId,
    ein_number:        record.einNumber,
    status:            record.publishedAt ? 'approved' : 'draft',
    version:           1,
    sections,
    executive_summary: record.investmentThesis ?? '',
    recommendation:    record.creditRating ? 'go' : 'hold',
    key_gaps:          '',
    next_steps:        '',
    petfel_score:      null,
    red_flags_count:   0,
    is_valid:          false,
    issues:            [],
    created_at:        record.createdAt.toISOString(),
    updated_at:        record.updatedAt.toISOString(),
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const record = await prisma.eINReport.findUnique({ where: { projectId } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: normalize(record) })
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Upsert — create if not exists
  const record = await prisma.eINReport.upsert({
    where:  { projectId },
    update: {},
    create: {
      projectId,
      einNumber: `EIN-${uuidv4().slice(0, 8).toUpperCase()}`,
    },
  })

  return NextResponse.json({ data: normalize(record) }, { status: 201 })
}
