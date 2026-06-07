import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { getProjectVisibilityFilter, filterByProjectVisibility } from '@/lib/project-visibility'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  const userRole = session.user.role as string

  // Build WHERE clause with visibility filter
  const projectFilter = getProjectVisibilityFilter(userRole)

  const verifications = await prisma.verification.findMany({
    where: projectId ? { projectId } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      project: {
        select: { id: true, title: true, status: true }
      }
    },
  })

  // Filter verifications by project visibility
  const filtered = await filterByProjectVisibility(verifications, userRole)

  const data = filtered.map(v => ({
    id: v.id,
    project_id: v.projectId,
    project_name: v.project.title,
    level: v.level,
    status: v.status,
    bankability: {
      overall_score: v.overallScore,
      technical_readiness: v.technicalReadiness,
      financial_robustness: v.financialRobustness,
      legal_clarity: v.legalClarity,
      esg_compliance: v.esgCompliance,
    },
    notes: v.notes,
    verified_by: v.verifiedBy,
    verified_at: v.verifiedAt?.toISOString() ?? null,
    focal_point_name:  v.focalPointName  ?? null,
    focal_point_email: v.focalPointEmail ?? null,
    focal_point_org:   v.focalPointOrg   ?? null,
    focal_point_title: v.focalPointTitle ?? null,
    local_partner_name:  v.localPartnerName  ?? null,
    local_partner_org:   v.localPartnerOrg   ?? null,
    local_partner_role:  v.localPartnerRole  ?? null,
    local_partner_email: v.localPartnerEmail ?? null,
    created_at: v.createdAt.toISOString(),
  }))

  return NextResponse.json({ data, pagination: { page: 1, limit: 100, total: data.length, pages: 1 } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const projectId = String(body.project_id ?? '')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const tech  = Number(body.technical_readiness  ?? body.bankability?.technical_readiness  ?? 0)
  const fin   = Number(body.financial_robustness  ?? body.bankability?.financial_robustness ?? 0)
  const legal = Number(body.legal_clarity         ?? body.bankability?.legal_clarity        ?? 0)
  const esg   = Number(body.esg_compliance        ?? body.bankability?.esg_compliance       ?? 0)
  const overall = (tech + fin + legal + esg) / 4

  const v = await prisma.verification.create({
    data: {
      projectId,
      level:               body.level ?? 'V1',
      status:              body.status ?? 'PENDING',
      technicalReadiness:  tech,
      financialRobustness: fin,
      legalClarity:        legal,
      esgCompliance:       esg,
      overallScore:        overall,
      notes:               body.notes ?? null,
      verifiedBy:          session.user.id,
      focalPointName:  body.focal_point_name  ?? null,
      focalPointEmail: body.focal_point_email ?? null,
      focalPointOrg:   body.focal_point_org   ?? null,
      focalPointTitle: body.focal_point_title ?? null,
      localPartnerName:  body.local_partner_name  ?? null,
      localPartnerOrg:   body.local_partner_org   ?? null,
      localPartnerRole:  body.local_partner_role  ?? null,
      localPartnerEmail: body.local_partner_email ?? null,
    },
    include: { project: { select: { id: true, title: true } } },
  })

  return NextResponse.json({
    data: {
      id: v.id,
      project_id: v.projectId,
      project_name: v.project.title,
      level: v.level,
      status: v.status,
      bankability: {
        overall_score: v.overallScore,
        technical_readiness: v.technicalReadiness,
        financial_robustness: v.financialRobustness,
        legal_clarity: v.legalClarity,
        esg_compliance: v.esgCompliance,
      },
      focal_point_name:  v.focalPointName  ?? null,
      focal_point_email: v.focalPointEmail ?? null,
      focal_point_org:   v.focalPointOrg   ?? null,
      focal_point_title: v.focalPointTitle ?? null,
      local_partner_name:  v.localPartnerName  ?? null,
      local_partner_org:   v.localPartnerOrg   ?? null,
      local_partner_role:  v.localPartnerRole  ?? null,
      local_partner_email: v.localPartnerEmail ?? null,
      created_at: v.createdAt.toISOString(),
    },
  }, { status: 201 })
}
