import { useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight, ChevronDown, Search, Download, ArrowLeft, ArrowUpDown, Plus, FolderTree, Tag as TagIcon } from "lucide-react";
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

type Props = {
  storeId: string;
  mode: "categories" | "tags";
  search: string;
  onSearchChange: (v: string) => void;
  embedHeader?: boolean;
  storeName?: string;
  storeUrl?: string;
  onNewClick?: () => void;
};

const PAGE_SIZES = [25, 50, 100, 200, 500, 1000];

const SORT_OPTIONS: { field: TaxonomySortField; direction: TaxonomySortDirection; label: string }[] = [
  { field: "name", direction: "asc", label: "Name A→Z" },
  { field: "name", direction: "desc", label: "Name Z→A" },
  { field: "count", direction: "desc", label: "Most products" },
  { field: "count", direction: "asc", label: "Fewest products" },
  { field: "created_at", direction: "desc", label: "Recently added" },
];

export function TaxonomyTab({ storeId, mode, search, onSearchChange, embedHeader, storeName, storeUrl }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState(SORT_OPTIONS[0]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: pageRes, isLoading, isFetching } = useTaxonomyRows(storeId, mode, search, page, pageSize, sort.field, sort.direction);
  const { data: allCats } = useAllCategories(storeId, mode === "categories");

  const items = (pageRes?.data || []).map((t) => ({
    ...t,
    parent_woo_id: (t as { parent_id?: number }).parent_id ?? null,
  }));
  const total = pageRes?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showRefetchOverlay = isFetching && !isLoading && items.length > 0;
  const parentPool = mode === "categories"
    ? (allCats || []).map((t) => ({ ...t, parent_woo_id: (t as { parent_id?: number }).parent_id ?? null }))
    : [];

  function handleExport() {
    exportCsv(
      items,
      [
        { key: "woo_id", label: "Woo ID", accessor: (r) => r.woo_id },
        { key: "name", label: "Name", accessor: (r) => r.name },
        { key: "slug", label: "Slug", accessor: (r) => r.slug },
        { key: "description", label: "Description", accessor: (r) => r.description || "" },
        { key: "parent", label: "Parent Woo ID", accessor: (r) => (r as { parent_woo_id?: number | null }).parent_woo_id || "" },
        { key: "count", label: "Products", accessor: (r) => r.count || 0 },
      ],
      `${mode}-${storeName || storeId}`
    );
  }

  const singular = mode === "categories" ? "category" : "tag";
  const Icon = mode === "categories" ? FolderTree : TagIcon;

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" title={`Sort: ${sort.label}`}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="text-xs">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_OPTIONS.map((opt, i) => (
                  <DropdownMenuItem
                    key={i}
                    onClick={() => { setSort(opt); setPage(0); }}
                    className={sort.field === opt.field && sort.direction === opt.direction ? "bg-accent" : ""}
                  >
                    {opt.label}
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
                  value={search}
                  onChange={(e) => { onSearchChange(e.target.value); setPage(0); }}
                  placeholder={`Search ${mode}…`}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="h-9 px-2.5 gap-1.5" disabled={items.length === 0} onClick={handleExport} title="Export CSV">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Export</span>
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background h-9 px-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{total.toLocaleString()}</span>
              </div>
              {total > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Rows:</span>
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
                      {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ChevronRight className="h-3.5 w-3.5 rotate-180" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}><ChevronRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button size="sm" className="h-9 px-3 gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">New {singular}</span>
            </Button>
          </div>
        </div>
      </div>

      <Card className="relative">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Woo ID</TableHead>
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
                        {search ? `No ${mode} match "${search}"` : `No ${mode} yet`}
                      </p>
                      {!search && (
                        <p className="text-xs text-muted-foreground/70 mt-1">Create one or trigger a sync to pull them in.</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((t) => {
                    const isExpanded = expanded === t.id;
                    return (
                      <Fragment key={t.id}>
                        <TableRow
                          onClick={() => setExpanded(isExpanded ? null : t.id)}
                          className={`cursor-pointer ${isExpanded ? "bg-muted/30 hover:bg-muted/30" : "hover:bg-muted/30"}`}
                        >
                          <TableCell className="w-8">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium">{t.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                          <TableCell className="text-right tabular-nums">{t.count ?? 0}</TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-md truncate">{t.description || "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{t.woo_id ?? "—"}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={6} className="p-0">
                              <div onClick={(e) => e.stopPropagation()}>
                                <TaxonomyRowExpanded
                                  item={t}
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