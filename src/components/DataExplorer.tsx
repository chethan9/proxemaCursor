import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, X, Eye, Copy, Check,
} from "lucide-react";

type DataAspect = "products" | "orders" | "customers" | "categories" | "tags" | "coupons";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

const ASPECT_COLUMNS: Record<DataAspect, Column[]> = {
  products: [
    { key: "woo_id", label: "ID", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "sku", label: "SKU", sortable: true },
    { key: "type", label: "Type", sortable: true },
    { key: "status", label: "Status", sortable: true, render: (v) => <StatusPill value={String(v || "")} /> },
    { key: "price", label: "Price", sortable: true, render: (v) => v != null ? `$${Number(v).toFixed(2)}` : "-" },
    { key: "regular_price", label: "Regular", sortable: true, render: (v) => v != null ? `$${Number(v).toFixed(2)}` : "-" },
    { key: "sale_price", label: "Sale", sortable: true, render: (v) => v != null ? `$${Number(v).toFixed(2)}` : "-" },
    { key: "stock_quantity", label: "Stock", sortable: true, render: (v) => v != null ? String(v) : "-" },
    { key: "stock_status", label: "Stock Status", sortable: true, render: (v) => <StatusPill value={String(v || "")} /> },
    { key: "synced_at", label: "Synced", sortable: true, render: (v) => formatDate(String(v || "")) },
  ],
  orders: [
    { key: "woo_id", label: "ID", sortable: true },
    { key: "order_number", label: "Order #", sortable: true },
    { key: "status", label: "Status", sortable: true, render: (v) => <StatusPill value={String(v || "")} /> },
    { key: "total", label: "Total", sortable: true, render: (v) => v != null ? `$${Number(v).toFixed(2)}` : "-" },
    { key: "currency", label: "Currency", sortable: true },
    { key: "discount_total", label: "Discount", sortable: true, render: (v) => v != null ? `$${Number(v).toFixed(2)}` : "-" },
    { key: "shipping_total", label: "Shipping", sortable: true, render: (v) => v != null ? `$${Number(v).toFixed(2)}` : "-" },
    { key: "date_created", label: "Created", sortable: true, render: (v) => formatDate(String(v || "")) },
    { key: "synced_at", label: "Synced", sortable: true, render: (v) => formatDate(String(v || "")) },
  ],
  customers: [
    { key: "woo_id", label: "ID", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "first_name", label: "First Name", sortable: true },
    { key: "last_name", label: "Last Name", sortable: true },
    { key: "username", label: "Username", sortable: true },
    { key: "orders_count", label: "Orders", sortable: true },
    { key: "total_spent", label: "Total Spent", sortable: true, render: (v) => v != null ? `$${Number(v).toFixed(2)}` : "-" },
    { key: "is_paying_customer", label: "Paying", sortable: true, render: (v) => v ? "Yes" : "No" },
    { key: "date_created", label: "Created", sortable: true, render: (v) => formatDate(String(v || "")) },
    { key: "synced_at", label: "Synced", sortable: true, render: (v) => formatDate(String(v || "")) },
  ],
  categories: [
    { key: "woo_id", label: "ID", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "slug", label: "Slug", sortable: true },
    { key: "description", label: "Description" },
    { key: "parent_id", label: "Parent ID", sortable: true },
    { key: "count", label: "Products", sortable: true },
    { key: "display", label: "Display" },
    { key: "synced_at", label: "Synced", sortable: true, render: (v) => formatDate(String(v || "")) },
  ],
  tags: [
    { key: "woo_id", label: "ID", sortable: true },
    { key: "name", label: "Name", sortable: true },
    { key: "slug", label: "Slug", sortable: true },
    { key: "description", label: "Description" },
    { key: "count", label: "Products", sortable: true },
    { key: "synced_at", label: "Synced", sortable: true, render: (v) => formatDate(String(v || "")) },
  ],
  coupons: [
    { key: "woo_id", label: "ID", sortable: true },
    { key: "code", label: "Code", sortable: true },
    { key: "discount_type", label: "Type", sortable: true },
    { key: "amount", label: "Amount", sortable: true, render: (v) => v != null ? String(v) : "-" },
    { key: "usage_count", label: "Used", sortable: true },
    { key: "usage_limit", label: "Limit", sortable: true, render: (v) => v != null ? String(v) : "Unlimited" },
    { key: "date_expires", label: "Expires", sortable: true, render: (v) => v ? formatDate(String(v)) : "Never" },
    { key: "free_shipping", label: "Free Ship", render: (v) => v ? "Yes" : "No" },
    { key: "synced_at", label: "Synced", sortable: true, render: (v) => formatDate(String(v || "")) },
  ],
};

