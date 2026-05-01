"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
import { clearPersistedCache } from "@/lib/query-persistence";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "woosync-deploy-id";
const SESSION_ATTEMPTS_KEY = "woosync-deploy-reload-attempts";
const POLL_MS = 5 * 60 * 1000;
const MAX_RELOAD_ATTEMPTS = 2;

function getClientBuildId(): string {
  return process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() || "";
}

function bumpReloadGuard(): boolean {
  const attempts = parseInt(sessionStorage.getItem(SESSION_ATTEMPTS_KEY) || "0", 10);
  if (attempts >= MAX_RELOAD_ATTEMPTS) return false;
  sessionStorage.setItem(SESSION_ATTEMPTS_KEY, String(attempts + 1));
  return true;
}

/**
 * When the server reports a newer build than this tab's bundle, shows a non-dismissible dialog.
 * User must click Refresh to reload (same path as before: clear persisted query cache + full reload).
 */
export function DeploymentVersionGate() {
  const { t } = useTranslation("common");
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingServerId, setPendingServerId] = useState<string | null>(null);
  const [reloadBlocked, setReloadBlocked] = useState(false);

  const checkServer = useCallback(async () => {
    const current = getClientBuildId();
    if (!current) return;
    try {
      const res = await fetch("/api/build-info", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId?: string };
      const serverId = data.buildId?.trim();
      if (!serverId || serverId === current) return;
      setPendingServerId(serverId);
      setGateOpen(true);
    } catch {
      /* network errors — skip until next check */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const current = getClientBuildId();
    if (!current) return;

    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === null) {
      localStorage.setItem(STORAGE_KEY, current);
      sessionStorage.removeItem(SESSION_ATTEMPTS_KEY);
    } else if (stored !== current) {
      localStorage.setItem(STORAGE_KEY, current);
      sessionStorage.removeItem(SESSION_ATTEMPTS_KEY);
    } else {
      sessionStorage.removeItem(SESSION_ATTEMPTS_KEY);
    }

    void checkServer();

    const interval = window.setInterval(() => void checkServer(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void checkServer();
    };
    const onFocus = () => void checkServer();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkServer]);

  const onRefresh = () => {
    const id = pendingServerId;
    if (!id) return;
    if (!bumpReloadGuard()) {
      setReloadBlocked(true);
      return;
    }
    clearPersistedCache();
    localStorage.setItem(STORAGE_KEY, id);
    window.location.reload();
  };

  return (
    <Dialog
      open={gateOpen}
      onOpenChange={(open) => {
        if (open) setGateOpen(true);
      }}
    >
      <DialogContent
        showClose={false}
        className="z-[110] max-w-md gap-3"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("deploymentUpdate.title")}</DialogTitle>
          <DialogDescription>{t("deploymentUpdate.body")}</DialogDescription>
        </DialogHeader>
        {reloadBlocked ? (
          <p className="text-sm text-destructive">{t("deploymentUpdate.blocked")}</p>
        ) : null}
        <DialogFooter className="sm:justify-stretch">
          <Button type="button" className="w-full sm:w-auto" onClick={onRefresh} disabled={!pendingServerId || reloadBlocked}>
            {t("deploymentUpdate.refresh")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
