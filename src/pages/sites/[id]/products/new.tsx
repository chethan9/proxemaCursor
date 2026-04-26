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
import { emptyProductForm, createProduct, ProductFormState, ProductValidationIssue } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, X } from "lucide-react";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { useUnsavedChangesGuard, UnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

function Inner() {
  const router = useRouter();
  const { id, store, loading } = useSiteFromRoute();
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [form, setForm] = useState<ProductFormState>(emptyProductForm());
  const [activeTab, setActiveTab] = useState<AdvancedTabKey>("basic");
  const [serverErrors, setServerErrors] = useState<ProductValidationIssue[]>([]);
  const [savedOnce, setSavedOnce] = useState(false);
  const dirty = !savedOnce && (form.name.trim().length > 0 || form.description.trim().length > 0 || form.regular_price.trim().length > 0 || form.sku.trim().length > 0 || form.images.length > 0 || form.categories.length > 0 || form.tags.length > 0 || form.attributes.length > 0);
  useUnsavedChangesGuard(dirty);

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
    successToast: () => `Product created`,
    onSuccessExtra: () => { setSavedOnce(true); router.push(`/sites/${id}/products`); },
    onErrorExtra: (err) => {
      const e = err as Error & { validationErrors?: ProductValidationIssue[] };
      setServerErrors(e.validationErrors || []);
    },
  });

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  const canAdvance = (tab: AdvancedTabKey) => {
    if (tab === "basic") return form.name.trim().length > 0;
    return true;
  };

  const submit = () => { setServerErrors([]); create.mutate(); };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <UnsavedChangesGuard dirty={dirty} />
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
        <BasicEditor storeId={id} form={form} setForm={setForm} saving={create.isPending} onCancel={() => router.push(`/sites/${id}/products`)} onPublish={submit} isEdit={false} />
      ) : (
        <AdvancedShell
          form={form}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          canAdvance={canAdvance}
          onCancel={() => router.push(`/sites/${id}/products`)}
          onPublish={submit}
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