import { useState } from "react";
import { ChevronDown, ChevronUp, ArrowRight, User, Shield, Cpu, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  type ActivityLogEntry,
  formatActionLabel,
  summarizeDiff,
} from "@/services/activityLogService";
import { useTranslation } from "next-i18next";
import { formatDate, formatDateTime } from "@/lib/format-number";

const actorIcon = {
  user: User,
  admin: Shield,
  system: Cpu,
  api: Key,
} as const;

function timeAgo(dateStr: string, locale?: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr, locale);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    try {
      const s = JSON.stringify(v);
      return s.length > 80 ? s.substring(0, 80) + "…" : s;
    } catch {
      return "[object]";
    }
  }
  const s = String(v);
  return s.length > 80 ? s.substring(0, 80) + "…" : s;
}

function getDiffRows(
  diff: ActivityLogEntry["diff"]
): { field: string; old: unknown; new: unknown }[] {
  if (!diff) return [];
  const d = diff as Record<string, unknown>;
  if (
    d.before &&
    d.after &&
    typeof d.before === "object" &&
    typeof d.after === "object" &&
    !Array.isArray(d.before) &&
    !Array.isArray(d.after)
  ) {
    const b = d.before as Record<string, unknown>;
    const a = d.after as Record<string, unknown>;
    const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
    return [...keys]
      .sort()
      .map((k) => ({ field: k, old: b[k], new: a[k] }))
      .filter(({ old: o, new: n }) => JSON.stringify(o) !== JSON.stringify(n));
  }
  return Object.entries(diff).map(([field, change]) => ({
    field,
    old: (change as { old?: unknown })?.old,
    new: (change as { new?: unknown })?.new,
  }));
}

export function ActivityFeedRow({
  entry,
  onOpenDetail,
}: {
  entry: ActivityLogEntry;
  onOpenDetail?: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const actorKey =
    entry.actor_type && entry.actor_type in actorIcon
      ? (entry.actor_type as keyof typeof actorIcon)
      : "user";
  const ActorIcon = actorIcon[actorKey] ?? User;
  const initials = (entry.actor_email || "?").slice(0, 2).toUpperCase();
  const diffRows = getDiffRows(entry.diff);
  const canExpand = diffRows.length > 0;

  return (
    <div
      className={cn(
        "rounded-md border bg-card transition-colors",
        expanded ? "border-primary/40" : "border-border hover:bg-muted/30"
      )}
    >
      <button
        type="button"
        onClick={() => canExpand && setExpanded((e) => !e)}
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left",
          canExpand ? "cursor-pointer" : "cursor-default"
        )}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-medium truncate">
              {entry.actor_email || "System"}
            </span>
            <Badge variant="outline" className="h-5 text-[10px] gap-1 capitalize">
              <ActorIcon className="h-3 w-3" />
              {entry.actor_type}
            </Badge>
            <span className="text-muted-foreground">
              {formatActionLabel(entry.action ?? "").toLowerCase()}
            </span>
            <Badge variant="secondary" className="h-5 text-[10px]">
              {entry.entity_type || "—"}
            </Badge>
            {entry.entity_id && (
              <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[240px]">
                {entry.entity_id}
              </span>
            )}
          </div>
          {diffRows.length > 0 && !expanded && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {summarizeDiff(entry.diff)}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
          {timeAgo(entry.created_at, i18n.language)}
        </span>
        {onOpenDetail && (
          <button
            type="button"
            className="text-xs text-primary underline flex-shrink-0 px-1"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(entry.id);
            }}
          >
            Details
          </button>
        )}
        {canExpand && (
          <span className="flex-shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        )}
      </button>

      {expanded && diffRows.length > 0 && (
        <div className="border-t bg-muted/20 p-3 space-y-1">
          {diffRows.map(({ field, old: o, new: n }) => (
            <div
              key={field}
              className="grid grid-cols-[140px_1fr_auto_1fr] gap-2 items-center text-xs py-1"
            >
              <span className="font-medium capitalize text-muted-foreground">
                {field.replace(/_/g, " ")}
              </span>
              <span className="font-mono text-muted-foreground line-through truncate">
                {formatValue(o)}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono font-medium truncate">
                {formatValue(n)}
              </span>
            </div>
          ))}
          {onOpenDetail && (
            <div className="pt-2">
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(entry.id);
                }}
              >
                View full field-level history
              </button>
            </div>
          )}
          <div className="pt-2 mt-2 border-t border-border/50 text-[11px] text-muted-foreground">
            {formatDateTime(entry.created_at, i18n.language)}
          </div>
        </div>
      )}
    </div>
  );
}