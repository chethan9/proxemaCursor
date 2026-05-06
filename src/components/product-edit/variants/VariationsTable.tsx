import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, MoreVertical, Trash2, Wand2 } from "lucide-react";
import type { ProductAttribute } from "@/services/productEditService";
import { Variation, variationMatchesDefault } from "@/services/productEditService";
import { variationLabel } from "./utils";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";

type Props = {
  variations: Variation[];
  parentSku?: string;
  parentName?: string;
  defaultAttrs?: { name: string; option: string }[];
  /** Parent variable attributes — required for correct default-variation matching when Woo uses pa_* / ids. */
  parentAttributes?: ProductAttribute[];
  /** Woo-style default variation — controlled by dropdown above the table. */
  defaultKey?: string | null;
  onDefaultKeyChange?: (key: string | null) => void;
  onEdit: (idx: number) => void;
  onUpdate: (idx: number, patch: Partial<Variation>) => void;
  onBulk: (patch: Partial<Variation>, onlySelected: boolean, selectedIds: Set<string>) => void;
  onBulkDelete?: (keys: Set<string>) => void;
  /** Single-row delete from Actions column */
  onDeleteRow?: (idx: number) => void;
  /** When &gt; 0, auto-fill SKUs is disabled until duplicates are removed (see Variants tab warning). */
  duplicateRowCount?: number;
  className?: string;
};

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 24);
}

