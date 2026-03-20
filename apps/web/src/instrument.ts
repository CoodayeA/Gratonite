import * as Sentry from "@sentry/react";

// Expose for console testing
(window as any).Sentry = Sentry;

Sentry.init({
  dsn: "https://06e4ca4d04c520405630f744f70700b1@o4511074273329152.ingest.us.sentry.io/4511074372616192",
  release: `gratonite-web@${import.meta.env.VITE_APP_VERSION || '0.0.0'}`,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,

  sendDefaultPii: true,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Tracing — 20% sample in production
  tracesSampleRate: 0.2,
  tracePropagationTargets: ["localhost", /^https:\/\/api\.gratonite\.chat/],

  // Session Replay — record on errors only to save quota
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
