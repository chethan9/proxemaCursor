"use client";
import Link from "next/link";
import { AlertTriangle, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/queries/useSubscription";

const DAY_MS = 86400_000;

export function SubscriptionStatusBanner() {
  const { subscription: sub, effectiveStatus, daysUntilLock } = useSubscription();
  if (!sub) return null;

  if (effectiveStatus === "locked") {
    return (
      <div className="bg-rose-50 border-b border-rose-200 text-rose-900 px-4 py-2.5 flex items-center gap-3 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200">
        <Lock className="h-4 w-4 shrink-0" />
        <div className="flex-1 text-sm">
          <strong className="font-semibold">Account locked.</strong> Pay your outstanding invoice to restore access.
        </div>
        <Button size="sm" asChild>
          <Link href="/billing">Pay now</Link>
        </Button>
      </div>
    );
  }

  if (effectiveStatus === "past_due") {
    const days = daysUntilLock ?? 0;
    return (
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 flex items-center gap-3 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <div className="flex-1 text-sm">
          <strong className="font-semibold">Payment overdue.</strong>{" "}
          {days <= 0 ? "Account will be locked today." : `${days} day${days === 1 ? "" : "s"} until account is locked.`}
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/billing">Resolve</Link>
        </Button>
      </div>
    );
  }

  const s = sub as unknown as { status?: string; renewal_mode?: string; current_period_end?: string };
  if (s.status === "active" && s.renewal_mode === "manual" && s.current_period_end) {
    const daysToEnd = Math.ceil((new Date(s.current_period_end).getTime() - Date.now()) / DAY_MS);
    if (daysToEnd > 0 && daysToEnd <= 3) {
      return (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 flex items-center gap-3 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200">
          <Clock className="h-4 w-4 shrink-0" />
          <div className="flex-1 text-sm">
            <strong className="font-semibold">Renewal due in {daysToEnd} day{daysToEnd === 1 ? "" : "s"}.</strong> Pay your invoice to avoid service interruption.
          </div>
          <Button size="sm" asChild>
            <Link href="/billing">View invoice</Link>
          </Button>
        </div>
      );
    }
  }

  return null;
}