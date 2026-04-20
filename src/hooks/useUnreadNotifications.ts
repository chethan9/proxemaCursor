import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";

const CLEAR_KEY = "notifications-counter-cleared-at";

export function useUnreadNotifications() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    let mounted = true;

    const compute = async () => {
      const cleared = typeof window !== "undefined" ? localStorage.getItem(CLEAR_KEY) : null;
      let q = supabase
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (cleared) q = q.gt("created_at", cleared);
      const { count } = await q;
      if (mounted) setUnread(count || 0);
    };

    compute();
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` }, compute)
      .subscribe();

    const onStorage = (e: StorageEvent) => { if (e.key === CLEAR_KEY) compute(); };
    window.addEventListener("storage", onStorage);
    const interval = setInterval(compute, 60_000);

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, [user]);

  return unread;
}