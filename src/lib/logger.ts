import * as Sentry from "@sentry/nextjs"

/**
 * Enhanced Structured Logger with PII Sanitization
 *
 * Features:
 * - Structured logging with context metadata
 * - PII field masking for GDPR compliance
 * - Sentry integration for error tracking
 * - Environment-aware logging
 * - Request context support (userId, requestId, etc.)
 */

// PII fields that should be masked in logs
const PII_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'resetToken',
  'verificationToken',
  'twoFactorSecret',
  'apiKey',
  'secretKey',
  'privateKey',
  'ssn',
  'socialSecurityNumber',
  'creditCard',
  'cardNumber',
  'cvv',
  'pin',
]

// Sensitive fields that should be partially masked (show first/last chars)
const SENSITIVE_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'ipAddress',
  'ip',
]

/**
 * Mask PII fields in an object
 */
function sanitizePII(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()

    // Check if this is a PII field (full masking)
    if (PII_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]'
      continue
    }

    // Check if this is a sensitive field (partial masking)
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      if (typeof value === 'string' && value.length > 4) {
        // Email: show first char and domain (j***@example.com)
        if (lowerKey.includes('email') && value.includes('@')) {
          const [local, domain] = value.split('@')
          sanitized[key] = `${local[0]}***@${domain}`
        }
        // Phone/IP: show last 4 chars (***1234)
        else {
          sanitized[key] = `***${value.slice(-4)}`
        }
      } else {
        sanitized[key] = '[MASKED]'
      }
      continue
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizePII(value as Record<string, unknown>)
    }
    // Recursively sanitize arrays
    else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? sanitizePII(item as Record<string, unknown>)
          : item
      )
    }
    // Keep safe values as-is
    else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Format log message with timestamp and context
 */
function formatLog(
  level: string,
  message: string,
  context?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString()
  const sanitizedContext = context ? sanitizePII(context) : {}

  return JSON.stringify({
    timestamp,
    level,
    message,
    ...sanitizedContext,
  })
}

/**
 * Log to console in development, structured format in production
 */
function logToConsole(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === 'development') {
    const prefix = `[${level.toUpperCase()}]`
    if (context) {
      console[level](prefix, message, context)
    } else {
      console[level](prefix, message)
    }
  } else {
    // Production: structured JSON logs
    console.log(formatLog(level.toUpperCase(), message, context))
  }
}

/**
 * Log to Sentry with context
 */
function logToSentry(
  level: 'info' | 'warning' | 'error',
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): void {
  const sanitizedContext = context ? sanitizePII(context) : {}

  if (error instanceof Error) {
    Sentry.captureException(error, {
      level,
      extra: { message, ...sanitizedContext },
    })
  } else {
    Sentry.captureMessage(message, {
      level,
      extra: sanitizedContext,
    })
  }
}

/**
 * Enhanced logger interface
 */
export const logger = {
  /**
   * Log informational message
   * @param message - Log message
   * @param context - Additional context (will be PII-sanitized)
   */
  info: (message: string, context?: Record<string, unknown>): void => {
    logToConsole('info', message, context)
  },

  /**
   * Log warning message
   * @param message - Warning message
   * @param context - Additional context (will be PII-sanitized)
   */
  warn: (message: string, context?: Record<string, unknown>): void => {
    logToConsole('warn', message, context)
    // Send warnings to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      logToSentry('warning', message, undefined, context)
    }
  },

  /**
   * Log error message
   * @param message - Error message
   * @param error - Error object or unknown error
   * @param context - Additional context (will be PII-sanitized)
   */
  error: (message: string, error?: unknown, context?: Record<string, unknown>): void => {
    logToConsole('error', message, { ...context, error })
    logToSentry('error', message, error, context)
  },

  /**
   * Log with custom level and full control
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context (will be PII-sanitized)
   */
  log: (
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    context?: Record<string, unknown>
  ): void => {
    if (level === 'debug' && process.env.NODE_ENV !== 'development') {
      return // Skip debug logs in production
    }

    logToConsole(level === 'debug' ? 'info' : level, message, context)

    if (level === 'error' && process.env.NODE_ENV === 'production') {
      logToSentry('error', message, undefined, context)
    }
  },

  /**
   * Create a logger with persistent context
   * Useful for adding userId, requestId, etc. to all logs
   */
  withContext: (persistentContext: Record<string, unknown>) => ({
    info: (message: string, context?: Record<string, unknown>) =>
      logger.info(message, { ...persistentContext, ...context }),
    warn: (message: string, context?: Record<string, unknown>) =>
      logger.warn(message, { ...persistentContext, ...context }),
    error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
      logger.error(message, error, { ...persistentContext, ...context }),
    log: (level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: Record<string, unknown>) =>
      logger.log(level, message, { ...persistentContext, ...context }),
  }),
}

/**
 * Create request-scoped logger with userId and requestId
 * Usage in API routes:
 *
 * const reqLogger = createRequestLogger(req, session)
 * reqLogger.info('Processing request')
 * reqLogger.error('Request failed', error)
 */
export function createRequestLogger(
  req: { headers: Headers; url?: string },
  session?: { user?: { id?: string; email?: string } }
) {
  const requestId = req.headers.get('x-request-id') ?? `req_${Date.now()}`
  const userId = session?.user?.id
  const userEmail = session?.user?.email

  return logger.withContext({
    requestId,
    userId,
    userEmail,
    path: req.url,
  })
}

/**
 * Export sanitizePII for manual use
 */
export { sanitizePII }
