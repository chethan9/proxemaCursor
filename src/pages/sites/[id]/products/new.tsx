import { useState, useEffect, useMemo } from "react";
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
import { ArrowLeft, AlertCircle, Layers, Pencil, X } from "lucide-react";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { ProductStatusDropdown } from "@/components/product-edit/ProductStatusDropdown";
import { Separator } from "@/components/ui/separator";
import { useSyncLocked } from "@/components/site/SyncLockBanner";
import { Loader2 as Spinner } from "lucide-react";
import { useBlockingEffect } from "@/contexts/LoadingProvider";

function Inner() {
  const router = useRouter();
  const { id, store, loading } = useSiteFromRoute();
  const { locked: syncLocked, ready: syncReady } = useSyncLocked(id);
  const initialType = router.query.type === "variable" ? "variable" : "simple";
  const fallbackReturn = `/sites/${id}/products`;
  const rawReturnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : "";
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") ? rawReturnTo : fallbackReturn;
  const goBack = () => {
    router.push(returnTo);
  };
  const [mode, setMode] = useState<"basic" | "advanced">(initialType === "variable" ? "advanced" : "basic");
  const [form, setForm] = useState<ProductFormState>(() => {
    const base = emptyProductForm();
    return initialType === "variable" ? { ...base, type: "variable" } : base;
  });
  const [initialFormJson, setInitialFormJson] = useState<string>(() => {
    const base = emptyProductForm();
    return JSON.stringify(initialType === "variable" ? { ...base, type: "variable" } : base);
  });
  const [serverErrors, setServerErrors] = useState<ProductValidationIssue[]>([]);
  const [savedOnce, setSavedOnce] = useState(false);
  const dirty = !savedOnce && initialFormJson !== JSON.stringify(form);

  const baselineForm = useMemo(
    () => JSON.parse(initialFormJson) as ProductFormState,
    [initialFormJson],
  );

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.type === "variable" && form.type !== "variable") {
      setForm((p) => ({ ...p, type: "variable" }));
      const base = emptyProductForm();
      setInitialFormJson(JSON.stringify({ ...base, type: "variable" }));
      setMode("advanced");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.type]);

  const create = useSiteMutation<{ id?: string }, void>({
    mutationFn: () => createProduct(id, form),
    invalidateKeys: [
      queryKeys.products(id),
      ["taxonomy", "categories", id],
      ["taxonomy", "tags", id],
      ["taxonomy", "brands", id],
      ["woo", "taxonomy", id, "categories"],
      ["woo", "taxonomy", id, "tags"],
      ["woo", "taxonomy", id, "brands"],
    ],
    siteName: store?.name,
    successToast: () => `Product created`,
    onSuccessExtra: () => {
      setSavedOnce(true);
      setInitialFormJson(JSON.stringify(form));
      setTimeout(() => router.push(returnTo), 50);
    },
    onErrorExtra: (err) => {
      const e = err as Error & { validationErrors?: ProductValidationIssue[] };
      setServerErrors(e.validationErrors || []);
    },
  });

  useBlockingEffect(create.isPending, "Creating product…");

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;
  if (syncReady && syncLocked) {
    return (
      <div className="space-y-4 px-6 pb-6 pt-4 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link href={returnTo}><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Link></Button>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-8 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-warning/15 mb-4">
            <Spinner className="h-6 w-6 text-warning animate-spin" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Adding products is locked while we finish importing</h2>
          <p className="text-sm text-muted-foreground mb-1">
            Your store is still doing its initial sync. To avoid data conflicts, creating new products is disabled until the import finishes — usually just a few minutes.
          </p>
          <p className="text-sm text-muted-foreground mb-5">You can keep browsing in live preview mode in the meantime.</p>
          <Button asChild variant="outline"><Link href={returnTo}>Back to products</Link></Button>
        </div>
      </div>
    );
  }

  const canAdvance = (tab: AdvancedTabKey) => {
    if (form.status !== "publish") return true;
    if (tab === "basic") return form.name.trim().length > 0;
    if (tab === "pricing" || tab === "inventory") {
      if (form.type === "variable") return true;
      const n = parseFloat((form.regular_price || "").trim());
      return !isNaN(n) && n > 0;
    }
    if (tab === "variants") {
      if (form.type !== "variable") return true;
      const vars = form.variations || [];
      if (vars.length === 0) return false;
      return vars.every((v) => {
        if (v.enabled === false) return true;
        const n = parseFloat((v.regular_price || "").trim());
        return !isNaN(n) && n > 0;
      });
    }
    return true;
  };

  const submit = () => { setServerErrors([]); create.mutate(); };

  return (
    <div className={cn("space-y-4 px-6 pt-4 max-w-[1400px] mx-auto", mode === "advanced" ? "pb-28" : "pb-6")}>
      <h1 className="sr-only">Add new product</h1>
      <div
        role="toolbar"
        aria-label="New product"
        className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm"
      >
        <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs" asChild>
          <Link href={returnTo}>
            <ArrowLeft className="size-3.5 shrink-0" />
            Back
          </Link>
        </Button>
        <Separator orientation="vertical" className="hidden h-7 sm:block" />
        <div className="flex min-w-0 items-center gap-1 rounded-md bg-muted/70 p-1">
          <button
            type="button"
            onClick={() => setMode("basic")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-sm px-2.5 text-xs font-medium transition-colors",
              mode === "basic"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Pencil className="size-3.5 shrink-0" />
            Basic
          </button>
          <button
            type="button"
            onClick={() => setMode("advanced")}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-sm px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-2",
              form.type === "variable"
                ? mode === "advanced"
                  ? "bg-orange-500 text-white shadow-sm hover:bg-orange-600"
                  : "bg-orange-500/25 text-orange-950 ring-1 ring-inset ring-orange-500/45 hover:bg-orange-500/35 dark:bg-orange-500/30 dark:text-orange-50 dark:ring-orange-400/50"
                : mode === "advanced"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Layers className="size-3.5 shrink-0" />
            Variations
          </button>
          <Separator orientation="vertical" className="mx-0.5 h-6" />
          <ProductStatusDropdown
            value={form.status}
            onChange={(status) => setForm((p) => ({ ...p, status }))}
            disabled={create.isPending}
            className="h-8 rounded-md border-0 bg-background px-2 text-xs shadow-none hover:bg-muted/80"
          />
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
        <BasicEditor storeId={id} productId={null} form={form} setForm={setForm} saving={create.isPending} onCancel={goBack} onPublish={submit} isEdit={false} />
      ) : (
        <AdvancedShell
          form={form}
          baselineForm={baselineForm}
          setForm={setForm}
          canAdvance={canAdvance}
          onCancel={goBack}
          onPublish={submit}
          saving={create.isPending}
          isEdit={false}
          storeId={id}
          productId={null}
          tabContent={{
            basic: <BasicInfoTab storeId={id} productId={null} form={form} setForm={setForm} />,
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