import type { ActivityFilters } from "@/services/activityLogService";

/** Build query string for `GET /api/activity/export` (must match server filters). */
export function buildActivityExportParams(
  filters: ActivityFilters,
  extra?: { actorUserId?: string }
): URLSearchParams {
  const p = new URLSearchParams();
  if (extra?.actorUserId) p.set("actor_user_id", extra.actorUserId);
  if (filters.action) p.set("action", filters.action);
  if (filters.entityType) p.set("entity_type", filters.entityType);
  if (filters.entityId) p.set("entity_id", filters.entityId);
  if (filters.clientId) p.set("client_id", filters.clientId);
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  if (filters.module) p.set("module", filters.module);
  if (filters.search?.trim()) p.set("search", filters.search.trim());
  return p;
}
