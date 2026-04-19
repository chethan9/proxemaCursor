import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { BasicEditor } from "@/components/product-edit/BasicEditor";
import { emptyProductForm, createProduct, ProductFormState } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function Inner() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { id, store, loading } = useSiteFromRoute();
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [saving, setSaving] = useState(false);

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  const onPublish = async () => {
    setSaving(true);
    try {
      const created = await createProduct(id, form);
      qc.invalidateQueries({ queryKey: ["products", id] });
      toast({ title: "Product created", description: form.name });
      router.push(`/sites/${id}/products`);
      void created;
    } catch (e) {
      toast({ title: "Failed to create", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link href={`/sites/${id}/products`}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Link></Button>
        <h1 className="text-xl font-semibold">Add new product</h1>
      </div>
      <BasicEditor storeId={id} form={form} setForm={setForm} saving={saving} onCancel={() => router.push(`/sites/${id}/products`)} onPublish={onPublish} isEdit={false} />
    </div>
  );
}

export default function NewProductPage() {
  return <SitePageShell><Inner /></SitePageShell>;
}