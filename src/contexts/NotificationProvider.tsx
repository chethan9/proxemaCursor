import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthProvider";

export type NotificationType = "celebration" | "announcement" | "ad" | "milestone" | "info" | "warning";

export interface NotificationItem {
  id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  lottie_url: string | null;
  priority: number;
  metadata: Record<string, unknown> | null;
  shown_at: string | null;
  dismissed_at: string | null;
  _transient?: boolean;
}

export interface PushNotificationInput {
  type?: NotificationType;
  title: string;
  body?: string;
  cta_label?: string;
  cta_url?: string;
  image_url?: string;
  lottie_url?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

interface NotificationContextValue {
  current: NotificationItem | null;
  dismiss: () => void;
  click: () => void;
  push: (n: PushNotificationInput) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const POLL_MS = 30000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [queue, setQueue] = useState<NotificationItem[]>([]);
  const queueRef = useRef<NotificationItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { queueRef.current = queue; }, [queue]);

  const invalidateDataQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["taxonomy"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["webhooks"] });
    qc.invalidateQueries({ queryKey: ["sync-runs"] });
    qc.invalidateQueries({ queryKey: ["active-syncs-all"] });
  }, [qc]);

  const enqueue = useCallback((n: NotificationItem) => {
    if (seenIdsRef.current.has(n.id)) return;
    seenIdsRef.current.add(n.id);
    setQueue((q) => {
      const next = [...q, n];
      next.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
      return next;
    });
    if (n.type === "celebration") invalidateDataQueries();
  }, [invalidateDataQueries]);

  const stampShown = useCallback(async (id: string) => {
    if (id.startsWith("transient-")) return;
    await supabase
      .from("user_notifications")
      .update({ shown_at: new Date().toISOString() })
      .eq("id", id)
      .is("shown_at", null);
  }, []);

  const fetchPending = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_notifications")
      .select("id, user_id, type, title, body, cta_label, cta_url, image_url, lottie_url, priority, metadata, shown_at, dismissed_at, expires_at")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .is("dismissed_at", null)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
    if (!data) return;
    const now = Date.now();
    for (const row of data) {
      if (row.dismissed_at) continue;
      if (row.expires_at && new Date(row.expires_at).getTime() < now) continue;
      enqueue({
        id: row.id,
        user_id: row.user_id,
        type: row.type as NotificationType,
        title: row.title,
        body: row.body,
        cta_label: row.cta_label,
        cta_url: row.cta_url,
        image_url: row.image_url,
        lottie_url: row.lottie_url,
        priority: row.priority ?? 50,
        metadata: (row.metadata as Record<string, unknown>) || {},
        shown_at: row.shown_at,
        dismissed_at: row.dismissed_at,
      });
    }
  }, [user, enqueue]);

  useEffect(() => {
    if (!user) return;
    fetchPending();
  }, [user?.id, fetchPending]);

  useEffect(() => {
    if (!user) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchPending();
        invalidateDataQueries();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [user?.id, fetchPending, invalidateDataQueries]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(fetchPending, POLL_MS);
    return () => clearInterval(id);
  }, [user?.id, fetchPending]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_notifications" }, (payload) => {
        const row = payload.new as { id: string; user_id: string | null; type: string; title: string; body: string | null; cta_label: string | null; cta_url: string | null; image_url: string | null; lottie_url: string | null; priority: number; metadata: unknown; shown_at: string | null; dismissed_at: string | null; expires_at: string | null };
        if (row.user_id && row.user_id !== user.id) return;
        if (row.dismissed_at) return;
        if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return;
        enqueue({
          id: row.id,
          user_id: row.user_id,
          type: row.type as NotificationType,
          title: row.title,
          body: row.body,
          cta_label: row.cta_label,
          cta_url: row.cta_url,
          image_url: row.image_url,
          lottie_url: row.lottie_url,
          priority: row.priority ?? 50,
          metadata: (row.metadata as Record<string, unknown>) || {},
          shown_at: row.shown_at,
          dismissed_at: row.dismissed_at,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, enqueue]);

  const current = queue[0] || null;

  useEffect(() => {
    if (current && !current._transient) stampShown(current.id);
  }, [current?.id, current, stampShown]);

  const dismiss = useCallback(async () => {
    const curr = queueRef.current[0];
    if (!curr) return;
    setQueue((q) => q.slice(1));
    if (!curr._transient) {
      await supabase
        .from("user_notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", curr.id);
    }
  }, []);

  const click = useCallback(async () => {
    const curr = queueRef.current[0];
    if (!curr) return;
    if (!curr._transient) {
      await supabase
        .from("user_notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", curr.id);
    }
    if (curr.cta_url) {
      window.open(curr.cta_url, "_blank");
    }
    setQueue((q) => q.slice(1));
  }, []);

  const push = useCallback((n: PushNotificationInput) => {
    const item: NotificationItem = {
      id: `transient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: null,
      type: n.type || "info",
      title: n.title,
      body: n.body || null,
      cta_label: n.cta_label || null,
      cta_url: n.cta_url || null,
      image_url: n.image_url || null,
      lottie_url: n.lottie_url || null,
      priority: n.priority ?? 50,
      metadata: n.metadata || null,
      shown_at: null,
      dismissed_at: null,
      _transient: true,
    };
    setQueue((q) => {
      const next = [...q, item];
      next.sort((a, b) => b.priority - a.priority);
      return next;
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ current, dismiss, click, push }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}