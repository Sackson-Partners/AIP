import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCacheAvailable, redis } from '@/lib/redis'
import { aggregateHealth, type HealthCheckResult, logError } from '@/lib/monitoring'
import { logger } from '@/lib/logger'

/**
 * GET /api/health
 * Comprehensive health check endpoint for monitoring and uptime services
 *
 * Checks:
 * - Database connectivity and latency
 * - Redis cache availability
 * - Environment configuration
 * - External API connectivity (Resend, Azure)
 *
 * Returns:
 * - 200 if all systems operational
 * - 503 if critical services down
 * - 200 with degraded status if optional services unavailable
 */
// Cache health results for 10 seconds to prevent abuse
const HEALTH_CACHE_KEY = 'health:check:cache'
const HEALTH_CACHE_TTL = 10 // seconds

export async function GET() {
  // Check if we have a recent health result cached
  if (redis) {
    try {
      const cached = await redis.get(HEALTH_CACHE_KEY)
      if (cached) {
        const cachedResult = typeof cached === 'string' ? JSON.parse(cached) : cached
        return NextResponse.json(
          { ...cachedResult, cached: true },
          {
            status: cachedResult.status === 'healthy' ? 200 : 503,
            headers: {
              'Cache-Control': 'public, max-age=10',
              'X-Health-Cached': 'true'
            }
          }
        )
      }
    } catch {
      // Cache miss or error - continue with fresh check
    }
  }

  const startTime = Date.now()
  const healthChecks: HealthCheckResult[] = []

  // ─── Database Health Check (CRITICAL) ───────────────────────────────────────
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - dbStart

    // Also check if we can query actual tables
    const userCount = await prisma.user.count()

    healthChecks.push({
      service: 'database',
      status: dbLatency > 2000 ? 'degraded' : dbLatency > 1000 ? 'degraded' : 'healthy',
      latency: dbLatency,
      details: {
        connected: true,
        latencyMs: dbLatency,
        userCount,
        provider: 'PostgreSQL',
      },
    })
  } catch (error) {
    healthChecks.push({
      service: 'database',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
      details: { connected: false },
    })
    logError('Database health check failed', error instanceof Error ? error : undefined, {
      service: 'database',
    }, 'critical')
  }

  // ─── Redis Cache Health Check (OPTIONAL) ────────────────────────────────────
  try {
    const redisStart = Date.now()
    const redisAvailable = await isCacheAvailable()
    const redisLatency = Date.now() - redisStart

    // Use PING instead of SET/GET for lighter health check
    let operationalStatus = 'unknown'
    if (redisAvailable && redis) {
      try {
        const pingResult = await redis.ping()
        operationalStatus = pingResult === 'PONG' ? 'operational' : 'ping_failed'
      } catch {
        operationalStatus = 'operation_failed'
      }
    }

    healthChecks.push({
      service: 'redis',
      status: redisAvailable && operationalStatus === 'operational' ? 'healthy' : 'degraded',
      latency: redisLatency,
      details: {
        available: redisAvailable,
        operational: operationalStatus,
        optional: true,
        provider: 'Upstash Redis',
      },
    })
  } catch (error) {
    healthChecks.push({
      service: 'redis',
      status: 'degraded',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
      details: { optional: true },
    })
    logger.warn('Redis health check failed', { error: error instanceof Error ? error.message : 'Unknown' })
  }

  // ─── Email Service Configuration Check ──────────────────────────────────────
  const resendConfigured = !!(process.env.RESEND_API_KEY)
  const emailFromConfigured = !!(process.env.EMAIL_FROM)

  healthChecks.push({
    service: 'email',
    status: resendConfigured && emailFromConfigured ? 'healthy' : 'degraded',
    details: {
      provider: 'Resend',
      apiKeyConfigured: resendConfigured,
      fromAddressConfigured: emailFromConfigured,
      optional: false,
    },
  })

  // ─── Authentication Service Configuration ───────────────────────────────────
  const nextAuthConfigured = !!(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_URL)
  const azureAdConfigured = !!(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  )

  healthChecks.push({
    service: 'authentication',
    status: nextAuthConfigured ? 'healthy' : 'unhealthy',
    details: {
      nextAuthConfigured,
      azureAdConfigured,
      providers: ['credentials', azureAdConfigured ? 'azure-ad' : null].filter(Boolean),
    },
  })

  // ─── AI Service Configuration Check ──────────────────────────────────────────
  const anthropicConfigured = !!(process.env.ANTHROPIC_API_KEY)
  const openaiConfigured = !!(process.env.OPENAI_API_KEY)

  healthChecks.push({
    service: 'ai',
    status: anthropicConfigured || openaiConfigured ? 'healthy' : 'degraded',
    details: {
      anthropic: anthropicConfigured ? 'configured' : 'not_configured',
      openai: openaiConfigured ? 'configured' : 'not_configured',
      optional: true,
    },
  })

  // ─── Storage Configuration Check ─────────────────────────────────────────────
  const azureBlobConfigured = !!(
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    (process.env.AZURE_STORAGE_ACCOUNT_NAME && process.env.AZURE_STORAGE_ACCOUNT_KEY)
  )

  healthChecks.push({
    service: 'storage',
    status: azureBlobConfigured ? 'healthy' : 'degraded',
    details: {
      provider: 'Azure Blob Storage',
      configured: azureBlobConfigured,
      optional: true,
    },
  })

  // ─── System Metrics ──────────────────────────────────────────────────────────
  const totalLatency = Date.now() - startTime
  const nodeVersion = process.version
  const uptime = process.uptime()

  healthChecks.push({
    service: 'system',
    status: 'healthy',
    latency: totalLatency,
    details: {
      nodeVersion,
      uptimeSeconds: Math.floor(uptime),
      platform: process.platform,
      environment: process.env.NODE_ENV,
      totalCheckLatencyMs: totalLatency,
    },
  })

  // ─── Aggregate Overall Health Status ────────────────────────────────────────
  const health = aggregateHealth(healthChecks)
  const statusCode = health.overall === 'unhealthy' ? 503 : 200

  // Log degraded or unhealthy status
  if (health.overall !== 'healthy') {
    logger.warn('Health check returned non-healthy status', {
      overall: health.overall,
      unhealthyServices: health.checks
        .filter(c => c.status === 'unhealthy')
        .map(c => c.service),
      degradedServices: health.checks
        .filter(c => c.status === 'degraded')
        .map(c => c.service),
    })
  }

  const healthResult = {
    status: health.overall,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    checks: health.checks,
    summary: {
      total: health.checks.length,
      healthy: health.checks.filter(c => c.status === 'healthy').length,
      degraded: health.checks.filter(c => c.status === 'degraded').length,
      unhealthy: health.checks.filter(c => c.status === 'unhealthy').length,
    },
  }

  // Cache the result for 10 seconds
  if (redis) {
    try {
      await redis.setex(HEALTH_CACHE_KEY, HEALTH_CACHE_TTL, JSON.stringify(healthResult))
    } catch {
      // Non-critical - cache write failure doesn't affect health check
    }
  }

  return NextResponse.json(
    healthResult,
    {
      status: statusCode,
      headers: {
        'Cache-Control': 'public, max-age=10',
        'X-Health-Cached': 'false',
      },
    }
  )
}
