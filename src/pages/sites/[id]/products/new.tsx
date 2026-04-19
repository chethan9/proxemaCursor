import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { BasicEditor } from "@/components/product-edit/BasicEditor";
import { AdvancedShell, AdvancedTabKey } from "@/components/product-edit/AdvancedShell";
import { BasicInfoTab } from "@/components/product-edit/tabs/BasicInfoTab";
import { PricingTaxTab } from "@/components/product-edit/tabs/PricingTaxTab";
import { InventoryShippingTab } from "@/components/product-edit/tabs/InventoryShippingTab";
import { VariantsTab } from "@/components/product-edit/tabs/VariantsTab";
import { emptyProductForm, createProduct, ProductFormState } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function Inner() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { id, store, loading } = useSiteFromRoute();
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [activeTab, setActiveTab] = useState<AdvancedTabKey>("basic");
  const [saving, setSaving] = useState(false);

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  const onPublish = async () => {
    setSaving(true);
    try {
      await createProduct(id, form);
      qc.invalidateQueries({ queryKey: ["products", id] });
      toast({ title: "Product created", description: form.name });
      router.push(`/sites/${id}/products`);
    } catch (e) {
      toast({ title: "Failed to create", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canAdvance = (tab: AdvancedTabKey) => {
    if (tab === "basic") return form.name.trim().length > 0;
    return true;
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link href={`/sites/${id}/products`}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Link></Button>
          <h1 className="text-xl font-semibold">Add new product</h1>
        </div>
        <div className="flex items-center gap-0 rounded-full bg-muted/60 p-1">
          <button onClick={() => setMode("basic")} className={cn("px-5 py-1.5 text-sm rounded-full transition-colors", mode === "basic" ? "bg-foreground text-background font-medium" : "text-muted-foreground")}>Basic</button>
          <button onClick={() => setMode("advanced")} className={cn("px-5 py-1.5 text-sm rounded-full transition-colors", mode === "advanced" ? "bg-foreground text-background font-medium" : "text-muted-foreground")}>Advanced</button>
        </div>
      </div>
      {mode === "basic" ? (
        <BasicEditor storeId={id} form={form} setForm={setForm} saving={saving} onCancel={() => router.push(`/sites/${id}/products`)} onPublish={onPublish} isEdit={false} />
      ) : (
        <AdvancedShell
          form={form}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          canAdvance={canAdvance}
          onCancel={() => router.push(`/sites/${id}/products`)}
          onPublish={onPublish}
          saving={saving}
          isEdit={false}
          tabContent={{
            basic: <BasicInfoTab storeId={id} form={form} setForm={setForm} />,
            pricing: <PricingTaxTab form={form} setForm={setForm} />,
            inventory: <InventoryShippingTab form={form} setForm={setForm} />,
            variants: <VariantsTab storeId={id} form={form} setForm={setForm} />,
          }}
        />
      )}
    </div>
  );
}

export default function NewProductPage() {
  return <SitePageShell><Inner /></SitePageShell>;
}