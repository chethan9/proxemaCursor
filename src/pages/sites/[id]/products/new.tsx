import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
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
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";

function Inner() {
  const router = useRouter();
  const { id, store, loading } = useSiteFromRoute();
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [activeTab, setActiveTab] = useState<AdvancedTabKey>("basic");

  const create = useSiteMutation<{ id?: string }, void>({
    mutationFn: () => createProduct(id, form),
    invalidateKeys: [
      queryKeys.products(id),
      ["taxonomy", id, "categories"],
      ["taxonomy", id, "tags"],
      ["woo", "taxonomy", id, "categories"],
      ["woo", "taxonomy", id, "tags"],
    ],
    siteName: store?.name,
    successToast: (r) => `Product created${r && typeof r === "object" && "name" in r ? "" : ""}`,
    onSuccessExtra: () => router.push(`/sites/${id}/products`),
  });

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

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
        <BasicEditor storeId={id} form={form} setForm={setForm} saving={create.isPending} onCancel={() => router.push(`/sites/${id}/products`)} onPublish={() => create.mutate()} isEdit={false} />
      ) : (
        <AdvancedShell
          form={form}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          canAdvance={canAdvance}
          onCancel={() => router.push(`/sites/${id}/products`)}
          onPublish={() => create.mutate()}
          saving={create.isPending}
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