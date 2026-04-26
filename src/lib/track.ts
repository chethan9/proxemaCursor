import { capturePostHogEvent } from "@/lib/posthog";

export type TrackedEvent =
  | "site_connected"
  | "sync_started"
  | "sync_completed"
  | "subscription_created"
  | "subscription_canceled"
  | "template_printed"
  | "bulk_job_started"
  | "signup_completed";

export function track(event: TrackedEvent, props?: Record<string, unknown>): void {
  capturePostHogEvent(event, props);
}