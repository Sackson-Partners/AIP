import { NextRequest, NextResponse } from 'next/server'

// In-memory fallback for environments without Upstash Redis (local dev)
const ipHits = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// Tiered rate limiter configurations
type RateLimiterConfig = {
  requests: number
  window: string
  prefix: string
  errorMessage: string
}

export const rateLimiters = {
  // Expensive AI operations (EIN/PIS generation, chat)
  generate: {
    requests: 5,
    window: '1 h',
    prefix: 'aip:generate:rl',
    errorMessage: 'Too many generation requests. Limit: 5 per hour.'
  } as RateLimiterConfig,

  // Expensive chat operations
  chat: {
    requests: 20,
    window: '1 h',
    prefix: 'aip:chat:rl',
    errorMessage: 'Too many chat messages. Limit: 20 per hour.'
  } as RateLimiterConfig,

  // Standard write operations (POST/PATCH/DELETE)
  write: {
    requests: 100,
    window: '15 m',
    prefix: 'aip:write:rl',
    errorMessage: 'Too many write requests. Limit: 100 per 15 minutes.'
  } as RateLimiterConfig,

  // Read operations (GET)
  read: {
    requests: 300,
    window: '15 m',
    prefix: 'aip:read:rl',
    errorMessage: 'Too many read requests. Limit: 300 per 15 minutes.'
  } as RateLimiterConfig,

  // Contact/support requests
  contact: {
    requests: 3,
    window: '1 h',
    prefix: 'aip:contact:rl',
    errorMessage: 'Too many contact requests. Limit: 3 per hour.'
  } as RateLimiterConfig,

  // Auth operations (sign-in)
  auth: {
    requests: 5,
    window: '5 m',
    prefix: 'aip:auth:rl',
    errorMessage: 'Too many sign-in attempts. Please try again later.'
  } as RateLimiterConfig,
}

// Generic rate limiter using Upstash Redis or in-memory fallback
async function rateLimit(
  identifier: string,
  config: RateLimiterConfig
): Promise<{ success: boolean; reset: number }> {
  const now = Date.now()

  // Use Upstash Redis if configured
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const { Redis } = await import('@upstash/redis')
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        prefix: config.prefix,
      })
      const result = await ratelimit.limit(identifier)
      return { success: result.success, reset: result.reset }
    } catch {
      // Redis unavailable — fall through to in-memory
    }
  }

  // In-memory fallback
  const key = `${config.prefix}:${identifier}`
  const windowMs = parseWindowToMs(config.window)
  const record = ipHits.get(key)

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs
    ipHits.set(key, { count: 1, resetAt })
    return { success: true, reset: resetAt }
  }

  record.count++
  const success = record.count <= config.requests
  return { success, reset: record.resetAt }
}

// Helper: parse window string to milliseconds
function parseWindowToMs(window: string): number {
  const match = window.match(/^(\d+)\s*(m|h|d)$/)
  if (!match) return 5 * 60 * 1000 // default 5 minutes
  const [, num, unit] = match
  const value = parseInt(num, 10)
  switch (unit) {
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    default: return 5 * 60 * 1000
  }
}

// Apply rate limit with helper function
export async function applyRateLimit(
  req: NextRequest,
  config: RateLimiterConfig,
  userId?: string
): Promise<NextResponse | null> {
  const identifier = userId || getClientIp(req)
  const { success, reset } = await rateLimit(identifier, config)

  if (!success) {
    const now = Date.now()
    const retryAfter = Math.ceil((reset - now) / 1000)
    return NextResponse.json(
      { error: config.errorMessage },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.requests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(reset / 1000))
        }
      }
    )
  }

  return null
}

// Legacy auth rate limiter (backward compatibility)
export async function authRateLimit(req: NextRequest): Promise<NextResponse | null> {
  return applyRateLimit(req, rateLimiters.auth)
}
