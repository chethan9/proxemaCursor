<![CDATA[
import posthog, { type PostHog } from "posthog-js";

let initialized = false;

export function initPostHog
...
ot;
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    /* ignore */
  }
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 1530 chars.]