import { useState, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, FileSpreadsheet, Files, Receipt, Search, Download as DownloadIcon, Filter, RefreshCw, Trash2, Loader2, Layers } from "lucide-react";
import { useSiteDownloads } from "@/hooks/queries/useSiteDownloads";
import { dismissJobArtifact, type DownloadFile } from "@/services/downloadsService";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TYPE_BADGE: Record<DownloadFile["type"], { icon: React.ComponentType<{ className?: string }>; badge: string; tile: string }> = {
  invoice: {
    icon: FileText,
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
    tile: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  },
  packing_slip: {
    icon: FileSpreadsheet,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
    tile: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
  credit_note: {
    icon: Receipt,
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    tile: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  },
  report: {
    icon: FileText,
    badge: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900",
    tile: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  },
};

const TYPE_LABEL_KEY: Record<DownloadFile["type"], string> = {
  invoice: "downloads.types.invoice",
  packing_slip: "downloads.types.packingSlip",
  credit_note: "downloads.types.creditNote",
  report: "downloads.types.report",
};

function formatBytes(b: number | null): string {
  if (!b || b <= 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DownloadsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const { t } = useTranslation("site");
  const { data: files = [], isLoading, isFetching } = useSiteDownloads(id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  function expiresIn(expiresAt: string | null): { label: string; cls: string } {
    if (!expiresAt) return { label: "—", cls: "text-muted-foreground" };
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return { label: t("downloads.expired"), cls: "text-destructive" };
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days >= 1) return { label: t("downloads.daysLeft", { days }), cls: days <= 1 ? "text-amber-600" : "text-muted-foreground" };
    return { label: t("downloads.hoursLeft", { hours }), cls: "text-amber-600" };
  }

  const stats = useMemo(() => {
    const counts = { all: 0, invoice: 0, packing_slip: 0, credit_note: 0, report: 0 };
    for (const f of files) {
      counts.all++;
      counts[f.type]++;
    }
    return counts;
  }, [files]);

  const filtered = useMemo(() => {
    return files.filter((f) => {
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (search) {
        const hay = `${f.file_name} ${f.reference ?? ""} ${f.customer ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [files, typeFilter, search]);

  const allSelected = filtered.length > 0 && filtered.every((f) => selected.has(f.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.id)));
  };
  const toggleOne = (fid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });
  };

  const downloadFile = async (file: DownloadFile) => {
    if (!file.download_url) {
      toast({ title: t("downloads.toasts.unavailable"), description: t("downloads.toasts.notDownloadable"), variant: "destructive" });
      return;
    }
    setDownloadingIds((p) => { const n = new Set(p); n.add(file.id); return n; });
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast({ title: t("downloads.toasts.signInRequired"), variant: "destructive" });
        return;
      }
      const res = await fetch(file.download_url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "follow",
      });
      if (res.status === 410) {
        const j = await res.json().catch(() => ({}));
        toast({ title: t("downloads.toasts.archiveExpired"), description: j.error || t("downloads.toasts.autoDeleted"), variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["site-downloads"] });
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: t("downloads.toasts.downloadFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDownloadingIds((p) => { const n = new Set(p); n.delete(file.id); return n; });
    }
  };

  const dismissFile = async (file: DownloadFile) => {
    if (file.source !== "bulk_job") return;
    try {
      await dismissJobArtifact(file.id);
      qc.invalidateQueries({ queryKey: ["site-downloads"] });
      setSelected((p) => { const n = new Set(p); n.delete(file.id); return n; });
      toast({ title: t("downloads.toasts.removed") });
    } catch (e) {
      toast({ title: t("downloads.toasts.removeFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const downloadSelected = async () => {
    const targets = filtered.filter((f) => selected.has(f.id));
    for (const tt of targets) await downloadFile(tt);
  };

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  const tiles = [
    { key: "all", label: t("downloads.tiles.all"), icon: Files, count: stats.all, cls: "bg-foreground/[0.05] text-foreground" },
    { key: "invoice", label: t("downloads.tiles.invoice"), icon: TYPE_BADGE.invoice.icon, count: stats.invoice, cls: TYPE_BADGE.invoice.tile },
    { key: "packing_slip", label: t("downloads.tiles.packingSlip"), icon: TYPE_BADGE.packing_slip.icon, count: stats.packing_slip, cls: TYPE_BADGE.packing_slip.tile },
    { key: "credit_note", label: t("downloads.tiles.creditNote"), icon: TYPE_BADGE.credit_note.icon, count: stats.credit_note, cls: TYPE_BADGE.credit_note.tile },
    { key: "report", label: t("downloads.tiles.report"), icon: TYPE_BADGE.report.icon, count: stats.report, cls: TYPE_BADGE.report.tile },
  ];

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("downloads.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("downloads.subtitle", { name: store.name })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/sites/${id}/bulk-jobs`}>
              <Layers className="h-4 w-4 mr-2" />
              {t("downloads.bulkJobsLink")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["site-downloads"] })}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            {t("downloads.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {tiles.map((ti) => {
          const Icon = ti.icon;
          const active = (ti.key === "all" && typeFilter === "all") || typeFilter === ti.key;
          return (
            <button
              key={ti.key}
              onClick={() => setTypeFilter(ti.key)}
              className={`text-left transition ${active ? "ring-2 ring-primary/40" : ""}`}
            >
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${ti.cls}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-semibold tabular-nums">{ti.count.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground truncate">{ti.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={t("downloads.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("downloads.filters.allTypes")}</SelectItem>
                <SelectItem value="invoice">{t("downloads.tiles.invoice")}</SelectItem>
                <SelectItem value="packing_slip">{t("downloads.tiles.packingSlip")}</SelectItem>
                <SelectItem value="credit_note">{t("downloads.tiles.creditNote")}</SelectItem>
                <SelectItem value="report">{t("downloads.tiles.report")}</SelectItem>
              </SelectContent>
            </Select>
            {(search || typeFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter("all"); }}>
                {t("downloads.filters.clear")}
              </Button>
            )}
            <div className="flex-1" />
            {selected.size > 0 && (
              <>
                <span className="text-xs text-muted-foreground">{t("downloads.selected", { count: selected.size })}</span>
                <Button size="sm" onClick={downloadSelected} className="gap-1.5">
                  <DownloadIcon className="h-3.5 w-3.5" />
                  {t("downloads.downloadSelected")}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border"
                    aria-label={t("downloads.selectAll")}
                  />
                </TableHead>
                <TableHead>{t("downloads.columns.fileName")}</TableHead>
                <TableHead>{t("downloads.columns.type")}</TableHead>
                <TableHead>{t("downloads.columns.orderRef")}</TableHead>
                <TableHead>{t("downloads.columns.customer")}</TableHead>
                <TableHead>{t("downloads.columns.generated")}</TableHead>
                <TableHead>{t("downloads.columns.expires")}</TableHead>
                <TableHead className="text-right">{t("downloads.columns.size")}</TableHead>
                <TableHead className="text-right">{t("downloads.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    {t("downloads.loading")}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-sm text-muted-foreground">
                    <Files className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">
                      {files.length === 0 ? t("downloads.empty.noFiles") : t("downloads.empty.noMatches")}
                    </p>
                    <p className="text-xs">
                      {files.length === 0 ? t("downloads.empty.noFilesHint") : t("downloads.empty.noMatchesHint")}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((f) => {
                  const meta = TYPE_BADGE[f.type];
                  const Icon = meta.icon;
                  const exp = expiresIn(f.expires_at);
                  const isDownloading = downloadingIds.has(f.id);
                  return (
                    <TableRow key={f.id} className={selected.has(f.id) ? "bg-muted/30" : ""}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(f.id)}
                          onChange={() => toggleOne(f.id)}
                          className="h-4 w-4 rounded border-border"
                          aria-label={t("downloads.selectFile", { name: f.file_name })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-8 w-8 shrink-0 rounded flex items-center justify-center ${meta.tile}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="truncate font-medium text-sm">{f.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${meta.badge}`}>
                          {t(TYPE_LABEL_KEY[f.type])}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.reference ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.customer ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(f.generated_at)}</TableCell>
                      <TableCell className={`text-xs font-mono ${exp.cls}`}>{exp.label}</TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">{formatBytes(f.size_bytes)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5"
                            onClick={() => downloadFile(f)}
                            disabled={isDownloading || !f.download_url}
                          >
                            {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadIcon className="h-3.5 w-3.5" />}
                            <span className="text-xs">{t("downloads.actions.download")}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => dismissFile(f)}
                            title={t("downloads.actions.remove")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DownloadsPage() {
  return (
    <SitePageShell>
      <DownloadsInner />
    </SitePageShell>
  );
}

export const getServerSideProps = async ({ locale }: { locale?: string }) => {
  const { serverSideTranslations } = await import("next-i18next/serverSideTranslations");
  return {
    props: {
      ...(await serverSideTranslations(locale ?? "en", ["common", "site"])),
    },
  };
};