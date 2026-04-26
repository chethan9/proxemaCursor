<![CDATA[
import { capturePostHogEvent } from "@/lib/posthog";

export type TrackedEvent =
  | "site_co
...
ent: TrackedEvent, props?: Record<string, unknown>): void {
  capturePostHogEvent(event, props);
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 524 chars.]