"use client";
import Link from "next/link";
import { AlertTriangle, Lock, Clock } from "lucide";
import { useSubscription } from "@clerk/nextjs";

export function SubscriptionStatusBanner() {
  const { subscription: sub } = useSubscription();
  if (!sub) return null;
  const eff = effectiveStatus(sub);

  if (eff === "expired") {
    return (
      <div className="flex items-center justify-between p-4 bg-red-50 text-red-800 border-b border-red-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>Your subscription has expired.</span>
        </div>
        <Link href="/dashboard/billing" className="text-sm text-red-800">
          Renew subscription
        </Link>
      </div>
    );
  }

  if (eff === "active") {
    return (
      <div className="flex items-center justify-between p-4 bg-green-50 text-green-800 border-b border-green-200">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          <span>Your subscription is active.</span>
        </div>
        <Link href="/dashboard/billing" className="text-sm text-green-800">
          Manage subscription
        </Link>
      </div>
    );
  }

  if (eff === "trial") {
    return (
      <div className="flex items-center justify-between p-4 bg-blue-50 text-blue-800 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          <span>Your trial is active.</span>
        </div>
        <Link href="/dashboard/billing" className="text-sm text-blue-800">
          Pay invoice
        </Link>
      </div>
    );
  }

  return null;
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 2820 chars.]