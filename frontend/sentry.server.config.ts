import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "",

  tracesSampleRate: isProduction ? 0.1 : 1,
  sendDefaultPii: false,
  debug: false,
});
