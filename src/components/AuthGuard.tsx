import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { Permission } from "@/lib/permissions";

interface AuthGuardProps {
  children: React.ReactNode;
  requirePermission?: Permission;
  requireSuperAdmin?: boolean;
}

const passedGuards = new Set<string>();

function guardKey(permission?: Permission, superAdmin?: boolean) {
  return `${permission || "_"}::${superAdmin ? "sa" : "_"}`;
}

export function AuthGuard({ children, requirePermission, requireSuperAdmin }: AuthGuardProps) {
  const router = useRouter();
  const { user, profile, loading, can, isSuperAdmin } = useAuth();

  const userId = user?.id ?? null;
  const profileActive = profile ? profile.is_active : true;
  const key = guardKey(requirePermission, requireSuperAdmin);
  const alreadyPassed = passedGuards.has(key);

  const currentlyPasses =
    !loading &&
    !!userId &&
    profileActive &&
    (!requireSuperAdmin || isSuperAdmin) &&
    (!requirePermission || can(requirePermission));

  const [checking, setChecking] = useState(!alreadyPassed && !currentlyPasses);

  useEffect(() => {
    if (loading) return;
    if (currentlyPasses) {
      passedGuards.add(key);
      if (checking) setChecking(false);
      return;
    }
    if (alreadyPassed) {
      // Silent re-check in background; don't block render
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
            await supabase.auth.signOut();
            router.replace("/auth/login?error=inactive");
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
        await supabase.auth.signOut();
        router.replace("/auth/login?error=inactive");
        return;
      }
      if (requireSuperAdmin && !isSuperAdmin) { router.replace("/?error=forbidden"); return; }
      if (requirePermission && !can(requirePermission)) { router.replace("/?error=forbidden"); return; }
      setChecking(false);
    })();
  }, [loading, userId, profile, profileActive, requirePermission, requireSuperAdmin, isSuperAdmin, router, can, currentlyPasses, alreadyPassed, key, checking]);

  if (!alreadyPassed && (loading || checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}