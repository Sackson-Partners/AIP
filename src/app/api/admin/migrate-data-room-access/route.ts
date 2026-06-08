import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/migrate-data-room-access
 * Applies DataRoomAccess table migration
 * SUPER_ADMIN only
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = session.user.role as string
  if (userRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  try {
    console.log('[migrate-data-room-access] Starting migration...')

    // Check if table already exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'DataRoomAccess'
      );
    ` as Array<{ exists: boolean }>

    if (tableExists[0]?.exists) {
      return NextResponse.json({
        message: 'DataRoomAccess table already exists',
        alreadyExists: true
      })
    }

    // Create table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "DataRoomAccess" (
        "id" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "ndaSigned" BOOLEAN NOT NULL DEFAULT false,
        "ndaSignedAt" TIMESTAMP(3),
        "accessCode" TEXT,
        "codeIssuedAt" TIMESTAMP(3),
        "accessLevel" TEXT NOT NULL DEFAULT 'VIEW',
        "grantedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3),
        CONSTRAINT "DataRoomAccess_pkey" PRIMARY KEY ("id")
      );
    `)

    console.log('[migrate-data-room-access] Table created')

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "DataRoomAccess_projectId_idx" ON "DataRoomAccess"("projectId");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "DataRoomAccess_userId_idx" ON "DataRoomAccess"("userId");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "DataRoomAccess_accessCode_idx" ON "DataRoomAccess"("accessCode");
    `)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX "DataRoomAccess_projectId_userId_key" ON "DataRoomAccess"("projectId", "userId");
    `)

    console.log('[migrate-data-room-access] Indexes created')

    // Add foreign keys
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "DataRoomAccess"
      ADD CONSTRAINT "DataRoomAccess_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    `)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "DataRoomAccess"
      ADD CONSTRAINT "DataRoomAccess_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
    `)

    console.log('[migrate-data-room-access] Foreign keys added')

    // Verify table was created
    const verifyExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'DataRoomAccess'
      );
    ` as Array<{ exists: boolean }>

    return NextResponse.json({
      success: true,
      message: 'DataRoomAccess table created successfully',
      verified: verifyExists[0]?.exists,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[migrate-data-room-access] Migration failed:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
