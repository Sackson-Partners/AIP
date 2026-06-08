import { Redis } from '@upstash/redis'

// Upstash Redis client for caching
// Configure via environment variables:
// UPSTASH_REDIS_REST_URL - Redis REST URL from Upstash console
// UPSTASH_REDIS_REST_TOKEN - Redis REST token from Upstash console

let redis: Redis | null = null

export function getRedis(): Redis | null {
  // Return null if not configured (graceful degradation)
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Redis] Not configured - caching disabled. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN')
    }
    return null
  }

  // Singleton pattern - reuse connection
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }

  return redis
}

// Cache helper functions

/**
 * Get cached value with type safety
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const value = await redis.get<T>(key)
    if (value !== null) {
      console.log(`[Redis] Cache HIT: ${key}`)
    }
    return value
  } catch (error) {
    console.error(`[Redis] Get error for key ${key}:`, error)
    return null
  }
}

/**
 * Set cached value with TTL (in seconds)
 */
export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
    console.log(`[Redis] Cache SET: ${key} (TTL: ${ttlSeconds}s)`)
    return true
  } catch (error) {
    console.error(`[Redis] Set error for key ${key}:`, error)
    return false
  }
}

/**
 * Delete cached value(s)
 * Supports wildcards with pattern matching
 */
export async function deleteCached(keyOrPattern: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0

  try {
    // If pattern contains wildcard, use scan + delete
    if (keyOrPattern.includes('*')) {
      let cursor = 0
      let deletedCount = 0

      do {
        const [newCursor, keys] = await redis.scan(cursor, {
          match: keyOrPattern,
          count: 100,
        })
        cursor = newCursor

        if (keys.length > 0) {
          const deleted = await redis.del(...keys)
          deletedCount += deleted
        }
      } while (cursor !== 0)

      console.log(`[Redis] Cache DELETE pattern ${keyOrPattern}: ${deletedCount} keys`)
      return deletedCount
    } else {
      // Single key deletion
      const deleted = await redis.del(keyOrPattern)
      console.log(`[Redis] Cache DELETE: ${keyOrPattern}`)
      return deleted
    }
  } catch (error) {
    console.error(`[Redis] Delete error for ${keyOrPattern}:`, error)
    return 0
  }
}

/**
 * Check if cache is available
 */
export async function isCacheAvailable(): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false

  try {
    await redis.ping()
    return true
  } catch {
    return false
  }
}

// Cache key builders for consistency

export const CacheKeys = {
  projects: {
    list: () => 'projects:list',
    detail: (id: string) => `projects:detail:${id}`,
  },
  investors: {
    list: () => 'investors:list',
    detail: (id: string) => `investors:detail:${id}`,
    matches: (id: string) => `investors:matches:${id}`,
  },
  pestel: {
    assessment: (projectId: string) => `pestel:assessment:${projectId}`,
    calculation: (assessmentId: string) => `pestel:calc:${assessmentId}`,
  },
  pis: {
    detail: (id: string) => `pis:detail:${id}`,
  },
  dataRooms: {
    list: () => 'datarooms:list',
    detail: (projectId: string) => `datarooms:detail:${projectId}`,
  },
}

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 900,           // 15 minutes
  VERY_LONG: 3600,     // 1 hour
}
