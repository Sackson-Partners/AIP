import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const userCount = await prisma.user.count()

    const envCheck = {
      NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_SECRET_LENGTH: process.env.NEXTAUTH_SECRET?.length ?? 0,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'NOT SET',
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_HAS_SSL:
        process.env.DATABASE_URL?.includes('sslmode') ?? false,
      DATABASE_URL_PROVIDER:
        process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? 'HIDDEN',
      AZURE_AD_CLIENT_ID_SET: !!process.env.AZURE_AD_CLIENT_ID,
      NODE_ENV: process.env.NODE_ENV,
    }

    return NextResponse.json({
      status: 'ok',
      dbConnection: 'success',
      userCount,
      envCheck,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      dbConnection: 'failed',
      error: error instanceof Error ? error.message : 'Unknown',
      stack:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.stack
            : null
          : null,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
