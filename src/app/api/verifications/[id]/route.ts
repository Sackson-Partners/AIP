import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { canAccessProject } from '@/lib/project-visibility'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const v = await prisma.verification.findUnique({
    where: { id },
    include: { project: { select: { id: true, title: true, status: true } } }
  })

  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check project visibility
  const access = await canAccessProject(session.user.id, session.user.role as string, v.projectId)
  if (!access.allowed) {
    return NextResponse.json({ error: 'Project not accessible' }, { status: 403 })
  }

  return NextResponse.json({ data: v })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get existing verification to check project access
  const existing = await prisma.verification.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check project visibility
  const access = await canAccessProject(session.user.id, session.user.role as string, existing.projectId)
  if (!access.allowed) {
    return NextResponse.json({ error: 'Project not accessible' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  // Parse and validate fields
  const tech  = body.technical_readiness  !== undefined ? Number(body.technical_readiness)  : existing.technicalReadiness
  const fin   = body.financial_robustness !== undefined ? Number(body.financial_robustness) : existing.financialRobustness
  const legal = body.legal_clarity        !== undefined ? Number(body.legal_clarity)        : existing.legalClarity
  const esg   = body.esg_compliance       !== undefined ? Number(body.esg_compliance)       : existing.esgCompliance
  const overall = (tech + fin + legal + esg) / 4

  try {
    const v = await prisma.verification.update({
      where: { id },
      data: {
        ...(body.level              !== undefined ? { level:               body.level }              : {}),
        ...(body.status             !== undefined ? { status:              body.status }             : {}),
        ...(body.notes              !== undefined ? { notes:               body.notes }              : {}),
        ...(body.technical_readiness  !== undefined ? { technicalReadiness:  tech }  : {}),
        ...(body.financial_robustness !== undefined ? { financialRobustness: fin }   : {}),
        ...(body.legal_clarity        !== undefined ? { legalClarity:        legal } : {}),
        ...(body.esg_compliance       !== undefined ? { esgCompliance:       esg }   : {}),
        overallScore: overall,
        ...(body.focal_point_name   !== undefined ? { focalPointName:   body.focal_point_name }   : {}),
        ...(body.focal_point_email  !== undefined ? { focalPointEmail:  body.focal_point_email }  : {}),
        ...(body.focal_point_org    !== undefined ? { focalPointOrg:    body.focal_point_org }    : {}),
        ...(body.focal_point_title  !== undefined ? { focalPointTitle:  body.focal_point_title }  : {}),
        ...(body.local_partner_name  !== undefined ? { localPartnerName:  body.local_partner_name }  : {}),
        ...(body.local_partner_org   !== undefined ? { localPartnerOrg:   body.local_partner_org }   : {}),
        ...(body.local_partner_role  !== undefined ? { localPartnerRole:  body.local_partner_role }  : {}),
        ...(body.local_partner_email !== undefined ? { localPartnerEmail: body.local_partner_email } : {}),
        verifiedBy: session.user.id,
        verifiedAt: new Date(),
      },
      include: { project: { select: { id: true, title: true } } },
    })

    return NextResponse.json({ data: v })
  } catch (error) {
    console.error('[PATCH /api/verifications/[id]]', error)
    return NextResponse.json({ error: 'Failed to update verification' }, { status: 500 })
  }
}