export function VariationsTable({
  variations,
  parentSku,
  parentName,
  defaultAttrs,
  parentAttributes,
  defaultKey,
  onDefaultKeyChange,
  onEdit,
  onUpdate,
  onBulk,
  onBulkDelete,
  onDeleteRow,
  duplicateRowCount = 0,
  className,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkMode, setBulkMode] = useState<null | "regular_price" | "sale_price" | "stock_quantity">(null);
  const [bulkError, setBulkError] = useState<string>("");
  const emptySkuCount = variations.filter((v) => !v.sku?.trim()).length;

  const toggleAll = () => {
    if (selected.size === variations.length) setSelected(new Set());
    else setSelected(new Set(variations.map((v) => v.key)));
  };
  const toggle = (k: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const applyBulk = () => {
    if (!bulkMode) return;
    if (selected.size === 0) return;
    const val = bulkValue.trim();
    if (!val && bulkMode !== "stock_quantity") return;
    const targets = variations.filter((v) => selected.has(v.key));
    if (bulkMode === "sale_price" && val) {
      const sale = parseFloat(val);
      if (!Number.isNaN(sale) && sale > 0) {
        const offending: string[] = [];
        targets.forEach((v, i) => {
          const reg = parseFloat(v.regular_price || "0");
          if (reg > 0 && sale >= reg) {
            const label = (v.attributes || []).map((a) => a.option).filter(Boolean).join(" / ") || `Row ${i + 1}`;
            offending.push(`${label} (regular ${reg})`);
          }
        });
        if (offending.length > 0) {
          setBulkError(`Sale price ${sale} is ≥ regular price for: ${offending.slice(0, 5).join(", ")}${offending.length > 5 ? `, +${offending.length - 5} more` : ""}`);
          return;
        }
      }
    }
    setBulkError("");
    const patch: Partial<Variation> = {};
    if (bulkMode === "regular_price") patch.regular_price = val;
    if (bulkMode === "sale_price") patch.sale_price = val;
    if (bulkMode === "stock_quantity") {
      patch.stock_quantity = val ? Number(val) : null;
      patch.manage_stock = true;
    }
    onBulk(patch, true, selected);
    setBulkMode(null);
    setBulkValue("");
  };

  const setAllEnabled = (enabled: boolean) => {
    if (selected.size === 0) return;
    onBulk({ enabled }, true, selected);
  };

  const deleteSelected = () => {
    if (!onBulkDelete || selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} variation${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    onBulkDelete(new Set(selected));
    setSelected(new Set());
  };

  const cellInput = "h-9 border-0 bg-muted/40 rounded-md text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background placeholder:text-muted-foreground/50";

  const autoFillSkus = () => {
    const base = (parentSku?.trim() || (parentName ? slugify(parentName) : "") || "SKU").toUpperCase();
    const existing = new Set(variations.map((v) => v.sku?.trim()).filter(Boolean) as string[]);
    variations.forEach((v, idx) => {
      if (v.sku?.trim()) return;
      const suffix = (v.attributes || [])
        .map((a) => slugify(a.option))
        .filter(Boolean)
        .join("-") || String(idx + 1);
      let candidate = `${base}-${suffix}`;
      let n = 2;
      while (existing.has(candidate)) {
        candidate = `${base}-${suffix}-${n++}`;
      }
      existing.add(candidate);
      onUpdate(idx, { sku: candidate });
    });
  };

  /** Row index as value — Radix Select requires unique values; duplicate variation keys would crash. */
  const defaultSelectValue = useMemo(() => {
    if (!defaultKey) return "__none__";
    const idx = variations.findIndex((v) => v.key === defaultKey);
    return idx >= 0 ? `idx:${idx}` : "__none__";
  }, [defaultKey, variations]);

  return (
    <div className={cn("space-y-3", className)}>
      {variations.length > 0 ? (
        <div className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-3">
          {variations.length > 0 && onDefaultKeyChange && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">Default variation</span>
              <Select
                value={defaultSelectValue}
                onValueChange={(v) => {
                  if (v === "__none__") {
                    onDefaultKeyChange(null);
                    return;
                  }
                  const m = /^idx:(\d+)$/.exec(v);
                  const i = m ? Number.parseInt(m[1], 10) : NaN;
                  const row = Number.isFinite(i) ? variations[i] : undefined;
                  onDefaultKeyChange(row?.key ?? null);
                }}
              >
                <SelectTrigger className="h-9 w-full sm:max-w-xl lg:max-w-2xl text-left font-normal">
                  <SelectValue placeholder="No default" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[320px]">
                  <SelectItem value="__none__">No default</SelectItem>
                  {variations.map((v, i) => (
                    <SelectItem key={`def-opt-${i}-${v.key}`} value={`idx:${i}`} className="whitespace-normal">
                      {variationLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Variation bulk actions">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={selected.size === 0} className="rounded-full" title={selected.size === 0 ? "Select at least one variation" : undefined}>
                  <MoreVertical className="h-3.5 w-3.5 mr-1.5" />Bulk actions {selected.size > 0 ? `(${selected.size})` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setBulkMode("regular_price")}>Set regular price</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBulkMode("sale_price")}>Set sale price</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBulkMode("stock_quantity")}>Set stock quantity</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAllEnabled(true)}>Enable selected</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAllEnabled(false)}>Disable selected</DropdownMenuItem>
                {onBulkDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={selected.size === 0} onClick={deleteSelected} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />Delete selected
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {bulkMode && (
              <>
                <NumberInput className="h-9 w-40" value={bulkValue} onValueChange={(v) => { setBulkValue(v); setBulkError(""); }} integer={bulkMode === "stock_quantity"} placeholder={bulkMode === "stock_quantity" ? "Qty" : "Price"} />
                <Button size="sm" type="button" onClick={applyBulk} disabled={selected.size === 0} className="bg-foreground text-background hover:bg-foreground/90 rounded-full">Apply to {selected.size}</Button>
                <Button size="sm" type="button" variant="ghost" onClick={() => { setBulkMode(null); setBulkValue(""); setBulkError(""); }}>Cancel</Button>
              </>
            )}
            <div className="ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={autoFillSkus}
                disabled={emptySkuCount === 0 || duplicateRowCount > 0}
                title={
                  duplicateRowCount > 0
                    ? "Remove duplicate rows using the button in the warning above, then auto-fill SKUs"
                    : emptySkuCount === 0
                      ? "All variations already have SKUs"
                      : `Auto-fill ${emptySkuCount} empty SKU${emptySkuCount === 1 ? "" : "s"}`
                }
                className="rounded-full gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Auto-fill SKUs {emptySkuCount > 0 ? `(${emptySkuCount})` : ""}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {bulkError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{bulkError}</div>
      )}

      <div className="rounded-lg border border-border/70 overflow-x-auto bg-background">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-2 py-3 text-left align-middle">
                <Checkbox checked={selected.size === variations.length && variations.length > 0} onCheckedChange={toggleAll} aria-label="Select all variations" />
              </th>
              <th className="w-[32%] px-2 py-3 text-left align-middle">Options</th>
              <th className="w-[18%] px-2 py-3 text-left align-middle">SKU</th>
              <th className="w-[11%] px-2 py-3 text-left align-middle">
                Price <span className="text-destructive">*</span>
              </th>
              <th className="w-[11%] px-2 py-3 text-left align-middle">Sale</th>
              <th className="w-[10%] px-2 py-3 text-left align-middle">Stock</th>
              <th className="w-[88px] px-2 py-3 text-center align-middle">Actions</th>
            </tr>
          </thead>
          <tbody>
            {variations.map((v, i) => {
              const isDisabled = v.enabled === false;
              const priceMissing = v.enabled !== false && (!v.regular_price || Number(v.regular_price) <= 0);
              const isDefault = variationMatchesDefault(v, defaultAttrs, parentAttributes);
              const saleInvalid = (() => {
                const reg = parseFloat(v.regular_price || "0");
                const sale = parseFloat(v.sale_price || "0");
                return reg > 0 && sale > 0 && sale >= reg;
              })();
              return (
                <tr
                  key={`var-row-${i}-${v.key}`}
                  className={cn(
                    "border-b border-border last:border-b-0 transition-colors hover:bg-muted/20",
                    isDisabled && "opacity-50",
                    priceMissing && "bg-destructive/5",
                    isDefault && "border-l-[3px] border-l-primary bg-primary/[0.06]",
                  )}
                >
                  <td className="px-2 py-2 align-middle">
                    <Checkbox checked={selected.has(v.key)} onCheckedChange={() => toggle(v.key)} aria-label={`Select ${variationLabel(v)}`} />
                  </td>
                  <td className="px-2 py-2 align-middle min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium min-w-0">
                      <span className="min-w-0 break-words leading-snug text-[13px]">{variationLabel(v)}</span>
                      {isDefault && (
                        <span className="text-[9px] uppercase bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium shrink-0">Default</span>
                      )}
                      {isDisabled && <span className="text-[9px] uppercase bg-muted rounded-full px-2 py-0.5 font-normal shrink-0">off</span>}
                      {priceMissing && (
                        <span className="text-[9px] uppercase bg-destructive/10 text-destructive rounded-full px-2 py-0.5 font-medium shrink-0">no price</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-middle min-w-0">
                    <Input className={cellInput} value={v.sku} onChange={(e) => onUpdate(i, { sku: e.target.value })} placeholder="—" />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <Input
                      className={cn(cellInput, priceMissing && "ring-1 ring-destructive/30")}
                      value={v.regular_price}
                      onChange={(e) => onUpdate(i, { regular_price: e.target.value })}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <Input
                      className={cn(cellInput, saleInvalid && "ring-1 ring-destructive/40 text-destructive")}
                      value={v.sale_price}
                      onChange={(e) => onUpdate(i, { sale_price: e.target.value })}
                      placeholder="—"
                      title={saleInvalid ? "Sale price must be less than regular price" : undefined}
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <Input
                      className={cn(cellInput, !v.manage_stock && "bg-muted/30 text-muted-foreground cursor-not-allowed")}
                      type="number"
                      min="0"
                      value={v.manage_stock ? (v.stock_quantity ?? "") : ""}
                      disabled={!v.manage_stock}
                      title={!v.manage_stock ? "Enable Manage Stock to set quantity" : undefined}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          onUpdate(i, { stock_quantity: null });
                          return;
                        }
                        const n = Number(raw);
                        if (Number.isNaN(n)) return;
                        const qty = Math.max(0, n);
                        const nextStatus: Variation["stock_status"] =
                          qty === 0 ? "outofstock" : v.stock_status === "onbackorder" ? "onbackorder" : "instock";
                        onUpdate(i, { stock_quantity: qty, manage_stock: true, stock_status: nextStatus });
                      }}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-1 py-2 align-middle">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground shrink-0"
                        onClick={() => onEdit(i)}
                        aria-label="Edit variation"
                        title="Edit variation"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      {onDeleteRow && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setDeleteIdx(i)}
                          aria-label="Delete variation"
                          title="Delete variation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={deleteIdx !== null} onOpenChange={(o) => { if (!o) setDeleteIdx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this variation?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the variation from the list. If it already exists in WooCommerce, it will be deleted when you save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteIdx !== null && onDeleteRow) {
                  onDeleteRow(deleteIdx);
                }
                setDeleteIdx(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}