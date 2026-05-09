import { useState, Fragment, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { formatNumber } from "@/lib/format-number";
import { ChevronRight, ChevronDown, Search, Download, ArrowUpDown, FolderTree, Tag as TagIcon, Award, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { filterCategoriesForSearch, flattenCategoriesDfs } from "@/lib/category-tree";
import { exportCsv } from "@/lib/exportCsv";
import { CategoryTreePanel } from "./CategoryTreePanel";
import { logClientAuditEvent } from "@/lib/audit/client-log";
import { TaxonomyRowExpanded } from "./TaxonomyRowExpanded";
import { TaxonomyCreateForm } from "./TaxonomyCreateForm";
import { InfiniteScrollSentinel } from "./InfiniteScrollSentinel";
import { TableLoadingOverlay } from "@/components/ui/table-loading-overlay";
import { authorizedFetch } from "@/lib/api-client";
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
  storeName?: string;
  /** When true, Woo writes are disabled until initial catalog sync completes. */
  locked?: boolean;
};

const PAGE_SIZES = [25, 50, 100, 200, 500, 1000];

const SORT_OPTIONS: { field: TaxonomySortField; direction: TaxonomySortDirection; key: string }[] = [
  { field: "name", direction: "asc", key: "nameAsc" },
  { field: "name", direction: "desc", key: "nameDesc" },
  { field: "count", direction: "desc", key: "countDesc" },
  { field: "count", direction: "asc", key: "countAsc" },
  { field: "created_at", direction: "desc", key: "recent" },
];

export function TaxonomyTab({ storeId, mode, search, onSearchChange, storeName, locked = false }: Props) {
  const { t, i18n } = useTranslation("site");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 100;
    const v = parseInt(localStorage.getItem("taxonomy-page-size") || "100", 10);
    return PAGE_SIZES.includes(v) ? v : 100;
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("taxonomy-page-size", String(pageSize));
  }, [pageSize]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState(SORT_OPTIONS[0]);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: rows,
    count: totalPaged,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useTaxonomyRows(storeId, mode, search, pageSize, sort.field, sort.direction, mode !== "categories");
  const {
    data: allCats,
    isLoading: allCatsLoading,
    isFetching: allCatsFetching,
  } = useAllCategories(storeId, mode === "categories");

  const items = rows.map((t) => ({
    ...t,
    parent_woo_id: (t as { parent_id?: number }).parent_id ?? null,
  }));
  const total = mode === "categories" ? (allCats?.length ?? 0) : totalPaged;
  const listLoading = mode === "categories" ? allCatsLoading : isLoading;
  const showRefetchOverlay =
    mode === "categories"
      ? allCatsFetching && !allCatsLoading && (allCats?.length ?? 0) > 0
      : isFetching && !isLoading && !isFetchingNextPage && items.length > 0;
  const searchInputRef = useRef<HTMLInputElement>(null);
  useExplorerKeyboard({ searchRef: searchInputRef });
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function handleExport() {
    if (mode === "categories" && allCats?.length) {
      const byId = new Map(allCats.map((r) => [r.id, r] as const));
      const filtered = filterCategoriesForSearch(allCats, search);
      /** DFS row order (matches Browse tree / Woo menu order after sync). */
      const flat = flattenCategoriesDfs(filtered);
      const ordered = flat.map((f) => byId.get(f.id)).filter(Boolean) as typeof items;
      exportCsv(
        ordered,
        [
          { key: "woo_id", label: t("taxonomy.columns.wooId"), accessor: (r) => r.woo_id },
          { key: "name", label: t("taxonomy.columns.name"), accessor: (r) => r.name },
          { key: "slug", label: t("taxonomy.columns.slug"), accessor: (r) => r.slug },
          { key: "description", label: t("taxonomy.columns.description"), accessor: (r) => r.description || "" },
          { key: "parent", label: "Parent Woo ID", accessor: (r) => (r as { parent_id?: number | null }).parent_id || "" },
          { key: "count", label: t("taxonomy.columns.products"), accessor: (r) => r.count || 0 },
        ],
        `${mode}-${storeName || storeId}`,
      );
      void logClientAuditEvent({
        action: "sites.taxonomy.export_csv",
        entityType: "store",
        entityId: storeId,
        storeId,
        metadata: { taxonomy_mode: mode, row_count: ordered.length },
      });
      return;
    }
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
    void logClientAuditEvent({
      action: "sites.taxonomy.export_csv",
      entityType: "store",
      entityId: storeId,
      storeId,
      metadata: { taxonomy_mode: mode, row_count: items.length },
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await authorizedFetch(`/api/stores/${storeId}/wc/sync-taxonomy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Refresh failed (${res.status})`);
      toast({ title: t("taxonomy.toasts.synced", { count: data.synced ?? 0, mode }) });
      await qc.invalidateQueries({ queryKey: ["taxonomy", mode, storeId] });
      await qc.invalidateQueries({ queryKey: queryKeys.taxonomy(storeId, mode) });
      if (mode === "categories") {
        await qc.invalidateQueries({ queryKey: [...queryKeys.taxonomy(storeId, "categories"), "all"] });
        await qc.invalidateQueries({ queryKey: queryKeys.productCategoryOptions(storeId) });
      }
    } catch (e) {
      toast({ title: t("taxonomy.toasts.refreshFailed"), description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }

  const Icon = mode === "categories" ? FolderTree : mode === "tags" ? TagIcon : Award;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t(`taxonomy.pageTitle.${mode}`)}</h2>
          <p className="text-sm text-muted-foreground">{t(`taxonomy.pageSubtitle.${mode}`)}</p>
        </div>
        <div className="w-full max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("taxonomy.search", { mode })}
              className="pl-9 pr-12 h-9"
              aria-label={t("taxonomy.search", { mode })}
            />
            {!search && (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground pointer-events-none">
                ⌘K
              </kbd>
            )}
            {(mode === "categories" ? allCatsFetching : isFetching) && search && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
            )}
          </div>
        </div>
      </div>

      <ProgressSlot />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-4">
          <TaxonomyCreateForm
            storeId={storeId}
            siteName={storeName}
            mode={mode}
            parentOptions={mode === "categories" ? (allCats || []) : []}
            locked={locked}
          />
        </div>

        <div className="lg:col-span-8 space-y-3">
          <Card className="relative border-border bg-card">
            <CardHeader className="pb-2 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">{t("taxonomy.tableSectionTitle")}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {mode !== "categories" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-2.5 gap-1.5"
                          title={`${t("taxonomy.sort")}: ${t(`taxonomy.sortOptions.${sort.key}`)}`}
                        >
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
                            onClick={() => setSort(opt)}
                            className={sort.field === opt.field && sort.direction === opt.direction ? "bg-accent" : ""}
                          >
                            {t(`taxonomy.sortOptions.${opt.key}`)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 gap-1.5"
                    disabled={mode === "categories" ? (allCats?.length ?? 0) === 0 : items.length === 0}
                    onClick={handleExport}
                    title={t("taxonomy.export")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="text-xs">{t("taxonomy.export")}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 gap-1.5"
                    disabled={refreshing}
                    onClick={handleRefresh}
                    title={t("taxonomy.refreshTitle")}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                    <span className="text-xs">{refreshing ? t("taxonomy.refreshing") : t("taxonomy.refresh")}</span>
                  </Button>

                  <div className="flex items-center gap-2 rounded-md border border-border bg-background h-9 px-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      <span className="font-medium">{formatNumber(total, i18n.language)}</span>
                    </div>
                    {total > 0 && mode !== "categories" && (
                      <>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{t("taxonomy.batchLabel")}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs gap-1" title={t("taxonomy.batchRowsTitle")}>
                                {pageSize}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {PAGE_SIZES.map((n) => (
                                <DropdownMenuItem key={n} onClick={() => setPageSize(n)} className={pageSize === n ? "bg-accent" : ""}>
                                  {n}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <span className="whitespace-nowrap">
                            {formatNumber(items.length, i18n.language)} / {formatNumber(total, i18n.language)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-0 border-t border-border/60">
              {mode === "categories" ? (
                <CategoryTreePanel storeId={storeId} search={search} locked={locked} />
              ) : (
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
                    {listLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={6}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-16">
                          <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {search ? t("taxonomy.empty.noMatch", { mode, search }) : t("taxonomy.empty.noItems", { mode })}
                          </p>
                          {!search && <p className="text-xs text-muted-foreground/70 mt-1">{t("taxonomy.empty.noItemsHint")}</p>}
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => {
                        const isExpanded = expanded === item.id;
                        return (
                          <Fragment key={item.id}>
                            <TableRow
                              onClick={() => setExpanded(isExpanded ? null : item.id)}
                              className={
                                isExpanded
                                  ? "cursor-pointer border-b-0 bg-muted/25 hover:bg-muted/25"
                                  : "cursor-pointer hover:bg-muted/30"
                              }
                            >
                              <TableCell className="w-8">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{item.slug}</TableCell>
                              <TableCell className="text-right tabular-nums">{item.count ?? 0}</TableCell>
                              <TableCell className="text-muted-foreground text-xs max-w-md truncate">{item.description || "—"}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">{item.woo_id ?? "—"}</TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="border-0 bg-muted/25 hover:bg-muted/25">
                                <TableCell colSpan={6} className="border-0 p-0">
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <TaxonomyRowExpanded
                                      item={item}
                                      mode={mode}
                                      storeId={storeId}
                                      onClose={() => setExpanded(null)}
                                      locked={locked}
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
                {!isLoading && items.length > 0 && (
                  <InfiniteScrollSentinel
                    hasMore={hasNextPage}
                    isLoading={isFetchingNextPage}
                    onLoadMore={handleLoadMore}
                    loaded={items.length}
                    total={totalPaged}
                  />
                )}
              </div>
              )}
            </CardContent>
            <TableLoadingOverlay show={showRefetchOverlay} />
          </Card>
        </div>
      </div>
    </div>
  );
}
