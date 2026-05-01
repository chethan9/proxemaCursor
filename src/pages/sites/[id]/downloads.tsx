import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { formatDateTime, formatNumber } from "@/lib/format-number";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, FileSpreadsheet, Files, Receipt, Search, Download as DownloadIcon, Filter, RefreshCw, Trash2, Loader2, Layers, Eye,
} from "lucide-react";
import { useSiteDownloads } from "@/hooks/queries/useSiteDownloads";
import { dismissJobArtifact, type DownloadFile } from "@/services/downloadsService";
import { acknowledgeDownloadArtifacts } from "@/lib/downloads-artifacts-ack";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfiniteScrollSentinel } from "@/components/explore/InfiniteScrollSentinel";
import { cn } from "@/lib/utils";

/** Target density on wide screens; fewer columns on smaller breakpoints. */
const GRID_COLS_CLASS =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3";
const ITEMS_PER_ROW_LG = 7;
const INITIAL_VISIBLE_ROWS = 3;
const LOAD_MORE_ROWS = 1;

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

function formatDate(d: string | null, locale?: string): string {
  if (!d) return "—";
  return formatDateTime(d, locale, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function isPdfFile(file: DownloadFile): boolean {
  return /\.pdf$/i.test(file.file_name);
}

function DownloadsInner() {
  const { id, store, loading } = useSiteFromRoute();
  const { t, i18n } = useTranslation("site");
  const { data: files = [], isLoading, isFetching } = useSiteDownloads(id);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<DownloadFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewBlobRef = useRef<string | null>(null);

  const revokePreviewBlob = useCallback(() => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const closePreview = useCallback(() => {
    revokePreviewBlob();
    setPreviewFile(null);
    setPreviewOpen(false);
    setPreviewLoading(false);
  }, [revokePreviewBlob]);

  useEffect(() => () => {
    if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
  }, []);

  /** Visiting Downloads acknowledges every listed artifact so the sidebar badge clears. */
  useEffect(() => {
    if (!id || files.length === 0) return;
    acknowledgeDownloadArtifacts(
      id,
      files.map((f) => f.id),
    );
  }, [id, files]);

  const fetchDownloadBlob = useCallback(async (file: DownloadFile): Promise<Blob> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("SIGN_IN");
    const res = await fetch(file.download_url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow",
      cache: "no-store",
    });
    if (res.status === 410) {
      const j = await res.json().catch(() => ({}));
      throw Object.assign(new Error(String(j.error || "GONE")), { status: 410 });
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(String(j.error || `HTTP ${res.status}`));
    }
    return res.blob();
  }, []);

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

  const filterSig = useMemo(() => filtered.map((f) => f.id).join(","), [filtered]);

  const initialVisibleCap = ITEMS_PER_ROW_LG * INITIAL_VISIBLE_ROWS;
  const [visibleCount, setVisibleCount] = useState(initialVisibleCap);

  useEffect(() => {
    setVisibleCount(Math.min(initialVisibleCap, filtered.length));
  }, [filterSig, filtered.length, initialVisibleCap]);

  const visibleFiles = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const loadMoreGrid = useCallback(() => {
    setVisibleCount((c) => Math.min(c + ITEMS_PER_ROW_LG * LOAD_MORE_ROWS, filtered.length));
  }, [filtered.length]);

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
      const blob = await fetchDownloadBlob(file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      acknowledgeDownloadArtifacts(id, [file.id]);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.message === "SIGN_IN") {
        toast({ title: t("downloads.toasts.signInRequired"), variant: "destructive" });
        return;
      }
      if (err.status === 410) {
        toast({ title: t("downloads.toasts.archiveExpired"), description: t("downloads.toasts.autoDeleted"), variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["site-downloads"] });
        return;
      }
      toast({ title: t("downloads.toasts.downloadFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDownloadingIds((p) => { const n = new Set(p); n.delete(file.id); return n; });
    }
  };

  const openPreview = async (file: DownloadFile) => {
    if (!isPdfFile(file)) {
      toast({ title: t("downloads.previewUnavailable"), description: t("downloads.previewUnavailableDesc"), variant: "destructive" });
      return;
    }
    if (!file.download_url) {
      toast({ title: t("downloads.toasts.unavailable"), description: t("downloads.toasts.notDownloadable"), variant: "destructive" });
      return;
    }
    setPreviewFile(file);
    setPreviewOpen(true);
    setPreviewLoading(true);
    revokePreviewBlob();
    try {
      const blob = await fetchDownloadBlob(file);
      const url = URL.createObjectURL(blob);
      previewBlobRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.message === "SIGN_IN") {
        toast({ title: t("downloads.toasts.signInRequired"), variant: "destructive" });
        closePreview();
        return;
      }
      if (err.status === 410) {
        toast({ title: t("downloads.toasts.archiveExpired"), description: t("downloads.toasts.autoDeleted"), variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["site-downloads"] });
        closePreview();
        return;
      }
      toast({ title: t("downloads.toasts.downloadFailed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
      closePreview();
    } finally {
      setPreviewLoading(false);
    }
  };

  const dismissFile = async (file: DownloadFile) => {
    if (file.source !== "bulk_job") return;
    const closePreviewAfter = previewFile?.id === file.id;
    try {
      await dismissJobArtifact(file.id);
      qc.invalidateQueries({ queryKey: ["site-downloads"] });
      setSelected((p) => { const n = new Set(p); n.delete(file.id); return n; });
      if (closePreviewAfter) closePreview();
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
    { key: "all", label: t("downloads.tiles.all"), icon: Files, count: stats.all, cls: "bg-foreground/[0.06] text-foreground" },
    { key: "invoice", label: t("downloads.tiles.invoice"), icon: TYPE_BADGE.invoice.icon, count: stats.invoice, cls: TYPE_BADGE.invoice.tile },
    { key: "packing_slip", label: t("downloads.tiles.packingSlip"), icon: TYPE_BADGE.packing_slip.icon, count: stats.packing_slip, cls: TYPE_BADGE.packing_slip.tile },
    { key: "credit_note", label: t("downloads.tiles.creditNote"), icon: TYPE_BADGE.credit_note.icon, count: stats.credit_note, cls: TYPE_BADGE.credit_note.tile },
    { key: "report", label: t("downloads.tiles.report"), icon: TYPE_BADGE.report.icon, count: stats.report, cls: TYPE_BADGE.report.tile },
  ];

  return (
    <div className="p-4 space-y-3 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight">{t("downloads.title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t("downloads.subtitle", { name: store.name })}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href={`/sites/${id}/bulk-jobs`}>
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              {t("downloads.bulkJobsLink")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => qc.invalidateQueries({ queryKey: ["site-downloads"] })}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            {t("downloads.refresh")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {tiles.map((ti) => {
          const Icon = ti.icon;
          const active = (ti.key === "all" && typeFilter === "all") || typeFilter === ti.key;
          return (
            <button
              key={ti.key}
              type="button"
              onClick={() => setTypeFilter(ti.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left transition",
                active ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border/80 bg-card hover:bg-muted/50",
              )}
            >
              <div className={cn("h-6 w-6 rounded flex items-center justify-center shrink-0", ti.cls)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold tabular-nums leading-none">{formatNumber(ti.count, i18n.language)}</span>
                <span className="text-[10px] text-muted-foreground block truncate max-w-[7rem]">{ti.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-3.5 w-3.5 rounded border-border shrink-0"
              aria-label={t("downloads.selectAll")}
            />
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={t("downloads.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("downloads.filters.allTypes")}</SelectItem>
                <SelectItem value="invoice">{t("downloads.tiles.invoice")}</SelectItem>
                <SelectItem value="packing_slip">{t("downloads.tiles.packingSlip")}</SelectItem>
                <SelectItem value="credit_note">{t("downloads.tiles.creditNote")}</SelectItem>
                <SelectItem value="report">{t("downloads.tiles.report")}</SelectItem>
              </SelectContent>
            </Select>
            {(search || typeFilter !== "all") && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(""); setTypeFilter("all"); }}>
                {t("downloads.filters.clear")}
              </Button>
            )}
            <div className="flex-1 min-w-[8px]" />
            {selected.size > 0 && (
              <>
                <span className="text-[11px] text-muted-foreground">{t("downloads.selected", { count: selected.size })}</span>
                <Button size="sm" className="h-8 gap-1 text-xs" onClick={downloadSelected}>
                  <DownloadIcon className="h-3 w-3" />
                  {t("downloads.downloadSelected")}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              {t("downloads.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4 text-xs text-muted-foreground">
              <Files className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium mb-1 text-sm text-foreground">
                {files.length === 0 ? t("downloads.empty.noFiles") : t("downloads.empty.noMatches")}
              </p>
              <p>{files.length === 0 ? t("downloads.empty.noFilesHint") : t("downloads.empty.noMatchesHint")}</p>
            </div>
          ) : (
            <>
              <div className={cn(GRID_COLS_CLASS, "p-3 pt-2")}>
                {visibleFiles.map((f) => {
                  const meta = TYPE_BADGE[f.type];
                  const Icon = meta.icon;
                  const exp = expiresIn(f.expires_at);
                  const isDownloading = downloadingIds.has(f.id);
                  const sel = selected.has(f.id);
                  const pdf = isPdfFile(f);
                  return (
                    <div
                      key={f.id}
                      role={pdf && f.download_url ? "button" : undefined}
                      tabIndex={pdf && f.download_url ? 0 : undefined}
                      data-state={sel ? "selected" : undefined}
                      className={cn(
                        "relative rounded-lg border border-border/80 bg-card p-2.5 flex flex-col gap-1.5 text-left transition-colors hover:bg-muted/35 min-h-[148px]",
                        sel && "ring-2 ring-primary/25 bg-primary/[0.04]",
                        pdf && f.download_url && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                      onClick={(e) => {
                        const el = e.target as HTMLElement;
                        if (el.closest("button, input")) return;
                        if (pdf && f.download_url) void openPreview(f);
                      }}
                      onKeyDown={(e) => {
                        if (!pdf || !f.download_url) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void openPreview(f);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleOne(f.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 rounded border-border mt-0.5 shrink-0"
                          aria-label={t("downloads.selectFile", { name: f.file_name })}
                        />
                        <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", meta.tile)}>
                          <Icon className="h-4 w-4 opacity-90" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-5 font-normal w-fit max-w-full truncate", meta.badge)}>
                            {t(TYPE_LABEL_KEY[f.type])}
                          </Badge>
                          <p className="text-[11px] font-semibold leading-snug line-clamp-2 break-words" title={f.file_name}>
                            {f.file_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground space-y-0.5 pl-6 sm:pl-0 sm:ml-0 border-t border-border/50 pt-1.5 flex-1 min-h-0">
                        <p className="truncate" title={f.reference ?? undefined}>{f.reference ?? "—"}</p>
                        <p className="truncate hidden sm:block" title={f.customer ?? undefined}>{f.customer ?? "—"}</p>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 border-t border-border/50">
                        <span className="whitespace-nowrap">{formatDate(f.generated_at, i18n.language)}</span>
                        <span className="font-mono tabular-nums">{formatBytes(f.size_bytes)}</span>
                        <span className={cn("font-mono whitespace-nowrap", exp.cls)}>{exp.label}</span>
                      </div>
                      <div className="flex justify-end gap-0.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        {pdf && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={t("downloads.actions.preview")}
                            aria-label={t("downloads.actions.preview")}
                            onClick={() => void openPreview(f)}
                            disabled={!f.download_url || (previewLoading && previewFile?.id === f.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={t("downloads.actions.download")}
                          aria-label={t("downloads.actions.download")}
                          onClick={() => downloadFile(f)}
                          disabled={isDownloading || !f.download_url}
                        >
                          {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadIcon className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title={t("downloads.actions.remove")}
                          aria-label={t("downloads.actions.remove")}
                          onClick={() => dismissFile(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <InfiniteScrollSentinel
                hasMore={visibleCount < filtered.length}
                isLoading={false}
                onLoadMore={loadMoreGrid}
                loaded={visibleFiles.length}
                total={filtered.length}
                scrollDepthThreshold={0.35}
                rootMargin="320px"
              />
            </>
          )}
          {!isLoading && filtered.length > 0 && (
            <p className="text-[10px] text-muted-foreground px-3 py-2 border-t border-border/80">{t("downloads.gridHint")}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-5xl w-[min(96vw,56rem)] p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]" showClose>
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm font-medium truncate pr-8">
              {previewFile ? t("downloads.previewTitle", { name: previewFile.file_name }) : t("downloads.preview")}
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex-1 min-h-[70vh] bg-muted/30">
            {previewLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground z-10 bg-background/80">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-xs">{t("downloads.previewLoading")}</span>
              </div>
            )}
            {previewUrl && !previewLoading && (
              <iframe
                title={previewFile?.file_name ?? "PDF preview"}
                src={previewUrl}
                className="w-full min-h-[70vh] h-[70vh] border-0 bg-background"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
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
