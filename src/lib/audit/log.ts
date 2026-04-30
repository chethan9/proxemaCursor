import type { NextApiRequest } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { logActivity, type ActorType } from "@/lib/activity-log";
import { buildFieldDiffs, capFieldDiffs, type FieldDiffItem } from "@/lib/audit/diff-engine";

/** Standard `metadata.module` values for filtering activity. */
export const AUDIT_MODULES = {
  sites: "sites",
  templates: "templates",
  billing: "billing",
  settings: "settings",
  admin: "admin",
  auth: "auth",
} as const;

export async function getClientIdForStore(storeId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("stores").select("client_id").eq("id", storeId).maybeSingle();
  return (data?.client_id as string | undefined) ?? null;
}

export interface AuditSitesMutationInput {
  req: NextApiRequest;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  clientId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  fieldDiffs?: FieldDiffItem[] | null;
  storeId: string;
  module?: string;
  metadata?: Record<string, unknown>;
  actorType?: ActorType;
}

/**
 * Log a store-scoped mutation with flattened field diffs and module tag (server-side only).
 */
export async function auditSitesMutation(input: AuditSitesMutationInput): Promise<void> {
  const clientId = input.clientId ?? (await getClientIdForStore(input.storeId));
  let fieldDiffs = input.fieldDiffs;
  if ((!fieldDiffs || fieldDiffs.length === 0) && input.before && input.after) {
    fieldDiffs = capFieldDiffs(buildFieldDiffs(input.before, input.after));
  }
  await logActivity({
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    clientId,
    before: input.before,
    after: input.after,
    fieldDiffs: fieldDiffs?.length ? fieldDiffs : null,
    metadata: {
      module: input.module ?? AUDIT_MODULES.sites,
      store_id: input.storeId,
      ...input.metadata,
    },
    req: input.req,
    actorType: input.actorType,
  });
}
