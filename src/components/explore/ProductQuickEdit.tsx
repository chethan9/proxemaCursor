import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pencil } from "lucide-react";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "next-i18next";
import { formatDate } from "@/lib/format-number";
import { authorizedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

async function patchProduct(storeId: string, productId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await authorizedFetch(`/api/stores/${storeId}/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Update failed (${res.status})`);
  }
  return res.json();
}

type Product = {
  id: string;
  store_id: string;
  woo_id: number | null;
  name: string | null;
  /** WooCommerce product type, e.g. `simple` | `variable` */
  type?: string | null;
  sku: string | null;
  regular_price: string | number | null;
  sale_price: string | number | null;
  manage_stock?: boolean | null;
  stock_quantity: number | null;
  stock_status: string | null;
  status: string | null;
  synced_at?: string | null;
};

type VariationApiRow = {
  id: number;
  attributes: { name: string; option: string }[];
  sku: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  enabled?: boolean;
};

type VariationDraft = {
  wooId: number;
  attributes: { name: string; option: string }[];
  manage_stock: boolean;
  stock_status: string;
  enabled: boolean;
  sku: string;
  regular_price: string;
  sale_price: string;
  stock_qty: string;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Product | null;
  siteName?: string;
};

function isLiveCatalogId(id: string): boolean {
  return id.startsWith("live-");
}

function variationLabel(attrs: { name: string; option: string }[]): string {
  if (!attrs.length) return "";
  return attrs.map((a) => `${a.name}: ${a.option}`).join(" · ");
}

function rowToDraft(v: VariationApiRow): VariationDraft {
  return {
    wooId: v.id,
    attributes: Array.isArray(v.attributes) ? v.attributes : [],
    manage_stock: !!v.manage_stock,
    stock_status: v.stock_status || "instock",
    enabled: v.enabled !== false,
    sku: v.sku || "",
    regular_price: v.regular_price != null && String(v.regular_price).trim() !== "" ? String(v.regular_price) : "",
    sale_price: v.sale_price != null && String(v.sale_price).trim() !== "" ? String(v.sale_price) : "",
    stock_qty: v.stock_quantity != null ? String(v.stock_quantity) : "",
  };
}

