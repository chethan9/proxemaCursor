import posthog from "posthog-js";

let initialized = false;

export function initPostHog(): void {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (process.env.NODE_ENV !== "production") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!key) return;
  try {
    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      persistence: "localStorage+cookie",
      person_profiles: "identified_only",
    });
    initialized = true;
  } catch {
    /* ignore */
  }
}

export function capturePostHogPageView(url: string): void {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  try {
    posthog.capture("$pageview", { $current_url: url });
  } catch {
    /* ignore */
  }
}

export function capturePostHogEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  try {
    posthog.capture(name, props);
  } catch {
    /* ignore */
  }
}

export function identifyPostHogUser(userId: string, traits?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  try {
    posthog.identify(userId, traits);
  } catch {
    /* ignore */
  }
}

export function resetPostHogUser(): void {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    /* ignore */
  }
}