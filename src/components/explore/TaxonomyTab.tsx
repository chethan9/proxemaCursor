import { useState, Fragment, useRef } from "react";
import { useTranslation } from "next-i18next";
import { formatNumber } from "@/lib/format-number";
import { ChevronRight, ChevronDown, Search, Download, ArrowUpDown, Plus, FolderTree, Tag as TagIcon, Award, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaxonomyRows, useAllCategories } from "@/hooks/queries/useTaxonomy";
import type { TaxonomySortField, TaxonomySortDirection } from "@/services/taxonomyService";
import { exportCsv } from "@/lib/exportCsv";
import { TaxonomyRowExpanded } from "./TaxonomyRowExpanded";
import { TaxonomyDialog } from "./TaxonomyDialog";
import { TableLoadingOverlay } from "@/components/ui/table-loading-overlay";
import { ProgressSlot } from "@/contexts/LoadingProvider";
import { useExplorerKeyboard } from "@/hooks/useExplorerKeyboard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";

type Props = {
  storeId: string;
  mode: "categories" | "tags" | "brands";
  search: string;
  onSearchChange: (v: string) => void;
  embedHeader?: boolean;
  storeName?: string;
  storeUrl?: string;
  onNewClick?: () => void;
};

const PAGE_SIZES = [25, 50, 100, 200, 500, 1000];

const SORT_OPTIONS: { field: TaxonomySortField; direction: TaxonomySortDirection; key: string }[] = [
  { field: "name", direction: "asc", key: "nameAsc" },
  { field: "name", direction: "desc", key: "nameDesc" },
  { field: "count", direction: "desc", key: "countDesc" },
  { field: "count", direction: "asc", key: "countAsc" },
  { field: "created_at", direction: "desc", key: "recent" },
];

