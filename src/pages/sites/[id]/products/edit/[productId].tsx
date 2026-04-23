import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BasicEditor } from "@/components/product-edit/BasicEditor";
import { AdvancedShell, AdvancedTabKey } from "@/components/product-edit/AdvancedShell";
import { BasicInfoTab } from "@/components/product-edit/tabs/BasicInfoTab";
import { PricingTaxTab } from "@/components/product-edit/tabs/PricingTaxTab";
import { InventoryShippingTab } from "@/components/product-edit/tabs/InventoryShippingTab";
import { VariantsTab } from "@/components/product-edit/tabs/VariantsTab";
import { emptyProductForm, updateProduct, fetchProductVariations, ProductFormState } from "@/services/productEditService";
import { useToast } from "@/hooks/use-toast";
import { useStores } from "@/hooks/queries/useStores";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";

type Mode = "basic" | "advanced";

type ProductRow = {
  name: string | null;
  slug: string | null;
  description: string | null;
  short_description: string | null;
  status: string | null;
  type: string | null;
  regular_price: string | number | null;
  sale_price: string | number | null;
  tax_status: string | null;
  tax_class: string | null;
  manage_stock: boolean | null;
  stock_quantity: number | null;
  stock_status: string | null;
  sold_individually: boolean | null;
  weight: string | null;
  dimensions: unknown;
  sku: string | null;
  categories: unknown;
  tags: unknown;
  images: unknown;
  attributes: unknown;
  meta_data?: unknown;
};

function buildFormFromRow(row: ProductRow, variations: ProductFormState["variations"]): ProductFormState {
  const base = emptyProductForm();
  const cats = Array.isArray(row.categories) ? (row.categories as { id: number; name?: string }[]) : [];
  const tags = Array.isArray(row.tags) ? (row.tags as { id?: number; name: string }[]) : [];
  const images = Array.isArray(row.images) ? (row.images as { id?: number; src: string; alt?: string }[]) : [];
  const attrs = Array.isArray(row.attributes) ? (row.attributes as ProductFormState["attributes"]) : [];
  const dims = row.dimensions && typeof row.dimensions === "object" ? row.dimensions as { length?: string; width?: string; height?: string } : {};
  return {
    ...base,
    name: row.name || "",
    slug: row.slug || "",
    description: row.description || "",
    short_description: row.short_description || "",
    status: (row.status as ProductFormState["status"]) || "publish",
    type: (row.type as ProductFormState["type"]) || "simple",
    regular_price: row.regular_price != null ? String(row.regular_price) : "",
    sale_price: row.sale_price != null ? String(row.sale_price) : "",
    tax_status: (row.tax_status as ProductFormState["tax_status"]) || "taxable",
    tax_class: row.tax_class || "",
    manage_stock: !!row.manage_stock,
    stock_quantity: row.stock_quantity ?? null,
    stock_status: (row.stock_status as ProductFormState["stock_status"]) || "instock",
    sold_individually: !!row.sold_individually,
    weight: row.weight || "",
    dimensions: { length: dims.length || "", width: dims.width || "", height: dims.height || "" },
    sku: row.sku || "",
    categories: cats,
    tags,
    images,
    attributes: attrs,
    variations,
  };
}

async function fetchProductRow(storeId: string, productId: string): Promise<ProductRow> {
  const res = await fetch(`/api/stores/${storeId}/products/${productId}`);
  if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
  return res.json();
}

async function deleteProduct(storeId: string, productId: string): Promise<void> {
  const res = await fetch(`/api/stores/${storeId}/products/${productId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Delete failed (${res.status})`);
  }
}

export default function ProductEditPage() {
  const router = useRouter();
  const { id: storeId, productId } = router.query as { id?: string; productId?: string };
  const { data: stores = [] } = useStores();
  const store = stores.find((s) => s.id === storeId);
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("basic");
  const [activeTab, setActiveTab] = useState<AdvancedTabKey>("basic");
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!storeId || !productId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const row = await fetchProductRow(storeId, productId);
        let vars: ProductFormState["variations"] = [];
        if ((row.type || "simple") === "variable") {
          try { vars = await fetchProductVariations(storeId, productId); } catch { vars = []; }
        }
        if (!cancelled) setForm(buildFormFromRow(row, vars));
      } catch (e) {
        if (!cancelled) toast({ title: "Failed to load product", description: (e as Error).message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, productId, toast]);

  const del = useSiteMutation<void, void>({
    mutationFn: () => deleteProduct(storeId!, productId!),
    invalidateKeys: storeId ? [queryKeys.products(storeId), ["product", productId]] : [],
    siteName: store?.name,
    successToast: "Product deleted",
    onSuccessExtra: () => {
      if (storeId) router.push(`/sites/${storeId}/products`);
    },
  });

  const save = useSiteMutation<unknown, void>({
    mutationFn: () => updateProduct(storeId!, productId!, form!),
    invalidateKeys: storeId && productId ? [queryKeys.products(storeId), ["product", productId]] : [],
    siteName: store?.name,
    successToast: "Saved",
    onSuccessExtra: () => {
      if (storeId) router.push(`/sites/${storeId}/products`);
    },
  });

  const onPublish = useCallback(() => {
    if (!form || !storeId || !productId) return;
    save.mutate();
  }, [form, storeId, productId, save]);

  const onCancel = useCallback(() => {
    if (storeId) router.push(`/sites/${storeId}/products`);
  }, [router, storeId]);

  const canAdvance = useCallback((tab: AdvancedTabKey) => {
    if (!form) return false;
    if (tab === "basic") return form.name.trim().length > 0;
    return true;
  }, [form]);

  if (loading || !form) {
    return (
      <AppLayout title="Edit product">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const tabContent = {
    basic: <BasicInfoTab storeId={storeId!} form={form} setForm={setForm} />,
    pricing: <PricingTaxTab form={form} setForm={setForm} />,
    inventory: <InventoryShippingTab form={form} setForm={setForm} />,
    variants: <VariantsTab storeId={storeId!} productId={productId!} form={form} setForm={setForm} />,
  };

  return (
    <AppLayout title={form.name || "Edit product"}>
      <div className="border-b bg-background">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/sites/${storeId}/products`} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm font-semibold truncate">{form.name || "Untitled product"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-md border bg-muted p-0.5 text-xs">
              <button onClick={() => setMode("basic")} className={`px-2.5 py-1 rounded ${mode === "basic" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Basic</button>
              <button onClick={() => setMode("advanced")} className={`px-2.5 py-1 rounded ${mode === "advanced" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Advanced</button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={del.isPending}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6">
        {mode === "basic" ? (
          <BasicEditor
            storeId={storeId!}
            form={form}
            setForm={setForm}
            saving={saving}
            onCancel={onCancel}
            onPublish={onPublish}
            isEdit
          />
        ) : (
          <AdvancedShell
            form={form}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabContent={tabContent}
            canAdvance={canAdvance}
            onCancel={onCancel}
            onPublish={onPublish}
            saving={saving}
            isEdit
          />
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium">{form.name || "this product"}</span> from {store?.name || "WooCommerce"} and from the local mirror. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
