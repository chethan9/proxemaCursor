import { useState, Fragment } from "react";
import { ChevronRight, ChevronDown, Search, Download, ArrowLeft, Filter as FilterIcon, FolderTree, Tag as TagIcon } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaxonomyRows, useAllCategories } from "@/hooks/queries/useTaxonomy";
import { exportCsv } from "@/lib/exportCsv";
import { TaxonomyRowExpanded } from "./TaxonomyRowExpanded";

type Props = {
  storeId: string;
  mode: "categories" | "tags";
  search: string;
  onSearchChange: (v: string) => void;
  embedHeader?: boolean;
  storeName?: string;
  storeUrl?: string;
};

const PAGE_SIZES = [25, 50, 100, 200];

export function TaxonomyTab({ storeId, mode, search, onSearchChange, embedHeader, storeName, storeUrl }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: pageRes, isLoading } = useTaxonomyRows(storeId, mode, search, page, pageSize);
  const { data: allCats } = useAllCategories(storeId, mode === "categories");

  const items = (pageRes?.data || []).map((t) => ({ ...t, parent_woo_id: (t as { parent_id?: number }).parent_id ?? null }));
  const total = pageRes?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const parentPool = mode === "categories" ? (allCats || []).map((t) => ({ ...t, parent_woo_id: (t as { parent_id?: number }).parent_id ?? null })) : [];

  function handleExport() {
    const rows = items;
    exportCsv(
      rows,
      [
        { key: "woo_id", label: "Woo ID", accessor: (r) => r.woo_id },
        { key: "name", label: "Name", accessor: (r) => r.name },
        { key: "slug", label: "Slug", accessor: (r) => r.slug },
        { key: "description", label: "Description", accessor: (r) => r.description || "" },
        { key: "parent", label: "Parent Woo ID", accessor: (r) => r.parent_woo_id || "" },
        { key: "count", label: "Products", accessor: (r) => r.count || 0 },
      ],
      `${mode}-${storeName || storeId}`
    );
  }

  return (
    <div className="space-y-4">
      {embedHeader && (
        <div className="flex items-start gap-3">
          <Link href={`/sites/${storeId}/home`} className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-muted transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            {mode === "categories" ? <FolderTree className="h-5 w-5 text-muted-foreground shrink-0" /> : <TagIcon className="h-5 w-5 text-muted-foreground shrink-0" />}
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{storeName || "Site"}</h1>
              <div className="text-xs text-muted-foreground truncate">{storeUrl}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm transition-colors" disabled>
          <FilterIcon className="h-3.5 w-3.5" />
          <span>Filter</span>
        </button>

        <div className="flex-1 min-w-[240px] max-w-xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { onSearchChange(e.target.value); setPage(1); }}
            placeholder={`Search ${mode}...`}
            className="h-9 pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {mode === "categories" ? <FolderTree className="h-3.5 w-3.5" /> : <TagIcon className="h-3.5 w-3.5" />}
            {total}
          </span>
          <span className="text-border">·</span>
          <span>Rows:</span>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-7 px-1.5 rounded border border-border bg-background text-xs">
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span>{total === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}</span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="h-7 w-7 inline-flex items-center justify-center rounded border border-border bg-background hover:bg-muted disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            </button>
            <button onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="h-7 w-7 inline-flex items-center justify-center rounded border border-border bg-background hover:bg-muted disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <button onClick={handleExport} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm transition-colors">
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </button>
      </div>

      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
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
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  {search ? `No ${mode} match "${search}"` : `No ${mode} yet`}
                </TableCell>
              </TableRow>
            ) : (
              items.map((t) => {
                const isExpanded = expanded === t.id;
                return (
                  <Fragment key={t.id}>
                    <TableRow
                      onClick={() => setExpanded(isExpanded ? null : t.id)}
                      className={`cursor-pointer border-b border-border ${isExpanded ? "bg-muted/20 hover:bg-muted/20" : "hover:bg-muted/20"}`}
                    >
                      <TableCell className="w-8 py-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="py-3 font-medium">{t.name}</TableCell>
                      <TableCell className="py-3 font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                      <TableCell className="py-3 text-right tabular-nums">{t.count ?? 0}</TableCell>
                      <TableCell className="py-3 text-muted-foreground text-xs max-w-md truncate">{t.description || "—"}</TableCell>
                      <TableCell className="py-3 text-right font-mono text-xs text-muted-foreground">{t.woo_id ?? "—"}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border">
                        <TableCell colSpan={6} className="p-0">
                          <TaxonomyRowExpanded taxon={t} mode={mode} allTaxons={parentPool} storeUrl={storeUrl} />
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
    </div>
  );
}