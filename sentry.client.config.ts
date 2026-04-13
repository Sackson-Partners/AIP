import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "production",
  // Capture 10% of transactions in production; 100% in dev
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Only initialize when DSN is present
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
