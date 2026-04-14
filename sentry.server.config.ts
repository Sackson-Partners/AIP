import * as Sentry from "@sentry/nextjs";
import { httpIntegration } from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.ENVIRONMENT,
  release: process.env.APP_VERSION,
  tracesSampleRate: 1.0,
  integrations: [httpIntegration()],
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
