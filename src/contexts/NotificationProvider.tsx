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
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const invalidateDataQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["taxonomy"] });
    qc.invalidateQueries({ queryKey: ["stores"] });
    qc.invalidateQueries({ queryKey: ["webhooks"] });
    qc.invalidateQueries({ queryKey: ["sync-runs"] });
    qc.invalidateQueries({ queryKey: ["active-syncs-all"] });
  }, [qc]);

  const enqueue = useCallback((n: AppNotification) => {
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
      .select("id, type, title, body, cta_label, cta_url, image_url, lottie_url, priority, metadata, shown_at, dismissed_at, expires_at")
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
        type: row.type as NotificationType,
        title: row.title,
        body: row.body,
        cta_label: row.cta_label,
        cta_url: row.cta_url,
        image_url: row.image_url,
        lottie_url: row.lottie_url,
        priority: row.priority ?? 50,
        metadata: (row.metadata as Record<string, unknown>) || {},
        persisted: true,
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
        const row = payload.new as { id: string; user_id: string | null; type: string; title: string; body: string | null; cta_label: string | null; cta_url: string | null; image_url: string | null; lottie_url: string | null; priority: number; metadata: unknown; dismissed_at: string | null; expires_at: string | null };
        if (row.user_id && row.user_id !== user.id) return;
        if (row.dismissed_at) return;
        if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return;
        enqueue({
          id: row.id,
          type: row.type as NotificationType,
          title: row.title,
          body: row.body,
          cta_label: row.cta_label,
          cta_url: row.cta_url,
          image_url: row.image_url,
          lottie_url: row.lottie_url,
          priority: row.priority ?? 50,
          metadata: (row.metadata as Record<string, unknown>) || {},
          persisted: true,
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, enqueue]);

  const current = queue[0] || null;

  useEffect(() => {
    if (current && current.persisted) stampShown(current.id);
  }, [current?.id, current, stampShown]);

  const dismiss = useCallback(async () => {
    if (!current) return;
    const toRemove = current;
    setQueue((q) => q.slice(1));
    if (toRemove.persisted) {
      await supabase
        .from("user_notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", toRemove.id);
    }
    if (toRemove.type === "celebration") invalidateDataQueries();
  }, [current, invalidateDataQueries]);

  const click = useCallback(async () => {
    if (!current) return;
    if (current.persisted) {
      await supabase
        .from("user_notifications")
        .update({ clicked_at: new Date().toISOString() })
        .eq("id", current.id);
    }
    if (current.cta_url) {
      if (/^https?:\/\//.test(current.cta_url)) {
        window.open(current.cta_url, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(current.cta_url);
      }
    }
    await dismiss();
  }, [current, dismiss]);

  const push = useCallback((n: PushNotificationInput) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    enqueue({ ...n, id, persisted: false });
  }, [enqueue]);

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