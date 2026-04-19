import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { hasPermission, type Permission } from "@/lib/permissions";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  client_id: string | null;
  is_active: boolean;
  default_landing_path: string | null;
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

  const loadProfileAndRole = async (userId: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, client_id, is_active, default_landing_path")
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
  };

  const refresh = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u);
    if (u) {
      await loadProfileAndRole(u.id);
    } else {
      setProfile(null);
      setRole(null);
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
      }
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        setUser(session?.user ?? null);
        return;
      }
      if (event === "SIGNED_IN") {
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          setTimeout(async () => {
            await loadProfileAndRole(session.user.id);
            setLoading(false);
          }, 0);
        }
        return;
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  const permissions = role?.permissions ?? [];
  const isSuperAdmin = profile?.role === "super_admin" || permissions.includes("*");

  const can = (permission: Permission) => {
    if (isSuperAdmin) return true;
    return hasPermission(permissions, permission);
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, isSuperAdmin, permissions, can, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}