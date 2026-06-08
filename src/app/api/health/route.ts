import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCacheAvailable } from '@/lib/redis'
import { aggregateHealth, type HealthCheckResult, logError } from '@/lib/monitoring'

/**
 * GET /api/health
 * Health check endpoint for monitoring and uptime services
 * Returns 200 if all systems operational, 503 if critical services down
 */
export async function GET() {
  const healthChecks: HealthCheckResult[] = []

  // Check database connection
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - start

    healthChecks.push({
      service: 'database',
      status: latency > 1000 ? 'degraded' : 'healthy',
      latency,
    })
  } catch (error) {
    healthChecks.push({
      service: 'database',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    logError('Database health check failed', error instanceof Error ? error : undefined, {
      service: 'database',
    }, 'critical')
  }

  // Check Redis (optional)
  try {
    const redisAvailable = await isCacheAvailable()
    healthChecks.push({
      service: 'redis',
      status: redisAvailable ? 'healthy' : 'degraded',
      details: { available: redisAvailable, optional: true },
    })
  } catch (error) {
    healthChecks.push({
      service: 'redis',
      status: 'degraded',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: { optional: true },
    })
  }

  // Check AI service configuration
  healthChecks.push({
    service: 'ai',
    status: 'healthy',
    details: {
      anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured',
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
    },
  })

  // Aggregate health status
  const health = aggregateHealth(healthChecks)
  const statusCode = health.overall === 'unhealthy' ? 503 : 200

  return NextResponse.json(
    {
      status: health.overall,
      timestamp: new Date().toISOString(),
      checks: health.checks,
    },
    { status: statusCode }
  )
}
