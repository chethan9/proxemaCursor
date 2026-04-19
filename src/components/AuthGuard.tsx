import { useEffect, useRef, useState } from "react";
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
  const passedOnceRef = useRef(false);

  const userId = user?.id ?? null;
  const profileActive = profile ? profile.is_active : true;

  const fastPassed =
    !loading &&
    !!userId &&
    profileActive &&
    (!requireSuperAdmin || isSuperAdmin) &&
    (!requirePermission || can(requirePermission));

  const [checking, setChecking] = useState(!passedOnceRef.current && !fastPassed);

  useEffect(() => {
    if (loading) return;
    if (fastPassed) {
      passedOnceRef.current = true;
      setChecking(false);
      return;
    }
    if (passedOnceRef.current) return;
    (async () => {
      if (!userId) {
        const { data } = await supabase.rpc("can_bootstrap_super_admin");
        if (data) {
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
  }, [loading, userId, profile, profileActive, requirePermission, requireSuperAdmin, isSuperAdmin, router, can, fastPassed]);

  if (!passedOnceRef.current && (loading || checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}