import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, FolderTree, Tag as TagIcon, Download, ChevronDown, ChevronRight } from "lucide-react";
import { fetchCategories, fetchTags, type CategoryRow, type TagRow } from "@/services/taxonomyService";
import { TaxonomyRowExpanded } from "./TaxonomyRowExpanded";

type Mode = "categories" | "tags";

export function TaxonomyTab({ storeId, mode }: { storeId: string; mode: Mode }) {
  const [rows, setRows] = useState<(CategoryRow | TagRow)[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); setExpandedId(null); }, [debounced, storeId, mode]);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const fn = mode === "categories" ? fetchCategories : fetchTags;
      const { data, count } = await fn(storeId, debounced, page, pageSize);
      setRows(data);
      setCount(count);
    } catch (e) {
      console.error(`Load ${mode} failed:`, e);
    } finally {
      setLoading(false);
    }
  }, [storeId, mode, debounced, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (mode !== "categories" || !storeId) return;
    fetchCategories(storeId, "", 0, 500).then(({ data }) => setAllCategories(data)).catch(() => {});
  }, [mode, storeId]);

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = ["ID", "Woo ID", "Name", "Slug", "Count", "Description"].join(",");
    const lines = rows.map((r) => {
      const desc = (r as CategoryRow).description || "";
      const vals = [r.id, r.woo_id, r.name || "", r.slug || "", r.count ?? "", desc.replace(/<[^>]+>/g, "").slice(0, 200)];
      return vals.map((v) => {
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(",");
    }).join("\n");
    const blob = new Blob([`${header}\n${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mode}-${storeId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Icon = mode === "categories" ? FolderTree : TagIcon;
  const colSpan = mode === "categories" ? 6 : 5;

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur border-b border-border">
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 flex justify-center min-w-[200px]">
                <div className="relative w-full max-w-[360px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${mode}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={exportCsv} disabled={rows.length === 0} title="Export CSV">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border h-6">
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{count.toLocaleString()}</span>
              </div>
            </div>

            {count > 0 && (
              <div className="flex items-center justify-end gap-3 pt-2 mt-2 border-t border-border text-xs">
                <span className="text-muted-foreground">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
                  <span className="px-2 font-medium">Page {page + 1} / {Math.max(1, Math.ceil(count / pageSize))}</span>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= count}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Products</TableHead>
                {mode === "categories" && <TableHead>Description</TableHead>}
                <TableHead className="text-right">Woo ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    {mode === "categories" && <TableCell><Skeleton className="h-4 w-48" /></TableCell>}
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-16">
                    <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No {mode} found</p>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const desc = mode === "categories" ? ((r as CategoryRow).description || "").replace(/<[^>]+>/g, "") : "";
                  const isExpanded = expandedId === r.id;
                  return (
                    <>
                      <TableRow
                        key={r.id}
                        className={`hover:bg-muted/30 cursor-pointer ${isExpanded ? "bg-muted/30" : ""}`}
                        onClick={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                      >
                        <TableCell>
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium">{r.name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.slug || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{r.count ?? 0}</TableCell>
                        {mode === "categories" && (
                          <TableCell className="text-xs text-muted-foreground max-w-[360px] truncate">{desc || "—"}</TableCell>
                        )}
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{r.woo_id}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${r.id}-exp`} className="hover:bg-transparent">
                          <TableCell colSpan={colSpan} className="p-0">
                            {mode === "categories" ? (
                              <TaxonomyRowExpanded
                                mode="categories"
                                storeId={storeId}
                                row={r as CategoryRow}
                                parents={allCategories}
                                onSaved={(updated) => setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                                onDeleted={(id) => {
                                  setRows((prev) => prev.filter((x) => x.id !== id));
                                  setCount((c) => Math.max(0, c - 1));
                                  setExpandedId(null);
                                }}
                              />
                            ) : (
                              <TaxonomyRowExpanded
                                mode="tags"
                                storeId={storeId}
                                row={r as TagRow}
                                onSaved={(updated) => setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                                onDeleted={(id) => {
                                  setRows((prev) => prev.filter((x) => x.id !== id));
                                  setCount((c) => Math.max(0, c - 1));
                                  setExpandedId(null);
                                }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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