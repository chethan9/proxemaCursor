import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NotificationRow = Database["public"]["Tables"]["user_notifications"]["Row"];
export type NotificationType = "celebration" | "announcement" | "ad" | "milestone" | "info" | "warning";

export interface ComposePayload {
  type: NotificationType;
  title: string;
  body?: string;
  cta_label?: string;
  cta_url?: string;
  image_url?: string;
  lottie_url?: string;
  priority?: number;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
  targeting: "broadcast" | "users" | "client" | "role";
  target_user_ids?: string[];
  target_client_id?: string;
  target_role?: string;
}

export interface SentNotificationGroup {
  group_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  lottie_url: string | null;
  priority: number;
  metadata: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
  target_type: string;
  target_description: string;
  recipients: number;
  shown_count: number;
  clicked_count: number;
  dismissed_count: number;
  ctr: number;
  dismiss_rate: number;
  sample_id: string;
}

export async function sendNotification(payload: ComposePayload): Promise<{ count: number; group_id: string }> {
  const res = await fetch("/api/notifications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Send failed" }));
    throw new Error(err.error || "Send failed");
  }
  return res.json();
}

export async function fetchHistory(): Promise<SentNotificationGroup[]> {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  if (!data) return [];

  const groups = new Map<string, NotificationRow[]>();
  for (const row of data) {
    const meta = (row.metadata as Record<string, unknown>) || {};
    const groupId = (meta.group_id as string) || row.id;
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId)!.push(row);
  }

  const result: SentNotificationGroup[] = [];
  for (const [groupId, rows] of groups.entries()) {
    const first = rows[0];
    const meta = (first.metadata as Record<string, unknown>) || {};
    const shown = rows.filter((r) => r.shown_at).length;
    const clicked = rows.filter((r) => r.clicked_at).length;
    const dismissed = rows.filter((r) => r.dismissed_at && !r.clicked_at).length;
    const isBroadcast = rows.every((r) => r.user_id === null);
    const targetType = (meta.targeting as string) || (isBroadcast ? "broadcast" : "users");
    const targetDesc = (meta.target_description as string) || (isBroadcast ? "All users" : `${rows.length} users`);
    result.push({
      group_id: groupId,
      type: first.type as NotificationType,
      title: first.title,
      body: first.body,
      cta_label: first.cta_label,
      cta_url: first.cta_url,
      image_url: first.image_url,
      lottie_url: first.lottie_url,
      priority: first.priority ?? 50,
      metadata: meta,
      expires_at: first.expires_at,
      created_at: first.created_at,
      target_type: targetType,
      target_description: targetDesc,
      recipients: rows.length,
      shown_count: shown,
      clicked_count: clicked,
      dismissed_count: dismissed,
      ctr: shown > 0 ? (clicked / shown) * 100 : 0,
      dismiss_rate: shown > 0 ? (dismissed / shown) * 100 : 0,
      sample_id: first.id,
    });
  }
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return result;
}

export async function revokeGroup(groupId: string) {
  const nowIso = new Date().toISOString();
  // Expire all rows with this group_id that haven't been dismissed
  const { error } = await supabase
    .from("user_notifications")
    .update({ expires_at: nowIso })
    .contains("metadata", { group_id: groupId })
    .is("dismissed_at", null);
  if (error) throw error;
}

export async function fetchActivity(limit = 100) {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, user_id, type, title, shown_at, clicked_at, dismissed_at, created_at")
    .or("shown_at.not.is.null,clicked_at.not.is.null,dismissed_at.not.is.null")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchProfilesLite() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, client_id")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchClientsLite() {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function fetchRolesLite() {
  const { data, error } = await supabase
    .from("roles")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data || [];
}