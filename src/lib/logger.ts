import * as Sentry from "@sentry/nextjs"

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[INFO] ${message}`, data ?? "") // eslint-disable-line no-console
    }
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[WARN] ${message}`, data ?? "") // eslint-disable-line no-console
    }
  },
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[ERROR] ${message}`, error ?? "", data ?? "") // eslint-disable-line no-console
    }
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { message, ...data } })
    }
  },
}
