import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuth, authCleanupCallbacks } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { Permission } from "@/lib/permissions";

interface AuthGuardProps {
  children: React.ReactNode;
  requirePermission?: Permission;
  requireSuperAdmin?: boolean;
}

const passedGuards = new Set<string>();
if (typeof window !== "undefined") {
  authCleanupCallbacks.add(() => passedGuards.clear());
}

function guardKey(permission?: Permission, superAdmin?: boolean) {
  return `${permission || "_"}::${superAdmin ? "sa" : "_"}`;
}

export function AuthGuard({ children, requirePermission, requireSuperAdmin }: AuthGuardProps) {
  const router = useRouter();
  const { user, profile, loading, profileLoaded, can, isSuperAdmin, signOut } = useAuth();

  const userId = user?.id ?? null;
  const profileActive = profile ? profile.is_active : true;
  const key = guardKey(requirePermission, requireSuperAdmin);
  const alreadyPassed = passedGuards.has(key);

  const needsProfile = !!(requireSuperAdmin || requirePermission);
  const profileReady = !userId || !needsProfile || profileLoaded;

  const currentlyPasses =
    !loading &&
    !!userId &&
    profileActive &&
    profileReady &&
    (!requireSuperAdmin || isSuperAdmin) &&
    (!requirePermission || can(requirePermission));

  const [checking, setChecking] = useState(!alreadyPassed && !currentlyPasses);
  const [forcedResolve, setForcedResolve] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 3s safety timeout — if profile still hasn't loaded, stop waiting and let the effect below resolve
  useEffect(() => {
    if (loading) return;
    if (!userId) return;
    if (!needsProfile) return;
    if (profileLoaded) return;
    timeoutRef.current = setTimeout(() => setForcedResolve(true), 3000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [loading, userId, needsProfile, profileLoaded]);

  useEffect(() => {
    if (loading) return;
    // Wait for profile unless timeout already fired
    if (userId && needsProfile && !profileLoaded && !forcedResolve) return;

    if (currentlyPasses) {
      passedGuards.add(key);
      if (checking) setChecking(false);
      return;
    }

    if (alreadyPassed) {
      if (!userId || (profile && !profile.is_active) || (requireSuperAdmin && !isSuperAdmin) || (requirePermission && !can(requirePermission))) {
        passedGuards.delete(key);
        (async () => {
          if (!userId) {
            const { data } = await supabase.rpc("can_bootstrap_super_admin");
            if (data) { router.replace("/auth/bootstrap"); return; }
            router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`);
            return;
          }
          if (profile && !profile.is_active) {
            await signOut();
            return;
          }
          router.replace("/?error=forbidden");
        })();
      }
      return;
    }

    (async () => {
      if (!userId) {
        const { data } = await supabase.rpc("can_bootstrap_super_admin");
        if (data) { router.replace("/auth/bootstrap"); return; }
        router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`);
        return;
      }
      if (profile && !profile.is_active) {
        await signOut();
        return;
      }
      if (requireSuperAdmin && !isSuperAdmin) { router.replace("/?error=forbidden"); return; }
      if (requirePermission && !can(requirePermission)) { router.replace("/?error=forbidden"); return; }
      setChecking(false);
    })();
  }, [loading, userId, profile, profileActive, profileLoaded, forcedResolve, needsProfile, requirePermission, requireSuperAdmin, isSuperAdmin, router, can, currentlyPasses, alreadyPassed, key, checking, signOut]);

  const stillWaitingForProfile = !loading && !!userId && needsProfile && !profileLoaded && !forcedResolve;
  if (!alreadyPassed && (loading || checking || stillWaitingForProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}