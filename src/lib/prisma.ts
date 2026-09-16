import { PrismaClient } from '@prisma/client'
import { dealRoomPasswordMiddleware } from './prisma-middleware/dealroom-password'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' },
          ]
        : [{ level: 'error', emit: 'event' }],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
          ? `${process.env.DATABASE_URL}${process.env.DATABASE_URL.includes('?') ? '&' : '?'}connection_limit=20&pool_timeout=30`
          : undefined,
      },
    },
  })

  // Log slow queries in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query' as never, (e: { duration: number; query: string }) => {
      if (e.duration > 500) {
        console.warn(`⚠️  Slow query (${e.duration}ms): ${e.query.substring(0, 100)}...`)
      }
    })
  }

  // Log database errors always
  client.$on('error' as never, (e: { message: string }) => {
    console.error('❌ Database error:', e.message)
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Add DealRoom password hashing middleware (defense-in-depth)
if (typeof prisma.$use === 'function') {
  prisma.$use(dealRoomPasswordMiddleware())
}

// Add query timeout middleware
if (typeof prisma.$use === 'function') {
  prisma.$use(async (params, next) => {
    const before = Date.now()
    const result = await next(params)
    const after = Date.now()

    if (after - before > 5000) {
      console.warn(
        `⚠️  Slow Prisma operation: ${params.model}.${params.action} took ${after - before}ms`
      )
    }

    return result
  })
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
