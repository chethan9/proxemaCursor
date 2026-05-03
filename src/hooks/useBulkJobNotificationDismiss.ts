import { useCallback, useEffect, useState } from "react";
import type { BulkJob } from "@/services/bulkJobService";

const STORAGE_KEY_PREFIX = "bulk-jobs-sidebar-dismissed-at";

export function readBulkJobDismissedAt(siteId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${siteId}`);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Matches sidebar badge rules: amber = pending/running; green = completed in last hour & after last dismiss. */
export function computeBulkJobSidebarBadgeCounts(jobs: BulkJob[], dismissedAtMs: number) {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let pending = 0;
  let recent = 0;
  for (const j of jobs) {
    if (j.status === "pending" || j.status === "running") pending++;
    else if (j.status === "completed" && j.completed_at) {
      const t = new Date(j.completed_at).getTime();
      if (t > oneHourAgo && t > dismissedAtMs) recent++;
    }
  }
  return { pending, recent };
}

export function useBulkJobNotificationDismiss(siteId: string | undefined) {
  const [dismissedAt, setDismissedAt] = useState(0);

  const refresh = useCallback(() => {
    if (!siteId) {
      setDismissedAt(0);
      return;
    }
    setDismissedAt(readBulkJobDismissedAt(siteId));
  }, [siteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSync = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (siteId && e.key === `${STORAGE_KEY_PREFIX}:${siteId}`) refresh();
    };
    window.addEventListener("bulk-jobs-sidebar-dismiss", onSync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("bulk-jobs-sidebar-dismiss", onSync);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh, siteId]);

  const dismiss = useCallback(() => {
    if (!siteId || typeof window === "undefined") return;
    const now = Date.now();
    localStorage.setItem(`${STORAGE_KEY_PREFIX}:${siteId}`, String(now));
    setDismissedAt(now);
    window.dispatchEvent(new Event("bulk-jobs-sidebar-dismiss"));
  }, [siteId]);

  return { dismissedAt, dismiss };
}
