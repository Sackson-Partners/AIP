import * as Sentry from "@sentry/nextjs";
import { browserTracingIntegration } from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  tracesSampleRate: 1.0,
  integrations: [browserTracingIntegration()],
  tracePropagationTargets: [
    "localhost",
    process.env.NEXT_PUBLIC_API_URL || "",
  ],
  // Only initialize when DSN is present
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
