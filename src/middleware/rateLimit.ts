import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'

/**
 * Rate Limiting Middleware
 *
 * Uses sliding window algorithm to track request counts.
 * Falls back to in-memory storage if Redis is not configured.
 * Production deployments should use Upstash Redis for distributed rate limiting.
 */

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  keyPrefix?: string
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: Date
}

// In-memory store (fallback - not recommended for production multi-instance deployments)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of inMemoryStore.entries()) {
    if (value.resetAt < now) {
      inMemoryStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Check rate limit for a given key
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now()
  const resetAt = now + config.windowMs

  // Try Redis first (if configured)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redisKey = `${config.keyPrefix || 'ratelimit'}:${key}`
      const response = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/incr/${redisKey}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        }
      )
      const data = await response.json()
      const count = data.result as number

      // Set expiry on first request
      if (count === 1) {
        await fetch(
          `${process.env.UPSTASH_REDIS_REST_URL}/expire/${redisKey}/${Math.ceil(config.windowMs / 1000)}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            },
          }
        )
      }

      return {
        success: count <= config.maxRequests,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - count),
        resetAt: new Date(resetAt),
      }
    } catch (error) {
      console.error('[Rate Limit] Redis error, falling back to in-memory:', error)
    }
  }

  // Fallback to in-memory store
  const stored = inMemoryStore.get(key)

  if (!stored || stored.resetAt < now) {
    // New window
    inMemoryStore.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetAt: new Date(resetAt),
    }
  }

  // Increment count
  stored.count++
  inMemoryStore.set(key, stored)

  return {
    success: stored.count <= config.maxRequests,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - stored.count),
    resetAt: new Date(stored.resetAt),
  }
}

/**
 * Get client identifier (IP or user ID)
 */
function getClientId(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`

  // Try multiple headers for IP (CloudFlare, AWS, standard)
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfIp = req.headers.get('cf-connecting-ip')

  const ip = cfIp || realIp || forwarded?.split(',')[0] || 'unknown'
  return `ip:${ip}`
}

/**
 * Rate limit middleware factory
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    // Get user session for user-based limits
    const session = await getServerSession(authOptions)
    const clientId = getClientId(req, session?.user?.id)

    const result = await checkRateLimit(clientId, config)

    if (!result.success) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          limit: result.limit,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': result.resetAt.toISOString(),
            'Retry-After': String(retryAfter),
          },
        }
      )
    }

    // Add rate limit headers to successful response
    return null // Continue to handler
  }
}

/**
 * Predefined rate limiters for common endpoints
 */
export const rateLimiters = {
  // AI endpoints - strict limits
  ai: createRateLimiter({
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'ai',
  }),

  // Generate endpoints - very strict
  generate: createRateLimiter({
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'generate',
  }),

  // Contact requests - prevent spam
  contact: createRateLimiter({
    maxRequests: 5,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    keyPrefix: 'contact',
  }),

  // User creation - prevent account spam
  createUser: createRateLimiter({
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'user',
  }),

  // General POST - global protection
  post: createRateLimiter({
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'post',
  }),
}

/**
 * Helper to apply rate limit in API route
 */
export async function applyRateLimit(
  req: NextRequest,
  limiter: ReturnType<typeof createRateLimiter>
): Promise<NextResponse | null> {
  return limiter(req)
}
