import { NextRequest, NextResponse } from 'next/server'

// In-memory fallback for environments without Upstash Redis (local dev)
const ipHits = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const MAX_REQUESTS = 5

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function authRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(req)
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
        limiter: Ratelimit.slidingWindow(MAX_REQUESTS, '5 m'),
        prefix: 'aip:auth:rl',
      })
      const { success, reset } = await ratelimit.limit(ip)
      if (!success) {
        const retryAfter = Math.ceil((reset - now) / 1000)
        return NextResponse.json(
          { error: 'Too many sign-in attempts. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
      return null
    } catch {
      // Redis unavailable — fall through to in-memory
    }
  }

  // In-memory fallback
  const record = ipHits.get(ip)
  if (!record || now > record.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }
  record.count++
  if (record.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many sign-in attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }
  return null
}
