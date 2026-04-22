import type { NextApiRequest } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { supabase } from "@/integrations/supabase/client";

export type ActorType = "user" | "admin" | "system" | "api";

export interface LogActivityInput {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  clientId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  actorType?: ActorType;
  req?: NextApiRequest;
}

function extractRequestMetadata(req?: NextApiRequest): Record<string, unknown> {
  if (!req) return {};
  const fwd = req.headers["x-forwarded-for"];
  const ip = Array.isArray(fwd) ? fwd[0] : (fwd || "").split(",")[0].trim() || req.socket?.remoteAddress || null;
  const ua = req.headers["user-agent"] || null;
  return {
    ip: ip || null,
    user_agent: ua,
    path: req.url || null,
    method: req.method || null,
  };
}

function computeDiff(before?: Record<string, unknown> | null, after?: Record<string, unknown> | null) {
  if (!before && !after) return null;
  if (!before) return { after };
  if (!after) return { before };
  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      beforeDiff[k] = b;
      afterDiff[k] = a;
    }
  }
  if (Object.keys(afterDiff).length === 0) return null;
  return { before: beforeDiff, after: afterDiff };
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    let actorUserId: string | null = null;
    let actorEmail: string | null = null;

    if (input.req) {
      const authHeader = input.req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const { data } = await supabaseAdmin.auth.getUser(token);
        if (data.user) {
          actorUserId = data.user.id;
          actorEmail = data.user.email || null;
        }
      }
    } else if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        actorUserId = data.user.id;
        actorEmail = data.user.email || null;
      }
    }

    const diff = computeDiff(input.before, input.after);
    if (input.before && input.after && !diff) return;

    const metadata = {
      ...extractRequestMetadata(input.req),
      ...(input.metadata || {}),
    };

    const row = {
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      actor_type: input.actorType || (actorUserId ? "user" : "system"),
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId != null ? String(input.entityId) : null,
      client_id: input.clientId || null,
      diff,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    };

    const client = typeof window === "undefined" ? supabaseAdmin : supabase;
    const { error } = await client.from("activity_log" as never).insert(row as never);
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[activity-log] insert failed:", error.message);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[activity-log] unexpected error:", err);
    }
  }
}

export function summarizeDiff(diff: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null): string {
  if (!diff || !diff.after) return "";
  const entries = Object.entries(diff.after);
  return entries.map(([key, value]) => {
    const before = diff.before?.[key];
    const fmt = (v: unknown): string => {
      if (v === null || v === undefined) return "∅";
      if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v;
      if (typeof v === "object") return JSON.stringify(v).slice(0, 40);
      return String(v);
    };
    return `${key}: ${fmt(before)} → ${fmt(value)}`;
  }).join(" · ");
}