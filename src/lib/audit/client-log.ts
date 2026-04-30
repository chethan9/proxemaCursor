import { supabase } from "@/integrations/supabase/client";

/** Browser-side fire-and-forget audit events (uses authenticated session). */
export async function logClientAuditEvent(opts: {
  action: string;
  entityType?: string;
  entityId?: string | null;
  storeId?: string;
  module?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/activity/client-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: opts.action,
        entity_type: opts.entityType ?? "app",
        entity_id: opts.entityId ?? undefined,
        store_id: opts.storeId,
        module: opts.module ?? "sites",
        metadata: opts.metadata ?? {},
      }),
    });
  } catch {
    /* non-fatal */
  }
}
