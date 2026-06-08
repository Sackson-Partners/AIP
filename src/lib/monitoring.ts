/**
 * Monitoring and Error Tracking
 *
 * Lightweight monitoring layer that can integrate with external services
 * (Sentry, DataDog, etc.) or log to console/database for now.
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorContext {
  userId?: string
  email?: string
  url?: string
  method?: string
  statusCode?: number
  requestId?: string
  userAgent?: string
  ipAddress?: string
  [key: string]: unknown
}

export interface MonitoringEvent {
  type: 'error' | 'warning' | 'info' | 'metric'
  severity: ErrorSeverity
  message: string
  error?: Error
  context?: ErrorContext
  timestamp: Date
}

/**
 * Log an error with context
 */
export function logError(
  message: string,
  error?: Error,
  context?: ErrorContext,
  severity: ErrorSeverity = 'medium'
): void {
  const event: MonitoringEvent = {
    type: 'error',
    severity,
    message,
    error,
    context,
    timestamp: new Date(),
  }

  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Monitoring] Error:', message)
    if (error) console.error('[Monitoring] Stack:', error.stack)
    if (context) console.error('[Monitoring] Context:', context)
  } else {
    // Production: log as structured JSON
    console.error(
      JSON.stringify({
        ...event,
        error: error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
      })
    )
  }

  // TODO: Send to external monitoring service (Sentry, DataDog, etc.)
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(error || new Error(message), { extra: context })
  // }
}

/**
 * Log a warning
 */
export function logWarning(message: string, context?: ErrorContext): void {
  const event: MonitoringEvent = {
    type: 'warning',
    severity: 'low',
    message,
    context,
    timestamp: new Date(),
  }

  console.warn(
    JSON.stringify({
      ...event,
    })
  )
}

/**
 * Log application metric
 */
export function logMetric(
  metric: string,
  value: number,
  unit: string,
  tags?: Record<string, string>
): void {
  const event = {
    type: 'metric',
    metric,
    value,
    unit,
    tags,
    timestamp: new Date(),
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Metric] ${metric}: ${value}${unit}`, tags || '')
  } else {
    console.log(JSON.stringify(event))
  }

  // TODO: Send to metrics service (DataDog, CloudWatch, etc.)
}

/**
 * Log slow query/operation
 */
export function logSlowOperation(
  operation: string,
  durationMs: number,
  threshold = 1000
): void {
  if (durationMs > threshold) {
    logWarning(`Slow operation detected: ${operation}`, {
      operation,
      durationMs,
      threshold,
    })
  }
}

/**
 * Measure operation duration
 */
export async function measureOperation<T>(
  name: string,
  operation: () => Promise<T>,
  warnThreshold = 1000
): Promise<T> {
  const start = Date.now()
  try {
    const result = await operation()
    const duration = Date.now() - start

    logMetric(name, duration, 'ms', { status: 'success' })
    logSlowOperation(name, duration, warnThreshold)

    return result
  } catch (error) {
    const duration = Date.now() - start
    logMetric(name, duration, 'ms', { status: 'error' })
    throw error
  }
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency?: number
  error?: string
  details?: Record<string, unknown>
}

/**
 * Aggregate health checks
 */
export function aggregateHealth(checks: HealthCheckResult[]): {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  checks: HealthCheckResult[]
} {
  const hasUnhealthy = checks.some((c) => c.status === 'unhealthy')
  const hasDegraded = checks.some((c) => c.status === 'degraded')

  return {
    overall: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
    checks,
  }
}

/**
 * Alert channel interface for future extensibility
 */
export interface AlertChannel {
  name: string
  send: (alert: {
    severity: ErrorSeverity
    title: string
    message: string
    context?: ErrorContext
  }) => Promise<void>
}

/**
 * Send alert (placeholder for Slack/PagerDuty integration)
 */
export async function sendAlert(
  severity: ErrorSeverity,
  title: string,
  message: string,
  context?: ErrorContext
): Promise<void> {
  // Log the alert
  logError(
    `ALERT [${severity.toUpperCase()}]: ${title} - ${message}`,
    undefined,
    context,
    severity
  )

  // TODO: Send to alerting service
  // if (process.env.SLACK_WEBHOOK_URL) {
  //   await fetch(process.env.SLACK_WEBHOOK_URL, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       text: `🚨 ${severity.toUpperCase()} Alert`,
  //       blocks: [
  //         { type: 'header', text: { type: 'plain_text', text: title } },
  //         { type: 'section', text: { type: 'mrkdwn', text: message } },
  //       ],
  //     }),
  //   })
  // }
}
