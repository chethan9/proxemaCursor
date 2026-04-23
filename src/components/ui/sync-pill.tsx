"use client";
import { Loader2, Check, AlertCircle, Cloud, CloudCheck } from "lucide-react";
import { useMutationStatus, type MutationStatus } from "@/contexts/RecentMutationsProvider";
import { cn } from "@/lib/utils";

interface Props {
  entityType: string;
  entityId: string | null | undefined;
  className?: string;
}

const CONFIG: Record<MutationStatus, { Icon: typeof Loader2; label: string; cls: string; spin?: boolean }> = {
  saving: {
    Icon: Loader2,
    label: "Saving…",
    cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    spin: true,
  },
  saved: {
    Icon: Check,
    label: "Saved",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  },
  syncing: {
    Icon: Cloud,
    label: "Syncing to Woo",
    cls: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
    spin: true,
  },
  synced: {
    Icon: CloudCheck,
    label: "Woo confirmed",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  },
  failed: {
    Icon: AlertCircle,
    label: "Sync failed",
    cls: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
  },
};

export function SyncPill({ entityType, entityId, className }: Props) {
  const m = useMutationStatus(entityType, entityId);
  if (!m) return null;
  const c = CONFIG[m.status];
  const Icon = c.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-medium ring-1 ring-inset transition-all animate-in fade-in duration-300",
        c.cls,
        className
      )}
      title={m.error || c.label}
    >
      <Icon className={cn("h-2.5 w-2.5 shrink-0", c.spin && "animate-spin")} />
      {c.label}
    </span>
  );
}