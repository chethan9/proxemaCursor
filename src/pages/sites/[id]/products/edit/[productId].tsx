import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { BasicEditor } from "@/components/product-edit/BasicEditor";
import { emptyProductForm, updateProduct, ProductFormState } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ProductRow } from "@/services/productService";

function Inner() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { id, store, loading } = useSiteFromRoute();
  const productId = Array.isArray(router.query.productId) ? router.query.productId[0] : router.query.productId;
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
      if (data) {
        const p = data as unknown as ProductRow;
        const raw = (p.raw_data || {}) as Record<string, unknown>;
        setForm({
          name: p.name || "",
          description: p.description || "",
          short_description: p.short_description || "",
          slug: p.slug || "",
          status: (p.status as ProductFormState["status"]) || "publish",
          type: (p.type as ProductFormState["type"]) || "simple",
          regular_price: String(p.regular_price || ""),
          sale_price: String(p.sale_price || ""),
          tax_status: (raw.tax_status as ProductFormState["tax_status"]) || "taxable",
          tax_class: (raw.tax_class as string) || "",
          manage_stock: !!raw.manage_stock,
          stock_quantity: p.stock_quantity,
          stock_status: (p.stock_status as ProductFormState["stock_status"]) || "instock",
          sold_individually: !!raw.sold_individually,
          weight: (raw.weight as string) || "",
          dimensions: (raw.dimensions as { length: string; width: string; height: string }) || { length: "", width: "", height: "" },
          sku: p.sku || "",
          categories: Array.isArray(p.categories) ? (p.categories as { id: number; name?: string }[]) : [],
          tags: Array.isArray(raw.tags) ? (raw.tags as { id?: number; name: string }[]) : [],
          brands: Array.isArray(raw.brands) ? (raw.brands as { id: number; name?: string }[]) : [],
          images: Array.isArray(p.images) ? (p.images as { id?: number; src: string; alt?: string }[]) : [],
          attributes: Array.isArray(p.attributes) ? (p.attributes as ProductFormState["attributes"]) : [],
        });
      }
      setFetching(false);
    })();
  }, [productId]);

  if (loading || fetching) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  if (!productId) return <div className="p-6">Missing product</div>;

  const onPublish = async () => {
    setSaving(true);
    try {
      await updateProduct(id, productId, form);
      qc.invalidateQueries({ queryKey: ["products", id] });
      toast({ title: "Product saved" });
      router.push(`/sites/${id}/products`);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href={`/sites/${id}/products`}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Link></Button>
        <h1 className="text-xl font-semibold truncate">Edit · {form.name || "Product"}</h1>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <BasicEditor storeId={id} form={form} setForm={setForm} saving={saving} onCancel={() => router.push(`/sites/${id}/products`)} onPublish={onPublish} isEdit />
    </div>
  );
}

export default function EditProductPage() {
  return <SitePageShell><Inner /></SitePageShell>;
}