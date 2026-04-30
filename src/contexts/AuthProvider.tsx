import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { hasPermission, type Permission } from "@/lib/permissions";
import { clearPersistedCache } from "@/lib/query-persistence";
import { identifyPostHogUser, resetPostHogUser } from "@/lib/posthog";

export const authCleanupCallbacks = new Set<() => void>();

async function logAuthEvent(action: string, metadata?: Record<string, unknown>) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/auth/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, metadata: metadata || {} }),
    });
  } catch {}
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  client_id: string | null;
  is_active: boolean;
  default_landing_path: string | null;
  avatar_url: string | null;
  country_code: string | null;
  billing_currency: string | null;
  locale: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  profileLoaded: boolean;
  isSuperAdmin: boolean;
  permissions: string[];
  can: (permission: Permission) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const initializedRef = useRef(false);

  const loadProfileAndRole = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, client_id, is_active, default_landing_path, avatar_url, country_code, billing_currency, locale")
      .eq("id", userId)
      .maybeSingle();
    setProfile(prof as Profile | null);

    if (prof?.role) {
      const { data: r } = await supabase
        .from("roles")
        .select("id, name, description, permissions, is_system")
        .eq("name", prof.role)
        .maybeSingle();
      setRole(r as Role | null);
    } else {
      setRole(null);
    }
    setProfileLoaded(true);

    if (typeof window !== "undefined" && prof?.client_id) {
      const pendingRef = window.localStorage.getItem("pending_referral_code");
      if (pendingRef) {
        try {
          const { data: sess } = await supabase.auth.getSession();
          const tok = sess.session?.access_token;
          if (tok) {
            const r = await fetch("/api/referrals/attribute", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
              body: JSON.stringify({ code: pendingRef }),
            });
            if (r.ok || r.status === 404) {
              window.localStorage.removeItem("pending_referral_code");
            }
          }
        } catch {}
      }
    }
  };

  const refresh = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u);
    if (u) {
      await loadProfileAndRole(u.id);
    } else {
      setProfile(null);
      setRole(null);
      setProfileLoaded(true);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfileAndRole(session.user.id);
      } else {
        setProfileLoaded(true);
      }
      setLoading(false);
      initializedRef.current = true;
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setUser(session?.user ?? null);
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth/reset-password")) {
          window.location.replace("/auth/reset-password");
        }
        return;
      }
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            void loadProfileAndRole(session.user.id);
          }, 0);
        }
        return;
      }
      if (event === "SIGNED_IN") {
        setUser(session?.user ?? null);
        if (session?.user) {
          identifyPostHogUser(session.user.id, { email: session.user.email });
          if (typeof window !== "undefined") {
            import("@sentry/nextjs").then((Sentry) => {
              Sentry.setUser({ id: session.user.id, email: session.user.email });
            }).catch(() => { /* sentry not loaded in dev */ });
          }
          if (!initializedRef.current) {
            setLoading(true);
            setProfileLoaded(false);
            setTimeout(async () => {
              await loadProfileAndRole(session.user.id);
              setLoading(false);
              initializedRef.current = true;
            }, 0);
          } else {
            setTimeout(() => { loadProfileAndRole(session.user.id); }, 0);
          }
          void logAuthEvent("auth.login", { email: session.user.email });
        }
        return;
      }
      if (event === "SIGNED_OUT") {
        resetPostHogUser();
        if (typeof window !== "undefined") {
          import("@sentry/nextjs").then((Sentry) => {
            Sentry.setUser(null);
          }).catch(() => { /* sentry not loaded in dev */ });
        }
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        setProfileLoaded(true);
        return;
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    void logAuthEvent("auth.logout");
    setUser(null);
    setProfile(null);
    setRole(null);
    authCleanupCallbacks.forEach((cb) => { try { cb(); } catch {} });
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {}
    if (typeof window !== "undefined") {
      try {
        clearPersistedCache();
        Object.keys(window.localStorage).forEach((k) => {
          if (
            k.startsWith("sb-") ||
            k.includes("supabase") ||
            k.startsWith("sidebar-") ||
            k.startsWith("woosync-query-cache")
          ) {
            window.localStorage.removeItem(k);
          }
        });
        Object.keys(window.sessionStorage).forEach((k) => {
          if (k.startsWith("sb-") || k.includes("supabase")) {
            window.sessionStorage.removeItem(k);
          }
        });
      } catch {}
      window.location.replace("/auth/login");
    } else {
      router.replace("/auth/login");
    }
  };

  const permissions = role?.permissions ?? [];
  const isSuperAdmin = profile?.role === "super_admin" || permissions.includes("*");

  const can = (permission: Permission) => {
    if (isSuperAdmin) return true;
    return hasPermission(permissions, permission);
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, profileLoaded, isSuperAdmin, permissions, can, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}