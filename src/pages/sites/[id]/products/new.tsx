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
import { demoteVariableProductToSimple, emptyProductForm, createProduct, ProductFormState, ProductValidationIssue } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, AlertCircle, Layers, Pencil, X } from "lucide-react";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { ProductStatusDropdown } from "@/components/product-edit/ProductStatusDropdown";
import { Separator } from "@/components/ui/separator";
import { useSyncLocked } from "@/components/site/SyncLockBanner";
import { Loader2 as Spinner } from "lucide-react";
import { useBlockingEffect } from "@/contexts/LoadingProvider";
import { validateProductForm } from "@/services/productValidation";

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
    return initialType === "variable" ? { ...base, type: "variable", status: "draft" } : { ...base, status: "draft" };
  });
  const [initialFormJson, setInitialFormJson] = useState<string>(() => {
    const base = emptyProductForm();
    return JSON.stringify(initialType === "variable" ? { ...base, type: "variable", status: "draft" } : { ...base, status: "draft" });
  });
  const [promoteToVariableOpen, setPromoteToVariableOpen] = useState(false);
  const [switchToBasicOpen, setSwitchToBasicOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<ProductValidationIssue[]>([]);
  const [savedOnce, setSavedOnce] = useState(false);
  const [variantsNavTick, setVariantsNavTick] = useState(0);
  const draftStorageKey = `product-new-draft:${id}`;
  const dirty = !savedOnce && initialFormJson !== JSON.stringify(form);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mode !== "basic") return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mode !== "advanced" || loading) return;
    if (variantsNavTick === 0) return;
    const t = window.setTimeout(() => {
      document.getElementById("product-edit-section-variants")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [mode, variantsNavTick, loading]);

  const baselineForm = useMemo(
    () => JSON.parse(initialFormJson) as ProductFormState,
    [initialFormJson],
  );

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.type === "variable" && form.type !== "variable") {
      setForm((p) => ({ ...p, type: "variable", status: p.status || "draft" }));
      const base = emptyProductForm();
      setInitialFormJson(JSON.stringify({ ...base, type: "variable", status: "draft" }));
      setMode("advanced");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.type]);

  useEffect(() => {
    if (!router.isReady || !id || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ProductFormState;
      if (parsed?.status !== "draft") return;
      setForm(parsed);
      setInitialFormJson(JSON.stringify(parsed));
      setMode(parsed.type === "variable" ? "advanced" : "basic");
    } catch {
      /* ignore invalid cached draft */
    }
  }, [router.isReady, id, draftStorageKey]);

  useEffect(() => {
    if (!id || savedOnce || form.status !== "draft" || typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(form));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [id, savedOnce, form, draftStorageKey]);

  const create = useSiteMutation<{ id?: string }, void>({
    mutationFn: () => createProduct(id, form),
    invalidateQueryFilters: { refetchType: "all" },
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
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftStorageKey);
      }
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
      <div className="space-y-4 px-6 pb-6 pt-2 max-w-[1400px] mx-auto">
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
  const editorValidation = validateProductForm(form);
  const saveBlocked = !editorValidation.ok;
  const publishing = form.status === "publish";
  const modeTabActiveClass =
    "bg-orange-500 text-white shadow-sm hover:bg-orange-600";

  return (
    <div
      className={cn(
        "min-h-0 space-y-3 bg-background pt-2 pb-6 mx-auto w-full",
        mode === "advanced"
          ? "max-w-[min(1920px,100%)] px-3 sm:px-5"
          : "max-w-[1400px] px-6",
      )}
    >
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
            onClick={() => {
              if (mode === "basic") return;
              if (form.type === "variable") {
                setSwitchToBasicOpen(true);
                return;
              }
              setMode("basic");
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-sm px-2.5 text-xs font-medium transition-colors",
              mode === "basic"
                ? modeTabActiveClass
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Pencil className="size-3.5 shrink-0" />
            Basic
          </button>
          <button
            type="button"
            onClick={() => {
              if (form.type === "simple") {
                setPromoteToVariableOpen(true);
                return;
              }
              setVariantsNavTick((n) => n + 1);
              setMode("advanced");
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-sm px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2",
              mode === "advanced"
                ? modeTabActiveClass
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
        <div className="ml-auto flex items-center">
          <Button
            size="sm"
            onClick={submit}
            disabled={create.isPending || saveBlocked || (publishing && !form.name.trim())}
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            title={saveBlocked ? editorValidation.errors[0]?.message : "Save changes"}
          >
            {create.isPending ? <Spinner className="size-3.5 animate-spin" /> : null}
            {create.isPending ? "Saving…" : "Save changes"}
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
        <BasicEditor storeId={id} productId={null} form={form} setForm={setForm} />
      ) : (
        <AdvancedShell
          form={form}
          baselineForm={baselineForm}
          setForm={setForm}
          canAdvance={canAdvance}
          onCancel={goBack}
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

      <AlertDialog open={switchToBasicOpen} onOpenChange={setSwitchToBasicOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to Basic editor?</AlertDialogTitle>
            <AlertDialogDescription>
              Basic mode uses a simplified layout. Attributes, variation rows, and the full advanced sections are available in Variations mode.
              Your edits stay in the form — you can switch back anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSwitchToBasicOpen(false);
                setForm((p) => (p.type === "variable" ? demoteVariableProductToSimple(p) : p));
                setMode("basic");
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={promoteToVariableOpen} onOpenChange={setPromoteToVariableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to variable product?</AlertDialogTitle>
            <AlertDialogDescription>
              This product is currently simple. Switching now will move you into variations mode before saving.
              You can continue editing and save when ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setForm((p) => ({ ...p, type: "variable" }));
                setVariantsNavTick((n) => n + 1);
                setMode("advanced");
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function NewProductPage() {
  return <SitePageShell><Inner /></SitePageShell>;
}