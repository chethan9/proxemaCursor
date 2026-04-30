"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthProvider";
import { useSubscription } from "@/hooks/queries/useSubscription";
import { useAppSettings } from "@/hooks/queries/useAppSettings";
import { isBillingEffectivelyEnforced } from "@/lib/billing-mode";
import { Loader2 } from "lucide-react";

const ALWAYS_ALLOWED_PREFIXES = [
  "/pricing",
  "/billing",
  "/auth",
  "/settings",
  "/admin",
  "/onboarding",
];

function isAllowedWhenLocked(path: string): boolean {
  const base = path.split("?")[0].split("#")[0];
  return ALWAYS_ALLOWED_PREFIXES.some((p) => base === p || base.startsWith(p + "/"));
}

interface Props {
  children: React.ReactNode;
}

export function BillingGate({ children }: Props) {
  const router = useRouter();
  const { user, isSuperAdmin, profile, profileLoaded, loading: authLoading } = useAuth();
  const { settings, isLoading: settingsLoading } = useAppSettings();
  const { subscription, isLoading: subLoading, hasAccess } = useSubscription();
  const redirectedRef = useRef(false);

  const enforce = isBillingEffectivelyEnforced(settings);
  const checking = authLoading || (user && (!profileLoaded || subLoading || settingsLoading));
  const locked = !!user && !isSuperAdmin && enforce && profileLoaded && !subLoading && !settingsLoading && !hasAccess;
  const allowedHere = isAllowedWhenLocked(router.asPath);

  useEffect(() => {
    if (!locked) return;
    if (allowedHere) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace("/pricing?app=1");
  }, [locked, allowedHere, router]);

  useEffect(() => {
    if (!locked) redirectedRef.current = false;
  }, [locked]);

  if (locked && !allowedHere) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Redirecting to plans…</p>
      </div>
    );
  }

  if (checking && !subscription && !allowedHere && enforce && profile?.client_id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
