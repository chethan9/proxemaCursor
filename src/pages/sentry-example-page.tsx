import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import Head from "next/head";

export default function SentryExamplePage() {
  const [hasSentError, setHasSentError] = useState(false);

  return (
    <>
      <Head>
        <title>Sentry Test</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 space-y-4">
          <h1 className="text-xl font-semibold">Sentry test page</h1>
          <p className="text-sm text-muted-foreground">
            Click the button below to throw a client-side error. Check your Sentry Issues feed
            after a few seconds to confirm reporting works.
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90"
            onClick={() => {
              try {
                throw new Error(`Sentry test error fired at ${new Date().toISOString()}`);
              } catch (err) {
                Sentry.captureException(err);
                setHasSentError(true);
                setTimeout(() => {
                  throw err;
                }, 50);
              }
            }}
          >
            Throw test error
          </button>
          {hasSentError && (
            <p className="text-xs text-success">
              Error captured. Check Sentry → Issues feed.
            </p>
          )}
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent"
            onClick={() => {
              // @ts-expect-error - intentional undefined function call
              myUndefinedFunction();
            }}
          >
            Call undefined function (uncaught)
          </button>
        </div>
      </div>
    </>
  );
}