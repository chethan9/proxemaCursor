import type { ActivityLogEntry } from "@/services/activityLogService";

export type ProductHistorySourceKind = "dashboard" | "webhook" | "sync" | "wp_revision";

export type ProductHistoryEntry = ActivityLogEntry & {
  history_source: "platform" | "wordpress";
  history_source_kind: ProductHistorySourceKind;
  display_actor?: string | null;
};