function formatDate(d: string): string {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

function StatusPill({ value }: { value: string }) {
  const colors: Record<string, string> = {
    publish: "bg-emerald-100 text-emerald-700", active: "bg-emerald-100 text-emerald-700",
    instock: "bg-emerald-100 text-emerald-700", processing: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700",
    "on-hold": "bg-amber-100 text-amber-700", onbackorder: "bg-amber-100 text-amber-700",
    draft: "bg-gray-100 text-gray-600", private: "bg-gray-100 text-gray-600",
    outofstock: "bg-red-100 text-red-700", cancelled: "bg-red-100 text-red-700",
    refunded: "bg-red-100 text-red-700", failed: "bg-red-100 text-red-700",
    trash: "bg-red-100 text-red-700",
  };
  const key = value.toLowerCase().replace(/[-_\s]/g, "");
  const color = colors[key] || "bg-gray-100 text-gray-600";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{value}</span>;
}

interface DataExplorerProps {
  storeId: string;
  aspect: DataAspect;
  storeName?: string;
}

export function DataExplorer({ storeId, aspect, storeName }: DataExplorerProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [sortCol, setSortCol] = useState<string>("woo_id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  const columns = ASPECT_COLUMNS[aspect] || [];

  useEffect(() => {
    setPage(1);
    setSearch("");
    setSortCol("woo_id");
    setSortDir("asc");
    setSelectedRow(null);
  }, [aspect]);

  useEffect(() => {
    loadData();
  }, [storeId, aspect, page, perPage, sortCol, sortDir, search]);

  async function loadData() {
    setLoading(true);
    try {
      let query = supabase
        .from(aspect)
        .select("*", { count: "exact" })
        .eq("store_id", storeId)
        .order(sortCol, { ascending: sortDir === "asc" })
        .range((page - 1) * perPage, page * perPage - 1);

      if (search.trim()) {
        const s = `%${search.trim()}%`;
        if (aspect === "products") query = query.or(`name.ilike.${s},sku.ilike.${s}`);
        else if (aspect === "orders") query = query.or(`order_number.ilike.${s},status.ilike.${s}`);
        else if (aspect === "customers") query = query.or(`email.ilike.${s},first_name.ilike.${s},last_name.ilike.${s}`);
        else if (aspect === "categories" || aspect === "tags") query = query.or(`name.ilike.${s},slug.ilike.${s}`);
        else if (aspect === "coupons") query = query.or(`code.ilike.${s},discount_type.ilike.${s}`);
      }

      const { data: rows, count, error } = await query;
      if (error) { console.error("DataExplorer query error:", error); return; }
      setData((rows || []) as Record<string, unknown>[]);
      setTotal(count || 0);
    } catch (err) {
      console.error("DataExplorer error:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / perPage);

  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function exportCSV() {
    if (data.length === 0) return;
    const visibleKeys = columns.map(c => c.key);
    const header = columns.map(c => c.label).join(",");
    const rows = data.map(row =>
      visibleKeys.map(k => {
        const v = row[k];
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${storeName || "store"}-${aspect}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyJSON() {
    if (!selectedRow) return;
    navigator.clipboard.writeText(JSON.stringify(selectedRow.raw_data || selectedRow, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${aspect}...`}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
          />
          {search && (
            <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">{total.toLocaleString()} records</span>
          <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-9">
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <ScrollArea className="w-full" style={{ maxHeight: "calc(100vh - 380px)" }}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">#</TableHead>
                {columns.map(col => (
                  <TableHead key={col.key} className={col.sortable ? "cursor-pointer select-none hover:bg-muted/80" : ""} onClick={() => col.sortable && handleSort(col.key)}>
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (sortCol === col.key
                        ? (sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)
                        : <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />)}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns.length + 2}><div className="h-8 bg-muted animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} className="text-center py-12 text-muted-foreground">
                    {search ? `No ${aspect} matching "${search}"` : `No ${aspect} synced yet`}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, idx) => (
                  <TableRow key={String(row.id)} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedRow(row)}>
                    <TableCell className="text-muted-foreground text-xs">{(page - 1) * perPage + idx + 1}</TableCell>
                    {columns.map(col => (
                      <TableCell key={col.key} className="max-w-[200px] truncate">
                        {col.render ? col.render(row[col.key], row) : (row[col.key] != null ? String(row[col.key]) : "-")}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Side Panel */}
      <Sheet open={!!selectedRow} onOpenChange={open => { if (!open) setSelectedRow(null); }}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="capitalize">{aspect.slice(0, -1)}</span>
              {selectedRow && <Badge variant="outline">#{String(selectedRow.woo_id)}</Badge>}
            </SheetTitle>
          </SheetHeader>

          {selectedRow && (
            <div className="mt-6 space-y-6">
              {/* Key fields */}
              <div className="grid grid-cols-2 gap-4">
                {columns.filter(c => c.key !== "raw_data").map(col => (
                  <div key={col.key} className={col.key === "name" || col.key === "email" || col.key === "description" ? "col-span-2" : ""}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{col.label}</p>
                    <p className="mt-1 text-sm">
                      {col.render ? col.render(selectedRow[col.key], selectedRow) : (selectedRow[col.key] != null ? String(selectedRow[col.key]) : "-")}
                    </p>
                  </div>
                ))}
              </div>

              {/* Raw JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Raw Data</p>
                  <Button variant="ghost" size="sm" onClick={copyJSON} className="h-7 text-xs">
                    {copied ? <><Check className="h-3 w-3 mr-1" /> Copied</> : <><Copy className="h-3 w-3 mr-1" /> Copy JSON</>}
                  </Button>
                </div>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-[400px] font-mono">
                  {JSON.stringify(selectedRow.raw_data || selectedRow, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}