import { useEffect, useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, RefreshCw, X, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listActivity,
  listDistinctActions,
  listDistinctEntityTypes,
  activityToCsv,
  type ActivityLogEntry,
  type ActivityFilters,
} from "@/services/activityLogService";
import { ActivityFeedRow } from "@/components/ActivityFeedRow";
import { useToast } from "@/hooks/use-toast";

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminActivityPage() {
  const { t } = useTranslation("admin");
  const { toast } = useToast();
  const [rows, setRows] = useState<ActivityLogEntry[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [filters, setFilters] = useState<ActivityFilters>({});

  const effectiveFilters = useMemo(() => filters, [filters]);

  useEffect(() => {
    listDistinctActions().then(setActions).catch(() => {});
    listDistinctEntityTypes().then(setEntityTypes).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listActivity(effectiveFilters, page, 50)
      .then((res) => {
        if (cancelled) return;
        setRows((prev) => (page === 0 ? res.rows : [...prev, ...res.rows]));
        setCount(res.count);
      })
      .catch((e) => console.error("[admin/activity]", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveFilters, page]);

  useEffect(() => {
    const channel = supabase
      .channel("activity-log-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          const entry = payload.new as ActivityLogEntry;
          setRows((prev) => {
            if (prev.some((r) => r.id === entry.id)) return prev;
            return [entry, ...prev];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const resetFilters = () => {
    setFilters({});
    setPage(0);
  };

  const applyFilter = (patch: Partial<ActivityFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const exportCsv = async () => {
    try {
      const { rows: all } = await listActivity(effectiveFilters, 0, 5000);
      const csv = activityToCsv(all);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadCsv(csv, `activity-log-${stamp}.csv`);
      toast({ title: t("activity.exportReady"), description: t("activity.exportRows", { count: all.length }) });
    } catch (e) {
      toast({
        title: t("activity.exportFailed"),
        description: e instanceof Error ? e.message : t("activity.unknownError"),
        variant: "destructive",
      });
    }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <AppLayout title={t("activity.title")} requireSuperAdmin>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t("activity.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("activity.subtitle")}
              {count !== null && <span className="ml-2">{t("activity.totalEntries", { count })}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> {t("activity.exportCsv")}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Input
                placeholder={t("activity.actorPlaceholder")}
                value={filters.actorEmail || ""}
                onChange={(e) => applyFilter({ actorEmail: e.target.value || undefined })}
              />
              <Select
                value={filters.action || "__all"}
                onValueChange={(v) => applyFilter({ action: v === "__all" ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder={t("activity.actionPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("activity.allActions")}</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.entityType || "__all"}
                onValueChange={(v) => applyFilter({ entityType: v === "__all" ? undefined : v })}
              >
                <SelectTrigger><SelectValue placeholder={t("activity.entityPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("activity.allEntities")}</SelectItem>
                  {entityTypes.map((tp) => (
                    <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={t("activity.entityIdPlaceholder")}
                value={filters.entityId || ""}
                onChange={(e) => applyFilter({ entityId: e.target.value || undefined })}
              />
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filters.from?.slice(0, 10) || ""}
                  onChange={(e) =>
                    applyFilter({ from: e.target.value ? new Date(e.target.value).toISOString() : undefined })
                  }
                  className="flex-1"
                />
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="icon" onClick={resetFilters} title="Clear filters">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Badge variant="secondary">{t("activity.filterActive", { count: activeFilterCount })}</Badge>
                <span>{t("activity.showingResults", { count: rows.length })}</span>
              </div>
            )}
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
                {t("activity.empty")}
              </CardContent>
            </Card>
          )}
          {rows.map((entry) => (
            <ActivityFeedRow key={entry.id} entry={entry} />
          ))}
        </div>

        {rows.length > 0 && count !== null && rows.length < count && (
          <div className="flex justify-center py-4">
            <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("activity.loadMore")}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "admin"])),
  },
});