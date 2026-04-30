"use client";

import { useAppSettings } from "@/hooks/queries/useAppSettings";
import { FlaskConical } from "lucide-react";

/**
 * Shown for all users when super admin enables billing dev mode (global QA bypass).
 */
export function BillingDevModeBanner() {
  const { settings, isLoading } = useAppSettings();
  if (isLoading || !settings.billingDevMode) return null;
  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 text-amber-950 px-3 py-2 text-center text-sm"
    >
      <span className="inline-flex items-center justify-center gap-2 font-medium">
        <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
        Developer mode: plan, subscription, and quota checks are paused for testing.
      </span>
    </div>
  );
}
