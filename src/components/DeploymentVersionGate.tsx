import { useEffect } from "react";
import { clearPersistedCache } from "@/lib/query-persistence";

const STORAGE_KEY = "woosync-deploy-id";
const SESSION_ATTEMPTS_KEY = "woosync-deploy-reload-attempts";
const POLL_MS = 5 * 60 * 1000;
const MAX_RELOAD_ATTEMPTS = 2;

function getClientBuildId(): string {
  return process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() || "";
}

/**
 * Reloads once when the deployed build changes so users pick up new JS/CSS without a manual hard refresh.
 * Polls periodically so long-lived tabs detect deploys while open.
 */
export function DeploymentVersionGate() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const current = getClientBuildId();
    if (!current) return;

    const bumpReloadGuard = (): boolean => {
      const attempts = parseInt(sessionStorage.getItem(SESSION_ATTEMPTS_KEY) || "0", 10);
      if (attempts >= MAX_RELOAD_ATTEMPTS) return false;
      sessionStorage.setItem(SESSION_ATTEMPTS_KEY, String(attempts + 1));
      return true;
    };

    const reloadForNewVersion = (newId: string) => {
      if (!newId || !bumpReloadGuard()) return;
      clearPersistedCache();
      localStorage.setItem(STORAGE_KEY, newId);
      window.location.reload();
    };

    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === null) {
      localStorage.setItem(STORAGE_KEY, current);
      sessionStorage.removeItem(SESSION_ATTEMPTS_KEY);
    } else if (stored !== current) {
      reloadForNewVersion(current);
      return;
    } else {
      sessionStorage.removeItem(SESSION_ATTEMPTS_KEY);
    }

    const poll = async () => {
      try {
        const res = await fetch("/api/build-info", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        const serverId = data.buildId?.trim();
        if (!serverId || serverId === current) return;
        reloadForNewVersion(serverId);
      } catch {
        /* network errors — skip until next interval */
      }
    };

    const interval = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return null;
}
