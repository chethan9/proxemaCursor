import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const enabled = process.env.NODE_ENV === "production" && !!dsn;

if (enabled) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    initialScope: { tags: { runtime: "edge" } },
  });
}