import { supabase } from "@/integrations/supabase/client";

export type ActorType = "user" | "admin" | "system" | "api";

export interface ActivityLogEntry {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_type: ActorType;
  action: string;
  entity_type: string;
  entity_id: string | null;
  client_id: string | null;
  diff: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
}

export interface ActivityFilters {
  actorUserId?: string;
  actorEmail?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  clientId?: string;
  from?: string;
  to?: string;
  search?: string;
}

const PAGE_SIZE = 50;

export async function listActivity(
  filters: ActivityFilters,
  page = 0,
  limit = PAGE_SIZE
): Promise<{ rows: ActivityLogEntry[]; count: number | null }> {
  let q = supabase
    .from("activity_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (filters.actorUserId) q = q.eq("actor_user_id", filters.actorUserId);
  if (filters.actorEmail) q = q.ilike("actor_email", `%${filters.actorEmail}%`);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.entityType) q = q.eq("entity_type", filters.entityType);
  if (filters.entityId) q = q.eq("entity_id", filters.entityId);
  if (filters.clientId) q = q.eq("client_id", filters.clientId);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data as ActivityLogEntry[]) || [], count: count ?? null };
}

export async function listEntityActivity(
  entityType: string,
  entityId: string,
  limit = 100
): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ActivityLogEntry[]) || [];
}

export async function listMyActivity(
  userId: string,
  page = 0,
  limit = PAGE_SIZE
): Promise<{ rows: ActivityLogEntry[]; count: number | null }> {
  const { data, error, count } = await supabase
    .from("activity_log")
    .select("*", { count: "exact" })
    .eq("actor_user_id", userId)
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);
  if (error) throw error;
  return { rows: (data as ActivityLogEntry[]) || [], count: count ?? null };
}

export async function listDistinctActions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("action")
    .order("action")
    .limit(500);
  if (error) throw error;
  const set = new Set<string>();
  (data as { action: string }[] | null)?.forEach((r) => set.add(r.action));
  return Array.from(set).sort();
}

export async function listDistinctEntityTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("entity_type")
    .order("entity_type")
    .limit(500);
  if (error) throw error;
  const set = new Set<string>();
  (data as { entity_type: string }[] | null)?.forEach((r) => set.add(r.entity_type));
  return Array.from(set).sort();
}

export function formatActionLabel(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function summarizeDiff(diff: ActivityLogEntry["diff"]): string {
  if (!diff) return "";
  const keys = Object.keys(diff);
  if (keys.length === 0) return "";
  if (keys.length <= 3) return keys.map((k) => k.replace(/_/g, " ")).join(", ");
  return `${keys.slice(0, 3).map((k) => k.replace(/_/g, " ")).join(", ")} +${keys.length - 3} more`;
}

export function activityToCsv(rows: ActivityLogEntry[]): string {
  const headers = [
    "timestamp",
    "actor_email",
    "actor_type",
    "action",
    "entity_type",
    "entity_id",
    "client_id",
    "diff_summary",
  ];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escape(r.created_at),
        escape(r.actor_email),
        escape(r.actor_type),
        escape(r.action),
        escape(r.entity_type),
        escape(r.entity_id),
        escape(r.client_id),
        escape(summarizeDiff(r.diff)),
      ].join(",")
    );
  }
  return lines.join("\n");
}