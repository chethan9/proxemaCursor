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

// Module-level cache: once we've authorized the user in this session,
// we don't re-run the full check on every route change (which caused flicker).
let sessionAuthorized = false;

export function AuthGuard({ children, requirePermission, requireSuperAdmin }: AuthGuardProps) {
  const router = useRouter();
  const { user, profile, loading, can, isSuperAdmin } = useAuth();
  const [checking, setChecking] = useState(!sessionAuthorized);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const didBootstrapCheck = useRef(false);

  useEffect(() => {
    if (loading) return;
    (async () => {
      if (!user) {
        sessionAuthorized = false;
        if (!didBootstrapCheck.current) {
          didBootstrapCheck.current = true;
          const { data } = await supabase.rpc("can_bootstrap_super_admin");
          if (data) {
            setNeedsBootstrap(true);
            router.replace("/auth/bootstrap");
            return;
          }
        }
        router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`);
        return;
      }
      if (profile && !profile.is_active) {
        sessionAuthorized = false;
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
      sessionAuthorized = true;
      setChecking(false);
    })();
  }, [loading, user, profile, requirePermission, requireSuperAdmin, isSuperAdmin, router, can]);

  // If already authorized in this session, render children immediately (no flicker on route change)
  if (sessionAuthorized && user && profile?.is_active) {
    return <>{children}</>;
  }

  if (loading || checking || needsBootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}