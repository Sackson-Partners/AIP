// src/app/api/auth/forgot-password/route.ts
// Handles password reset requests
// Azure AD users: directed to Microsoft
// Internal users: admin notified to reset

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendAdminNotificationEmail } from '@/lib/email'
import { logActivity } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = body.email?.toLowerCase()?.trim()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Always return success to prevent email enumeration
    // Do the actual work silently

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        authProvider: true,
        status: true,
      },
    })

    if (user) {
      if (user.authProvider === 'AZURE_AD') {
        // Azure AD users reset via Microsoft — log the attempt
        await logActivity({
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          resource: 'AUTH',
          details: { provider: 'AZURE_AD', redirected: true },
        })
      } else if (user.authProvider === 'INTERNAL') {
        // Internal users — notify admins to reset manually
        const admins = await prisma.user.findMany({
          where: {
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            emailNotifications: true,
          },
          select: { email: true },
        })

        for (const admin of admins) {
          await sendAdminNotificationEmail({
            adminEmail: admin.email,
            subject: 'Password Reset Request — Internal Account',
            message: `Internal user ${user.name ?? user.email} (${user.email}) has requested a password reset. Please reset their password in the Admin panel at /admin/users.`,
          })
        }

        // Create notification in DB for admins
        const adminUsers = await prisma.user.findMany({
          where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
          select: { id: true },
        })

        if (adminUsers.length > 0) {
          await prisma.notification.createMany({
            data: adminUsers.map((admin) => ({
              userId: admin.id,
              type: 'SYSTEM_ALERT' as const,
              title: 'Password Reset Request',
              message: `${user.name ?? user.email} has requested a password reset.`,
              link: `/admin/users`,
            })),
          })
        }

        await logActivity({
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          resource: 'AUTH',
          details: { provider: 'INTERNAL', adminsNotified: admins.length },
        })
      }
    }

    // Always return 200 to prevent email enumeration
    return NextResponse.json({
      message: 'If an account exists, reset instructions have been sent.',
    })
  } catch (error: unknown) {
    logger.error('[FORGOT-PASSWORD]', error)
    // Still return 200 to prevent enumeration
    return NextResponse.json({
      message: 'If an account exists, reset instructions have been sent.',
    })
  }
}
