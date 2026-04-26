import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const enabled = process.env.NODE_ENV === "production" && !!dsn;

if (enabled) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    initialScope: { tags: { runtime: "server" } },
    beforeSend(event) {
      return scrubPII(event);
    },
  });
}

function scrubPII(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request?.headers) {
    delete event.request.headers["authorization"];
    delete event.request.headers["cookie"];
  }
  if (event.request?.cookies) {
    event.request.cookies = {};
  }
  return event;
}