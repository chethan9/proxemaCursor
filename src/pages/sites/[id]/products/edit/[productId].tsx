import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { BasicEditor } from "@/components/product-edit/BasicEditor";
import { AdvancedShell, AdvancedTabKey } from "@/components/product-edit/AdvancedShell";
import { BasicInfoTab } from "@/components/product-edit/tabs/BasicInfoTab";
import { PricingTaxTab } from "@/components/product-edit/tabs/PricingTaxTab";
import { InventoryShippingTab } from "@/components/product-edit/tabs/InventoryShippingTab";
import { VariantsTab } from "@/components/product-edit/tabs/VariantsTab";
import { emptyProductForm, updateProduct, ProductFormState, ProductValidationIssue } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Trash2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityHistoryDrawer } from "@/components/ActivityHistoryDrawer";
import { useUnsavedChangesGuard, UnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useSyncLocked } from "@/components/site/SyncLockBanner";
import { Loader2 as Spinner } from "lucide-react";

type ProductRow = Record<string, unknown>;

function Inner() {
  const router = useRouter();
  const { toast } = useToast();
  const { id: storeId, store, loading: storeLoading } = useSiteFromRoute();
  const productId = typeof router.query.productId === "string" ? router.query.productId : "";
  const { locked: syncLocked, ready: syncReady } = useSyncLocked(storeId);

  const [form, setForm] = useState<ProductFormState | null>(null);
  const [initialFormJson, setInitialFormJson] = useState<string>("");
  const [savedOnce, setSavedOnce] = useState(false);
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [activeTab, setActiveTab] = useState<AdvancedTabKey>("basic");
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<ProductValidationIssue[]>([]);

  useEffect(() => {
    if (!storeId || !productId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stores/${storeId}/products/${productId}`);
        if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
        const p = (await res.json()) as ProductRow;
        if (cancelled) return;

        const base = emptyProductForm();
        const toNumStr = (v: unknown) => (v == null ? "" : String(v));
        const productType = (p.product_type as string) || (p.type as string) || "simple";
        const dims = (p.dimensions as { length?: string; width?: string; height?: string } | null) || {};
        const images = Array.isArray(p.images) ? (p.images as { id?: number; src: string; alt?: string }[]) : [];
        const categories = Array.isArray(p.categories) ? (p.categories as { id: number; name?: string }[]) : [];
        const tags = Array.isArray(p.tags) ? (p.tags as { id?: number; name: string }[]) : [];
        const attributes = Array.isArray(p.attributes) ? (p.attributes as ProductFormState["attributes"]) : [];
        const raw = (p.raw_data as Record<string, unknown> | null) || {};
        const rawBrands = Array.isArray(raw.brands) ? (raw.brands as { id: number; name?: string }[]) : [];
        const brandsSrc = Array.isArray((p as ProductRow).brands)
          ? ((p as ProductRow).brands as { id: number; name?: string }[])
          : rawBrands;
        const soldIndividually = typeof p.sold_individually === "boolean"
          ? (p.sold_individually as boolean)
          : !!raw.sold_individually;
        const rawWeight = p.weight != null ? String(p.weight) : (raw.weight != null ? String(raw.weight) : "");
        const rawDims = (raw.dimensions as { length?: string; width?: string; height?: string } | undefined) || {};

        setForm({
          ...base,
          name: (p.name as string) || "",
          description: (p.description as string) || "",
          short_description: (p.short_description as string) || "",
          slug: (p.slug as string) || "",
          status: ((p.status as ProductFormState["status"]) || "publish"),
          type: productType === "variable" ? "variable" : "simple",
          regular_price: toNumStr(p.regular_price),
          sale_price: toNumStr(p.sale_price),
          tax_status: ((p.tax_status as ProductFormState["tax_status"]) || "taxable"),
          tax_class: (p.tax_class as string) || "",
          manage_stock: !!p.manage_stock,
          stock_quantity: (p.stock_quantity as number | null) ?? null,
          stock_status: ((p.stock_status as ProductFormState["stock_status"]) || "instock"),
          sold_individually: soldIndividually,
          sku: (p.sku as string) || "",
          weight: rawWeight,
          dimensions: {
            length: dims.length || rawDims.length || "",
            width: dims.width || rawDims.width || "",
            height: dims.height || rawDims.height || "",
          },
          images,
          categories,
          brands: brandsSrc.map((b) => ({ id: b.id, name: b.name || "" })),
          tags,
          attributes,
        });
        setInitialFormJson(JSON.stringify({
          ...base,
          name: (p.name as string) || "",
        }));
        if (productType === "variable") setMode("advanced");
      } catch (e) {
        toast({ title: "Failed to load product", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, productId, toast]);

  const dirty = !!form && !savedOnce && initialFormJson !== "" && JSON.stringify(form) !== initialFormJson;
  useUnsavedChangesGuard(dirty);

  const save = useSiteMutation<unknown, void>({
    mutationFn: () => updateProduct(storeId, productId, form!),
    invalidateKeys: [queryKeys.products(storeId), ["product", productId]],
    siteName: store?.name,
    successToast: "Saved",
    onSuccessExtra: () => { setSavedOnce(true); router.push(`/sites/${storeId}/products`); },
    onErrorExtra: (err) => {
      const e = err as Error & { validationErrors?: ProductValidationIssue[] };
      setServerErrors(e.validationErrors || []);
    },
  });

  const remove = useSiteMutation<unknown, void>({
    mutationFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/products/${productId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `Delete failed (${res.status})`);
      }
      return res.json();
    },
    invalidateKeys: [queryKeys.products(storeId)],
    siteName: store?.name,
    successToast: "Product deleted",
    onSuccessExtra: () => router.push(`/sites/${storeId}/products`),
    onErrorExtra: () => setDeleteOpen(false),
  });

  const onPublish = useCallback(() => {
    if (!form) return;
    setServerErrors([]);
    save.mutate();
  }, [form, save]);

  const canAdvance = (tab: AdvancedTabKey) => {
    if (!form) return false;
    if (tab === "basic") return form.name.trim().length > 0;
    return true;
  };

  if (storeLoading || loading) return <ProductEditSkeleton />;
  if (!store || !form) return <div className="p-6">Product not found</div>;
  if (syncReady && syncLocked) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" asChild><Link href={`/sites/${storeId}/products`}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Link></Button>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-8 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-warning/15 mb-4">
            <Spinner className="h-6 w-6 text-warning animate-spin" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Editing is locked while we finish importing</h2>
          <p className="text-sm text-muted-foreground mb-1">
            Your store is still doing its initial sync. To avoid data conflicts, product edits are disabled until the import finishes — usually just a few minutes.
          </p>
          <p className="text-sm text-muted-foreground mb-5">You can keep browsing in live preview mode in the meantime.</p>
          <Button asChild variant="outline"><Link href={`/sites/${storeId}/products`}>Back to products</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <UnsavedChangesGuard dirty={dirty} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link href={`/sites/${storeId}/products`}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Link></Button>
          <h1 className="text-xl font-semibold">Edit product</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0 rounded-full bg-muted/60 p-1">
            <button onClick={() => setMode("basic")} className={cn("px-5 py-1.5 text-sm rounded-full transition-colors", mode === "basic" ? "bg-foreground text-background font-medium" : "text-muted-foreground")}>Basic</button>
            <button onClick={() => setMode("advanced")} className={cn("px-5 py-1.5 text-sm rounded-full transition-colors", mode === "advanced" ? "bg-foreground text-background font-medium" : "text-muted-foreground")}>Advanced</button>
          </div>
          <ActivityHistoryDrawer entityType="product" entityId={productId} />
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
            <Trash2 className="h-4 w-4 mr-1.5" />Delete
          </Button>
        </div>
      </div>

      {serverErrors.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-destructive mb-1">Couldn't save — {serverErrors.length} issue{serverErrors.length === 1 ? "" : "s"} to fix:</div>
              <ul className="space-y-0.5 text-xs text-foreground/80">
                {serverErrors.map((e, i) => (
                  <li key={i}><span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive mr-1.5">{e.field}</span>{e.message}</li>
                ))}
              </ul>
            </div>
            <button onClick={() => setServerErrors([])} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {mode === "basic" ? (
        <BasicEditor storeId={storeId} form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} saving={save.isPending} onCancel={() => router.push(`/sites/${storeId}/products`)} onPublish={onPublish} isEdit={true} />
      ) : (
        <AdvancedShell
          form={form}
          setForm={(u) => setForm((p) => (p ? u(p) : p))}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          canAdvance={canAdvance}
          onCancel={() => router.push(`/sites/${storeId}/products`)}
          onPublish={onPublish}
          saving={save.isPending}
          isEdit={true}
          tabContent={{
            basic: <BasicInfoTab storeId={storeId} form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} />,
            pricing: <PricingTaxTab form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} />,
            inventory: <InventoryShippingTab form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} />,
            variants: <VariantsTab storeId={storeId} productId={productId} form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} />,
          }}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the product from WooCommerce and your mirror. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove.mutate(); }} disabled={remove.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {remove.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : "Delete product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function EditProductPage() {
  return <SitePageShell><Inner /></SitePageShell>;
}

function ProductEditSkeleton() {
  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-44 rounded-full" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-4 min-w-0">
          <div className="rounded-lg border border-border bg-white p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-4 gap-2.5">
              <Skeleton className="aspect-square rounded-md col-span-2 row-span-2" />
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="aspect-square rounded-md" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white p-5 space-y-4">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-3">
              <div><Skeleton className="h-3 w-16 mb-1.5" /><Skeleton className="h-9 w-full" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Skeleton className="h-3 w-12 mb-1.5" /><Skeleton className="h-9 w-full" /></div>
                <div><Skeleton className="h-3 w-14 mb-1.5" /><Skeleton className="h-9 w-full" /></div>
              </div>
              <div><Skeleton className="h-3 w-20 mb-1.5" /><Skeleton className="h-24 w-full" /></div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-2 gap-3">
              <div><Skeleton className="h-3 w-20 mb-1.5" /><Skeleton className="h-9 w-full" /></div>
              <div><Skeleton className="h-3 w-16 mb-1.5" /><Skeleton className="h-9 w-full" /></div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-4 space-y-2.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="rounded-lg border border-border bg-white p-4 space-y-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
