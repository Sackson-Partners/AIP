import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCacheAvailable } from '@/lib/redis'

/**
 * GET /api/health
 * Health check endpoint for monitoring and uptime services
 * Returns 200 if all systems operational, 503 if critical services down
 */
export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown', latency: 0 },
      redis: { status: 'unknown', available: false },
      ai: {
        anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured',
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
      },
    },
  }

  let hasErrors = false

  // Check database connection
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.services.database = {
      status: 'healthy',
      latency: Date.now() - start,
    }
  } catch (error) {
    checks.services.database = {
      status: 'unhealthy',
      latency: 0,
    }
    hasErrors = true
    console.error('[Health Check] Database error:', error)
  }

  // Check Redis (optional)
  try {
    const redisAvailable = await isCacheAvailable()
    checks.services.redis = {
      status: redisAvailable ? 'healthy' : 'not_configured',
      available: redisAvailable,
    }
  } catch (error) {
    checks.services.redis = {
      status: 'error',
      available: false,
    }
    // Redis is optional, don't mark as error
    console.warn('[Health Check] Redis error:', error)
  }

  if (hasErrors) {
    checks.status = 'unhealthy'
    return NextResponse.json(checks, { status: 503 })
  }

  return NextResponse.json(checks, { status: 200 })
}