async function fetchVariations(storeId: string, productId: string): Promise<VariationApiRow[]> {
  const res = await authorizedFetch(`/api/stores/${storeId}/products/${productId}/variations`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Variations failed (${res.status})`);
  }
  return res.json() as Promise<VariationApiRow[]>;
}

export function ProductQuickEdit({ open, onOpenChange, product, siteName }: Props) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("site");
  const router = useRouter();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [regular, setRegular] = useState("");
  const [sale, setSale] = useState("");
  const [stockStatus, setStockStatus] = useState("instock");
  const [stockQty, setStockQty] = useState<string>("");
  const [status, setStatus] = useState("publish");
  const [manageStock, setManageStock] = useState(false);

  /** Supabase product UUID when the grid row uses a live-catalog id (`live-{wooId}`). */
  const [liveResolvedId, setLiveResolvedId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [variationDrafts, setVariationDrafts] = useState<VariationDraft[]>([]);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setSku(product.sku || "");
      setRegular(product.regular_price != null ? String(product.regular_price) : "");
      setSale(product.sale_price != null ? String(product.sale_price) : "");
      setStockStatus(product.stock_status || "instock");
      setStockQty(product.stock_quantity != null ? String(product.stock_quantity) : "");
      setStatus(product.status || "publish");
      setManageStock(!!product.manage_stock);
    }
  }, [product]);

  useEffect(() => {
    if (!open || !product) {
      setLiveResolvedId(null);
      setResolveError(null);
      setVariationDrafts([]);
      return;
    }

    if (!isLiveCatalogId(product.id)) {
      setLiveResolvedId(null);
      setResolveError(null);
      return;
    }

    if (product.woo_id == null) {
      setLiveResolvedId(null);
      setResolveError(t("products.quickEdit.resolveMissingWoo"));
      return;
    }

    let cancelled = false;
    setLiveResolvedId(null);
    setResolveError(null);
    (async () => {
      try {
        const res = await authorizedFetch(`/api/stores/${product.store_id}/products/by-woo/${product.woo_id}`);
        if (cancelled) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setResolveError((err.error as string) || (err.message as string) || t("products.quickEdit.resolveFailed"));
          setLiveResolvedId(null);
          return;
        }
        const row = (await res.json()) as { id?: string };
        if (cancelled) return;
        if (typeof row?.id === "string") {
          setLiveResolvedId(row.id);
          setResolveError(null);
        } else {
          setResolveError(t("products.quickEdit.resolveFailed"));
        }
      } catch {
        if (!cancelled) {
          setResolveError(t("products.quickEdit.resolveFailed"));
          setLiveResolvedId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, product, t]);

  const isVariable = product?.type === "variable";
  const apiProductId =
    product == null ? null : isLiveCatalogId(product.id) ? liveResolvedId : product.id;
  const storeId = product?.store_id ?? "";

  const {
    data: variationsData,
    isLoading: variationsLoading,
    isError: variationsIsError,
    error: variationsError,
  } = useQuery({
    queryKey: [...queryKeys.store(storeId), "quick-edit-variations", apiProductId] as const,
    queryFn: () => fetchVariations(product!.store_id, apiProductId!),
    enabled: !!open && !!isVariable && !!storeId && !!apiProductId && !resolveError,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setVariationDrafts([]);
      return;
    }
    if (!isVariable) return;
    if (!variationsData?.length) {
      setVariationDrafts([]);
      return;
    }
    setVariationDrafts((prev) => {
      const sameLength = prev.length === variationsData.length;
      const sameIds =
        sameLength && prev.every((p, i) => p.wooId === (variationsData[i] as VariationApiRow).id);
      if (sameIds && prev.length > 0) return prev;
      return variationsData.map((v) => rowToDraft(v as VariationApiRow));
    });
  }, [open, isVariable, variationsData]);

  const mutation = useSiteMutation<Record<string, unknown>, Record<string, unknown>>({
    mutationFn: (patch) => {
      if (!product || !apiProductId) throw new Error("Missing product");
      return patchProduct(product.store_id, apiProductId, patch);
    },
    invalidateKeys: product ? [queryKeys.products(product.store_id), ["product", apiProductId ?? product.id]] : [],
    track: product
      ? { entityType: "product", storeId: product.store_id, entityId: () => apiProductId ?? product.id }
      : undefined,
    optimisticUpdates: product
      ? [
          {
            queryKey: queryKeys.products(product.store_id),
            updater: (old, patch) => {
              const apply = (rows: Product[]) =>
                rows.map((p) => (p.id === product.id ? { ...p, ...(patch as Partial<Product>) } : p));
              if (Array.isArray(old)) return apply(old as Product[]);
              if (old && typeof old === "object" && "pages" in old) {
                const o = old as { pages: Array<{ data: Product[] }>; pageParams?: unknown[] };
                return {
                  ...o,
                  pages: o.pages.map((page) => ({ ...page, data: apply(page.data) })),
                };
              }
              return old;
            },
          },
        ]
      : [],
    siteName,
    successToast: t("products.quickEdit.syncedToast"),
    onSuccessExtra: () => onOpenChange(false),
  });

  const clampNonNeg = (v: string): string => {
    if (v === "" || v === "-") return "";
    const n = parseFloat(v);
    if (Number.isNaN(n)) return v;
    return n < 0 ? "0" : v;
  };

  const updateVariationDraft = useCallback((wooId: number, partial: Partial<VariationDraft>) => {
    setVariationDrafts((rows) => rows.map((r) => (r.wooId === wooId ? { ...r, ...partial } : r)));
  }, []);

  const handleSave = () => {
    if (!product || !apiProductId) {
      toast({ title: t("products.quickEdit.notReadyTitle"), description: t("products.quickEdit.notReadyDesc"), variant: "destructive" });
      return;
    }

    if (!isVariable) {
      const publishing = status === "publish";
      if (publishing) {
        const regNum = parseFloat(regular);
        if (!regular || Number.isNaN(regNum) || regNum <= 0) {
          toast({
            title: t("products.quickEdit.invalidPriceTitle"),
            description: t("products.quickEdit.invalidRegularDesc"),
            variant: "destructive",
          });
          return;
        }
        if (sale) {
          const saleNum = parseFloat(sale);
          if (Number.isNaN(saleNum) || saleNum <= 0) {
            toast({
              title: t("products.quickEdit.invalidSaleTitle"),
              description: t("products.quickEdit.invalidSalePositiveDesc"),
              variant: "destructive",
            });
            return;
          }
          if (saleNum >= regNum) {
            toast({
              title: t("products.quickEdit.invalidSaleTitle"),
              description: t("products.quickEdit.invalidSaleLessDesc"),
              variant: "destructive",
            });
            return;
          }
        }
        if (manageStock && stockQty !== "") {
          const qtyNum = Number(stockQty);
          if (Number.isNaN(qtyNum) || qtyNum < 0) {
            toast({
              title: t("products.quickEdit.invalidQtyTitle"),
              description: t("products.quickEdit.invalidQtyDesc"),
              variant: "destructive",
            });
            return;
          }
        }
      }
      const patch: Record<string, unknown> = {
        name,
        sku,
        status,
        stock_status: stockStatus,
        manage_stock: manageStock,
      };
      if (product.type) patch.type = product.type;
      patch.regular_price = regular;
      patch.sale_price = sale;
      if (manageStock) patch.stock_quantity = stockQty === "" ? null : Number(stockQty);
      mutation.mutate(patch);
      return;
    }

    const publishing = status === "publish";

    for (let i = 0; i < variationDrafts.length; i++) {
      const d = variationDrafts[i];
      if (!d.enabled) continue;
      const regNum = parseFloat(d.regular_price);
      if (publishing) {
        if (!d.regular_price.trim() || Number.isNaN(regNum) || regNum <= 0) {
          toast({
            title: t("products.quickEdit.invalidPriceTitle"),
            description: t("products.quickEdit.variationInvalidRegular", { label: variationLabel(d.attributes) || `#${d.wooId}` }),
            variant: "destructive",
          });
          return;
        }
        if (d.sale_price.trim()) {
          const saleNum = parseFloat(d.sale_price);
          if (Number.isNaN(saleNum) || saleNum <= 0) {
            toast({
              title: t("products.quickEdit.invalidSaleTitle"),
              description: t("products.quickEdit.variationInvalidSalePositive", { label: variationLabel(d.attributes) || `#${d.wooId}` }),
              variant: "destructive",
            });
            return;
          }
          const reg = parseFloat(d.regular_price);
          if (!Number.isNaN(reg) && reg > 0 && saleNum >= reg) {
            toast({
              title: t("products.quickEdit.invalidSaleTitle"),
              description: t("products.quickEdit.variationInvalidSaleLess", { label: variationLabel(d.attributes) || `#${d.wooId}` }),
              variant: "destructive",
            });
            return;
          }
        }
        if (d.manage_stock && d.stock_qty.trim() !== "") {
          const q = Number(d.stock_qty);
          if (Number.isNaN(q) || q < 0) {
            toast({
              title: t("products.quickEdit.invalidQtyTitle"),
              description: t("products.quickEdit.variationInvalidQty", { label: variationLabel(d.attributes) || `#${d.wooId}` }),
              variant: "destructive",
            });
            return;
          }
        }
      }
    }

    const variations = variationDrafts.map((d) => ({
      id: d.wooId,
      attributes: d.attributes,
      sku: d.sku.trim(),
      regular_price: d.regular_price.trim(),
      sale_price: d.sale_price.trim(),
      manage_stock: d.manage_stock,
      stock_status: d.stock_status,
      stock_quantity: d.manage_stock ? (d.stock_qty.trim() === "" ? null : Number(d.stock_qty)) : undefined,
      enabled: d.enabled,
    }));

    const patch: Record<string, unknown> = {
      name,
      sku,
      status,
      variations,
    };
    if (product.type) patch.type = product.type;
    mutation.mutate(patch);
  };

  const setQtyRaw = (v: string) => {
    const clean = clampNonNeg(v);
    setStockQty(clean);
    if (clean === "") return;
    const n = Number(clean);
    if (Number.isNaN(n)) return;
    setManageStock(true);
    if (n === 0) setStockStatus("outofstock");
    else if (stockStatus !== "onbackorder") setStockStatus("instock");
  };

  if (!product) return null;

  const variableSaveDisabled =
    isVariable && (!!resolveError || variationsLoading || variationsIsError);

  const editHref =
    apiProductId != null
      ? { pathname: `/sites/${product.store_id}/products/edit/${apiProductId}`, query: { returnTo: router.asPath || `/sites/${product.store_id}/products` } }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border-border bg-background p-5 gap-3 text-foreground shadow-lg",
          isVariable ? "sm:max-w-2xl max-h-[min(90vh,720px)] flex flex-col" : "sm:max-w-md",
        )}
      >
        <DialogHeader className="space-y-0.5 shrink-0">
          <DialogTitle className="text-base text-foreground">{t("products.quickEdit.title")}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{t("products.quickEdit.description")}</DialogDescription>
        </DialogHeader>
        <div className={cn("space-y-3", isVariable && "min-h-0 flex-1 flex flex-col overflow-hidden")}>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground" required>
              {t("products.quickEdit.name")}
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground" required={status === "publish" && !isVariable}>
                {t("products.quickEdit.sku")}
              </Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} className="h-8 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">{t("products.quickEdit.status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 bg-card text-sm text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">{t("products.statuses.publish")}</SelectItem>
                  <SelectItem value="draft">{t("products.statuses.draft")}</SelectItem>
                  <SelectItem value="private">{t("products.statuses.private")}</SelectItem>
                  <SelectItem value="pending">{t("products.statuses.pending")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isVariable && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground" required={status === "publish"}>
                    {t("products.quickEdit.regularPrice")}
                  </Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={regular}
                    onChange={(e) => setRegular(clampNonNeg(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t("products.quickEdit.salePrice")}</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={sale}
                    onChange={(e) => setSale(clampNonNeg(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-2.5 mt-1 border-t-2 border-t-border/80">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">{t("products.quickEdit.manageStock")}</Label>
                  <Switch checked={manageStock} onCheckedChange={setManageStock} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t("products.quickEdit.stockStatus")}</Label>
                    <Select value={stockStatus} onValueChange={setStockStatus}>
                      <SelectTrigger className="h-8 bg-card text-sm text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instock">{t("products.filters.inStock")}</SelectItem>
                        <SelectItem value="outofstock">{t("products.filters.outOfStock")}</SelectItem>
                        <SelectItem value="onbackorder">{t("products.filters.onBackorder")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {manageStock && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground" required>
                        {t("products.quickEdit.qty")}
                      </Label>
                      <Input type="number" min="0" value={stockQty} onChange={(e) => setQtyRaw(e.target.value)} className="h-8 text-sm" />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {isVariable && (
            <div className="space-y-2 min-h-0 flex-1 flex flex-col border rounded-md border-border bg-muted/20 p-2">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <Label className="text-xs font-medium text-foreground">{t("products.quickEdit.variationsHeading")}</Label>
                {resolveError ? (
                  <span className="text-[10px] text-destructive">{resolveError}</span>
                ) : variationsLoading ? (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("products.quickEdit.loadingVariations")}
                  </span>
                ) : null}
              </div>
              {variationsIsError && (
                <p className="text-xs text-destructive">
                  {variationsError instanceof Error ? variationsError.message : t("products.quickEdit.variationsError")}
                </p>
              )}
              {!variationsLoading && !variationsIsError && variationsData?.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("products.quickEdit.noVariations")}</p>
              )}
              {variationDrafts.length > 0 && (
                <div className="overflow-y-auto min-h-0 flex-1 pr-1 space-y-2 max-h-[min(52vh,420px)]">
                  {variationDrafts.map((d) => (
                    <div
                      key={d.wooId}
                      className="rounded border border-border bg-background p-2 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <p className="text-[11px] font-medium text-foreground leading-snug">
                          {variationLabel(d.attributes) || t("products.quickEdit.variationFallback", { id: d.wooId })}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {d.manage_stock ? t("products.quickEdit.stockTracked") : t("products.quickEdit.stockNotTracked")}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="space-y-1 col-span-2 sm:col-span-1">
                          <Label className="text-[10px] text-muted-foreground">{t("products.quickEdit.sku")}</Label>
                          <Input
                            value={d.sku}
                            onChange={(e) => updateVariationDraft(d.wooId, { sku: e.target.value })}
                            className="h-8 font-mono text-xs"
                            disabled={!d.enabled}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">{t("products.quickEdit.regularPrice")}</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={d.regular_price}
                            onChange={(e) => updateVariationDraft(d.wooId, { regular_price: clampNonNeg(e.target.value) })}
                            className="h-8 text-xs"
                            disabled={!d.enabled}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">{t("products.quickEdit.salePrice")}</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={d.sale_price}
                            onChange={(e) => updateVariationDraft(d.wooId, { sale_price: clampNonNeg(e.target.value) })}
                            className="h-8 text-xs"
                            disabled={!d.enabled}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">{t("products.quickEdit.qty")}</Label>
                          <Input
                            type="number"
                            min="0"
                            value={d.stock_qty}
                            onChange={(e) => updateVariationDraft(d.wooId, { stock_qty: clampNonNeg(e.target.value) })}
                            className="h-8 text-xs"
                            disabled={!d.enabled || !d.manage_stock}
                            title={!d.manage_stock ? t("products.quickEdit.qtyDisabledHint") : undefined}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between text-[11px] text-muted-foreground shrink-0">
            <span>{t("products.quickEdit.lastSync")}</span>
            <span>{product.synced_at ? formatDate(product.synced_at, i18n.language) : "—"}</span>
          </div>
        </div>
        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 border-t border-border pt-2 mt-1 shrink-0">
          {editHref ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={editHref} onClick={() => onOpenChange(false)}>
                <Pencil className="h-3.5 w-3.5" />
                {t("products.quickEdit.editFull")}
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" disabled title={t("products.quickEdit.resolveFailed")}>
              <Pencil className="h-3.5 w-3.5" />
              {t("products.quickEdit.editFull")}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              {t("products.quickEdit.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={mutation.isPending || !apiProductId || variableSaveDisabled}
            >
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {t("products.quickEdit.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
