import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_ROLES = ['GOVERNMENT', 'SPONSOR_DEVELOPER', 'EPC_OPERATOR', 'INSTITUTIONAL_INVESTOR']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { email, fullName, organization, roleRequested, message } = body

  if (!email)         return NextResponse.json({ error: 'email required' },         { status: 400 })
  if (!fullName)      return NextResponse.json({ error: 'fullName required' },      { status: 400 })
  if (!roleRequested) return NextResponse.json({ error: 'roleRequested required' }, { status: 400 })
  if (!VALID_ROLES.includes(roleRequested)) {
    return NextResponse.json({ error: `roleRequested must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  // Check if already registered
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 })
  }

  // Upsert request (allow re-application if rejected)
  const existing = await prisma.accessRequest.findUnique({ where: { email } })
  if (existing && existing.status === 'PENDING') {
    return NextResponse.json({ error: 'A request with this email is already pending review.' }, { status: 409 })
  }

  const request = await prisma.accessRequest.upsert({
    where:  { email },
    update: { fullName, organization: organization ?? null, roleRequested, message: message ?? null, status: 'PENDING', reviewedBy: null, reviewedAt: null },
    create: { email, fullName, organization: organization ?? null, roleRequested, message: message ?? null },
  })

  return NextResponse.json({
    data: {
      id:         request.id,
      email:      request.email,
      status:     request.status,
      created_at: request.createdAt.toISOString(),
    },
    message: 'Your access request has been submitted. You will receive an email once reviewed.',
  }, { status: 201 })
}
