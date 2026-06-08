import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logError } from '@/lib/monitoring'

/**
 * Global error boundary for API routes
 * Wrap API handlers with this to catch and log unhandled errors
 */
export function withErrorHandler<T>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      return await handler(req, context)
    } catch (error) {
      // Log the error with context
      logError(
        'Unhandled API error',
        error instanceof Error ? error : new Error(String(error)),
        {
          url: req.url,
          method: req.method,
          headers: Object.fromEntries(req.headers.entries()),
        },
        'high'
      )

      // Return generic error response
      return NextResponse.json(
        {
          error: 'Internal server error',
          message:
            process.env.NODE_ENV === 'development' && error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends Error {
  constructor(message = 'Too many requests') {
    super(message)
    this.name = 'RateLimitError'
  }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/**
 * Enhanced error handler with custom error types
 */
export function withEnhancedErrorHandler<T>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      return await handler(req, context)
    } catch (error) {
      // Handle custom error types
      if (error instanceof RateLimitError) {
        return NextResponse.json({ error: error.message }, { status: 429 })
      }

      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: error.message, details: error.details },
          { status: 422 }
        )
      }

      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }

      // Log unexpected errors
      logError(
        'Unhandled API error',
        error instanceof Error ? error : new Error(String(error)),
        {
          url: req.url,
          method: req.method,
        },
        'high'
      )

      return NextResponse.json(
        {
          error: 'Internal server error',
          message:
            process.env.NODE_ENV === 'development' && error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
        },
        { status: 500 }
      )
    }
  }
}
