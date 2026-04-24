// src/app/api/user/profile/route.ts
// User profile update endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      organization,
      country,
      jobTitle,
      timezone,
      emailNotifications,
    } = body

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        firstName:          firstName          ?? undefined,
        lastName:           lastName           ?? undefined,
        name:               firstName && lastName ? `${firstName} ${lastName}` : undefined,
        phone:              phone              ?? undefined,
        organization:       organization       ?? undefined,
        country:            country            ?? undefined,
        jobTitle:           jobTitle           ?? undefined,
        timezone:           timezone           ?? undefined,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : undefined,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        organization: true,
        country: true,
        jobTitle: true,
        emailNotifications: true,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      email: session.user.email ?? undefined,
      action: 'UPDATE_PROFILE',
      tableName: 'users',
      recordId: session.user.id,
      newValues: { firstName, lastName, organization, country },
    })

    return NextResponse.json({ user: updated })
  } catch (error: any) {
    console.error('[PROFILE] Update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