export function TaxonomyTab({ storeId, mode, search, onSearchChange, storeName }: Props) {
  const { t, i18n } = useTranslation("site");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState(SORT_OPTIONS[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: pageRes, isLoading, isFetching } = useTaxonomyRows(storeId, mode, search, page, pageSize, sort.field, sort.direction);
  const { data: allCats } = useAllCategories(storeId, mode === "categories");

  const items = (pageRes?.data || []).map((t) => ({
    ...t,
    parent_woo_id: (t as { parent_id?: number }).parent_id ?? null,
  }));
  const total = pageRes?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showRefetchOverlay = isFetching && !isLoading && items.length > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);
  useExplorerKeyboard({
    searchRef: searchInputRef,
    onPrev: () => { if (page > 0 && !isFetching) setPage((p) => Math.max(0, p - 1)); },
    onNext: () => { if (page < totalPages - 1 && !isFetching) setPage((p) => p + 1); },
  });

  function handleExport() {
    exportCsv(
      items,
      [
        { key: "woo_id", label: t("taxonomy.columns.wooId"), accessor: (r) => r.woo_id },
        { key: "name", label: t("taxonomy.columns.name"), accessor: (r) => r.name },
        { key: "slug", label: t("taxonomy.columns.slug"), accessor: (r) => r.slug },
        { key: "description", label: t("taxonomy.columns.description"), accessor: (r) => r.description || "" },
        { key: "parent", label: "Parent Woo ID", accessor: (r) => (r as { parent_woo_id?: number | null }).parent_woo_id || "" },
        { key: "count", label: t("taxonomy.columns.products"), accessor: (r) => r.count || 0 },
      ],
      `${mode}-${storeName || storeId}`
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/wc/sync-taxonomy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Refresh failed (${res.status})`);
      toast({ title: t("taxonomy.toasts.synced", { count: data.synced ?? 0, mode }) });
      await qc.invalidateQueries({ queryKey: ["taxonomy", storeId, mode] });
      await qc.invalidateQueries({ queryKey: ["taxonomy-all-categories", storeId] });
      if (mode === "categories") {
        await qc.invalidateQueries({ queryKey: queryKeys.productCategoryOptions(storeId) });
      }
    } catch (e) {
      toast({ title: t("taxonomy.toasts.refreshFailed"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }

  const newLabel = mode === "categories" ? t("taxonomy.newCategory") : mode === "tags" ? t("taxonomy.newTag") : t("taxonomy.newBrand");
  const Icon = mode === "categories" ? FolderTree : mode === "tags" ? TagIcon : Award;

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur relative">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={`${t("taxonomy.sort")}: ${t(`taxonomy.sortOptions.${sort.key}`)}`}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("taxonomy.sort")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>{t("taxonomy.sortBy")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_OPTIONS.map((opt, i) => (
                  <DropdownMenuItem
                    key={i}
                    onClick={() => { setSort(opt); setPage(0); }}
                    className={sort.field === opt.field && sort.direction === opt.direction ? "bg-accent" : ""}
                  >
                    {t(`taxonomy.sortOptions.${opt.key}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 flex justify-center min-w-0">
            <div className="w-full max-w-[420px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => { onSearchChange(e.target.value); setPage(0); }}
                  placeholder={t("taxonomy.search", { mode })}
                  className="pl-9 pr-12 h-9"
                />
                {!search && (
                  <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground pointer-events-none">⌘K</kbd>
                )}
                {isFetching && search && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={items.length === 0} onClick={handleExport} title={t("taxonomy.export")}>
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">{t("taxonomy.export")}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={refreshing} onClick={handleRefresh} title={t("taxonomy.refreshTitle")}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="text-xs">{refreshing ? t("taxonomy.refreshing") : t("taxonomy.refresh")}</span>
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background h-9 px-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{formatNumber(total, i18n.language)}</span>
              </div>
              {total > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{t("taxonomy.rows")}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1">{pageSize}</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {PAGE_SIZES.map((n) => (
                          <DropdownMenuItem key={n} onClick={() => { setPageSize(n); setPage(0); }} className={pageSize === n ? "bg-accent" : ""}>{n}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="whitespace-nowrap">
                      {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {formatNumber(total, i18n.language)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || isFetching}><ChevronRight className="h-3.5 w-3.5 rotate-180" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || isFetching}><ChevronRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button size="sm" className="h-9 px-3 gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">{newLabel}</span>
            </Button>
          </div>
        </div>
        <ProgressSlot />
      </div>

      <Card className="relative">
        <CardContent className="p-0">
          <div className={cn("overflow-x-auto transition-opacity duration-150", isFetching && !isLoading && items.length > 0 && "opacity-70")}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t("taxonomy.columns.name")}</TableHead>
                  <TableHead>{t("taxonomy.columns.slug")}</TableHead>
                  <TableHead className="text-right">{t("taxonomy.columns.products")}</TableHead>
                  <TableHead>{t("taxonomy.columns.description")}</TableHead>
                  <TableHead className="text-right">{t("taxonomy.columns.wooId")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search ? t("taxonomy.empty.noMatch", { mode, search }) : t("taxonomy.empty.noItems", { mode })}
                      </p>
                      {!search && (
                        <p className="text-xs text-muted-foreground/70 mt-1">{t("taxonomy.empty.noItemsHint")}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const isExpanded = expanded === item.id;
                    return (
                      <Fragment key={item.id}>
                        <TableRow
                          onClick={() => setExpanded(isExpanded ? null : item.id)}
                          className={`cursor-pointer ${isExpanded ? "bg-muted/30 hover:bg-muted/30" : "hover:bg-muted/30"}`}
                        >
                          <TableCell className="w-8">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{item.slug}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.count ?? 0}</TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-md truncate">{item.description || "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{item.woo_id ?? "—"}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={6} className="p-0">
                              <div onClick={(e) => e.stopPropagation()}>
                                <TaxonomyRowExpanded
                                  item={item}
                                  mode={mode}
                                  storeId={storeId}
                                  onClose={() => setExpanded(null)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <TableLoadingOverlay show={showRefetchOverlay} />
      </Card>
      <TaxonomyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        storeId={storeId}
        mode={mode}
        parentOptions={mode === "categories" ? (allCats || []) : []}
      />
    </div>
  );
}