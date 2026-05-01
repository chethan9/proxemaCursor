import { useEffect, useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Activity, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import {
  listMyActivity,
  type ActivityFilters,
  type ActivityLogEntry,
} from "@/services/activityLogService";
import { ActivityFeedRow } from "@/components/ActivityFeedRow";
import { ActivityDetailSheet } from "@/components/ActivityDetailSheet";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { formatNumber } from "@/lib/format-number";
import { supabase } from "@/integrations/supabase/client";
import { AUDIT_MODULES } from "@/lib/audit/log";
import { buildActivityExportParams } from "@/lib/audit/export-query";
import { useToast } from "@/hooks/use-toast";

const MODULE_FILTER_VALUES = new Set<string>(["__all", ...Object.values(AUDIT_MODULES)]);

const MODULE_OPTIONS = ["", ...Object.values(AUDIT_MODULES)];

/** Ensures merged DB translations never render objects into SelectItem / headings (causes React child errors). */
function tx(t: (key: string, opts?: { defaultValue?: string }) => string, key: string, defaultValue: string) {
  const v = t(key, { defaultValue });
  return typeof v === "string" ? v : defaultValue;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function MyActivityPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("settings");
  const { toast } = useToast();
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<
    Pick<ActivityFilters, "module" | "from" | "to" | "action" | "search">
  >({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const effectiveFilters = useMemo(() => filters, [filters]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    listMyActivity(user.id, page, 50, effectiveFilters)
      .then((res) => {
        if (cancelled) return;
        setRows((prev) => (page === 0 ? res.rows : [...prev, ...res.rows]));
        setCount(res.count);
      })
      .catch((e) => console.error("[my-activity]", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, page, effectiveFilters]);

  const applyFilter = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters({});
    setPage(0);
  };

  const exportCsv = async () => {
    if (!user?.id) return;
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const params = buildActivityExportParams({ ...filters }, { actorUserId: user.id });
      const res = await fetch(`/api/activity/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(blob, `my-activity-${stamp}.csv`);
      toast({ title: tx(t, "myActivity.exportReady", "Download started") });
    } catch (e) {
      toast({
        title: tx(t, "myActivity.exportFailed", "Export failed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  /** Radix Select throws if `value` is not present in a SelectItem — coerce invalid/stale values. */
  const moduleSelectValue =
    filters.module && MODULE_FILTER_VALUES.has(filters.module) ? filters.module : "__all";

  return (
    <SettingsLayout title={tx(t, "myActivity.title", "My Activity")}>
      <div className="p-6 space-y-5 max-w-4xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {tx(t, "myActivity.title", "My Activity")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tx(t, "myActivity.subtitle", "Your recent actions across the platform.")}
              {count !== null && (
                <span className="ml-2">{formatNumber(count, i18n.language)}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-xl">
              {tx(
                t,
                "myActivity.immutableNotice",
                "Audit history cannot be deleted from the app; entries older than 90 days may be purged per retention policy."
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 shrink-0">
            <Download className="h-3.5 w-3.5" />
            {tx(t, "myActivity.exportCsv", "Export CSV")}
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Select
                value={moduleSelectValue}
                onValueChange={(v) => applyFilter({ module: v === "__all" ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tx(t, "myActivity.moduleLabel", "Module")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{tx(t, "myActivity.moduleAll", "All modules")}</SelectItem>
                  {MODULE_OPTIONS.filter(Boolean).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={tx(t, "myActivity.actionPlaceholder", "Filter by action…")}
                value={filters.action || ""}
                onChange={(e) => applyFilter({ action: e.target.value || undefined })}
              />
              <Input
                placeholder={tx(t, "myActivity.searchPlaceholder", "Search action, entity…")}
                value={filters.search || ""}
                onChange={(e) => applyFilter({ search: e.target.value || undefined })}
              />
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {tx(t, "myActivity.fromDate", "From")}
                </span>
                <Input
                  type="date"
                  value={filters.from?.slice(0, 10) || ""}
                  onChange={(e) =>
                    applyFilter({
                      from: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {tx(t, "myActivity.toDate", "To")}
                </span>
                <Input
                  type="date"
                  value={filters.to?.slice(0, 10) || ""}
                  onChange={(e) =>
                    applyFilter({
                      to: e.target.value
                        ? new Date(`${e.target.value}T23:59:59.999Z`).toISOString()
                        : undefined,
                    })
                  }
                  className="flex-1"
                />
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" type="button" onClick={resetFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                {tx(t, "myActivity.empty", "No activity yet.")}
              </CardContent>
            </Card>
          )}
          {rows.map((entry) => (
            <ActivityFeedRow
              key={entry.id}
              entry={entry}
              onOpenDetail={(id) => {
                setDetailId(id);
                setDetailOpen(true);
              }}
            />
          ))}
        </div>

        {rows.length > 0 && count !== null && rows.length < count && (
          <div className="flex justify-center py-4">
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {tx(t, "myActivity.loadMore", "Load more")}
            </Button>
          </div>
        )}
      </div>

      <ActivityDetailSheet
        activityId={detailId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetailId(null);
        }}
      />
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});
