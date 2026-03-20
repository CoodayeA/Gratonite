import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://c62e650d923cbdd94d1b7f2af221a350@o4511074273329152.ingest.us.sentry.io/4511074559066112",
  release: `gratonite-api@${process.env.npm_package_version || '0.0.0'}`,
  environment: process.env.NODE_ENV || "production",
  enabled: process.env.NODE_ENV !== 'test' && process.env.CI !== 'true',

  sendDefaultPii: true,

  // Tracing — 20% of requests in production
  tracesSampleRate: 0.2,
});
