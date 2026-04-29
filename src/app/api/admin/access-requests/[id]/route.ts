import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { status } = body as { status?: string }

  if (!['APPROVED', 'REJECTED'].includes(status ?? '')) {
    return NextResponse.json({ error: 'status must be APPROVED or REJECTED' }, { status: 400 })
  }

  const request = await prisma.accessRequest.findUnique({ where: { id } })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.accessRequest.update({
    where: { id },
    data:  { status: status!, reviewedBy: session.user.id, reviewedAt: new Date() },
  })

  let tempPassword: string | undefined
  if (status === 'APPROVED') {
    // Check if user already exists (shouldn't, but guard)
    const existing = await prisma.user.findUnique({ where: { email: request.email } })
    if (!existing) {
      tempPassword = crypto.randomBytes(8).toString('hex') // 16-char hex
      await prisma.user.create({
        data: {
          email:         request.email,
          name:          request.fullName,
          role:          request.roleRequested as never,
          status:        'ACTIVE',
          authProvider:  'INTERNAL',
          passwordHash:  await bcrypt.hash(tempPassword, 12),
          mustChangePass: true,
          organization:  request.organization ?? undefined,
        },
      })
    }
  }

  return NextResponse.json({
    data: { id, status, reviewed_by: session.user.id },
    ...(tempPassword ? { temp_password: tempPassword, message: 'User created. Share temp_password with them securely.' } : {}),
  })
}
