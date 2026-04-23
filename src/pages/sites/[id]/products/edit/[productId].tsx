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
import { emptyProductForm, updateProduct, ProductFormState } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityHistoryDrawer } from "@/components/ActivityHistoryDrawer";

type ProductRow = Record<string, unknown>;

function Inner() {
  const router = useRouter();
  const { toast } = useToast();
  const { id: storeId, store, loading: storeLoading } = useSiteFromRoute();
  const productId = typeof router.query.productId === "string" ? router.query.productId : "";

  const [form, setForm] = useState<ProductFormState | null>(null);
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [activeTab, setActiveTab] = useState<AdvancedTabKey>("basic");
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
          sku: (p.sku as string) || "",
          weight: toNumStr(p.weight),
          dimensions: { length: dims.length || "", width: dims.width || "", height: dims.height || "" },
          images,
          categories,
          tags,
          attributes,
        });
        if (productType === "variable") setMode("advanced");
      } catch (e) {
        toast({ title: "Failed to load product", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, productId, toast]);

  const save = useSiteMutation<unknown, void>({
    mutationFn: () => updateProduct(storeId, productId, form!),
    invalidateKeys: [queryKeys.products(storeId), ["product", productId]],
    siteName: store?.name,
    successToast: "Saved",
    onSuccessExtra: () => router.push(`/sites/${storeId}/products`),
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
    save.mutate();
  }, [form, save]);

  const canAdvance = (tab: AdvancedTabKey) => {
    if (!form) return false;
    if (tab === "basic") return form.name.trim().length > 0;
    return true;
  };

  if (storeLoading || loading) return <SiteLoadingSkeleton />;
  if (!store || !form) return <div className="p-6">Product not found</div>;

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
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

      {mode === "basic" ? (
        <BasicEditor storeId={storeId} form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} saving={save.isPending} onCancel={() => router.push(`/sites/${storeId}/products`)} onPublish={onPublish} isEdit={true} />
      ) : (
        <AdvancedShell
          form={form}
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
