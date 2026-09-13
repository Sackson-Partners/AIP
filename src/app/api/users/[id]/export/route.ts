import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/users/[id]/export
 * GDPR Right to Data Portability (Article 20) + Right of Access (Article 15)
 * Returns all user data as downloadable JSON
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Users can only export their own data (admins can export any)
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role ?? '')
  if (!isAdmin && session.user.id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Gather ALL user data across all tables
    const [user, projects, dealRooms, documents, auditLogs, activityLogs, accessRequests, savedDeals] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            organization: true,
            title: true,
            country: true,
            authProvider: true,
            emailVerified: true,
            lastLoginAt: true,
            failedLoginAttempts: true,
            accountLockedUntil: true,
            twoFactorEnabled: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true,
            // EXCLUDE: passwordHash, twoFactorSecret, sessionVersion
          },
        }),
        prisma.project.findMany({
          where: { ownerId: id },
          select: {
            id: true,
            title: true,
            code: true,
            status: true,
            sector: true,
            country: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.dealRoom.findMany({
          where: { createdById: id },
          select: {
            id: true,
            name: true,
            status: true,
            dealValue: true,
            createdAt: true,
          },
        }),
        prisma.document.findMany({
          where: { uploaderId: id },
          select: {
            id: true,
            filename: true,
            type: true,
            projectId: true,
            createdAt: true,
          },
        }),
        prisma.auditLog.findMany({
          where: { userId: id },
          select: {
            action: true,
            tableName: true,
            recordId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000, // Limit to last 1000 audit entries
        }),
        prisma.activityLog.findMany({
          where: { userId: id },
          select: {
            action: true,
            resource: true,
            resourceId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000, // Limit to last 1000 activities
        }),
        prisma.accessRequest.findMany({
          where: { email: user?.email ?? '' },
          select: {
            status: true,
            roleRequested: true,
            createdAt: true,
            reviewedAt: true,
          },
        }),
        prisma.savedDeal.findMany({
          where: { userId: id },
          select: {
            dealRoomId: true,
            createdAt: true,
          },
        }),
      ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: session.user.id,
      dataSubject: {
        id: user.id,
        email: user.email,
      },
      personalData: {
        profile: user,
        projects: {
          count: projects.length,
          items: projects,
        },
        dealRooms: {
          count: dealRooms.length,
          items: dealRooms,
        },
        documents: {
          count: documents.length,
          items: documents,
        },
        savedDeals: {
          count: savedDeals.length,
          items: savedDeals,
        },
        auditTrail: {
          count: auditLogs.length,
          items: auditLogs,
          note: 'Limited to last 1000 entries for export size',
        },
        activityHistory: {
          count: activityLogs.length,
          items: activityLogs,
          note: 'Limited to last 1000 entries for export size',
        },
        accessRequests: accessRequests,
      },
      gdprInfo: {
        requestType: 'DATA_EXPORT',
        legalBasis: 'Right to Data Portability (GDPR Art. 20) + Right of Access (GDPR Art. 15)',
        dataController: 'Africa Infrastructure Partners',
        retentionPolicy: 'Data retained for 90 days after account deletion',
        contactEmail: 'privacy@africa-infra.com',
      },
    }

    // Log the data export request for compliance audit trail
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'GDPR_DATA_EXPORT',
        tableName: 'User',
        recordId: id,
        metadata: JSON.stringify({
          exportedUserId: id,
          exportedBy: session.user.id,
          timestamp: new Date().toISOString(),
          recordsExported: {
            projects: projects.length,
            dealRooms: dealRooms.length,
            documents: documents.length,
            auditLogs: auditLogs.length,
          },
        }),
      },
    })

    logger.info('GDPR data export completed', {
      userId: id,
      requestedBy: session.user.id,
      recordCount: {
        projects: projects.length,
        dealRooms: dealRooms.length,
        documents: documents.length,
      },
    })

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="aip-data-export-${user.email}-${Date.now()}.json"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error('GDPR data export failed', {
      error: error instanceof Error ? error.message : String(error),
      userId: id,
      requestedBy: session.user.id,
    })
    return NextResponse.json(
      { error: 'Failed to export data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
