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

export function AuthGuard({ children, requirePermission, requireSuperAdmin }: AuthGuardProps) {
  const router = useRouter();
  const { user, profile, loading, can, isSuperAdmin } = useAuth();

  // Fast-path: if auth already resolved and user passes checks, don't show loader.
  const fastPassed =
    !loading &&
    !!user &&
    (!profile || profile.is_active) &&
    (!requireSuperAdmin || isSuperAdmin) &&
    (!requirePermission || can(requirePermission));

  const [checking, setChecking] = useState(!fastPassed);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (fastPassed) { setChecking(false); return; }
    (async () => {
      if (!user) {
        const { data } = await supabase.rpc("can_bootstrap_super_admin");
        if (data) {
          setNeedsBootstrap(true);
          router.replace("/auth/bootstrap");
          return;
        }
        router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`);
        return;
      }
      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        router.replace("/auth/login?error=inactive");
        return;
      }
      if (requireSuperAdmin && !isSuperAdmin) {
        router.replace("/?error=forbidden");
        return;
      }
      if (requirePermission && !can(requirePermission)) {
        router.replace("/?error=forbidden");
        return;
      }
      setChecking(false);
    })();
  }, [loading, user, profile, requirePermission, requireSuperAdmin, isSuperAdmin, router, can, fastPassed]);

  if (!fastPassed && (loading || checking || needsBootstrap)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}