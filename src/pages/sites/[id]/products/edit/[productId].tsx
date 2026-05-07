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
import { emptyProductForm, updateProduct, fetchProductVariations, ProductFormState, ProductValidationIssue } from "@/services/productEditService";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { queryKeys } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  X,
  ExternalLink,
  RefreshCw,
  Eye,
  Pencil,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityHistoryDrawer } from "@/components/ActivityHistoryDrawer";
import { ProductStatusDropdown } from "@/components/product-edit/ProductStatusDropdown";
import { Separator } from "@/components/ui/separator";
import { useSyncLocked } from "@/components/site/SyncLockBanner";
import { Loader2 as Spinner } from "lucide-react";
import { useBlockingEffect } from "@/contexts/LoadingProvider";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { authorizedFetch } from "@/lib/api-client";
import { validateProductForm } from "@/services/productValidation";

type ProductRow = Record<string, unknown>;

function Inner() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { id: storeId, store, loading: storeLoading } = useSiteFromRoute();
  const productId = typeof router.query.productId === "string" ? router.query.productId : "";
  const { locked: syncLocked, ready: syncReady } = useSyncLocked(storeId);
  const fallbackReturn = `/sites/${storeId}/products`;
  const rawReturnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : "";
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") ? rawReturnTo : fallbackReturn;
  const goBack = () => {
    router.push(returnTo);
  };

  const [form, setForm] = useState<ProductFormState | null>(null);
  const [initialFormJson, setInitialFormJson] = useState<string>("");
  const [savedOnce, setSavedOnce] = useState(false);
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [promoteToVariableOpen, setPromoteToVariableOpen] = useState(false);
  const [switchToBasicOpen, setSwitchToBasicOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<ProductValidationIssue[]>([]);
  const [wooId, setWooId] = useState<number | null>(null);
  const [baselineForm, setBaselineForm] = useState<ProductFormState | null>(null);
  const [storefrontUrl, setStorefrontUrl] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  /** Increment on Variations navigation so we scroll to the Variants block without scrolling on initial variable-product load. */
  const [variantsNavTick, setVariantsNavTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mode !== "basic") return;
    // Anchor to top when returning to Basic mode (not when entering Variations — that would hide the Variants section).
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mode !== "advanced" || loading || storeLoading) return;
    if (variantsNavTick === 0) return;
    const t = window.setTimeout(() => {
      document.getElementById("product-edit-section-variants")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [mode, variantsNavTick, loading, storeLoading]);

  useEffect(() => {
    if (!storeId || !productId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setBaselineForm(null);
      setStorefrontUrl(null);
      try {
        const res = await fetch(`/api/stores/${storeId}/products/${productId}`);
        if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
        const p = (await res.json()) as ProductRow;
        if (cancelled) return;

        const base = emptyProductForm();
        const toNumStr = (v: unknown) => (v == null ? "" : String(v));
        const productType = (p.product_type as string) || (p.type as string) || "simple";
        const wooIdVal = (p.woo_id as number) ?? (p.id as number) ?? null;
        setWooId(typeof wooIdVal === "number" ? wooIdVal : null);
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

        const taxStatus = ((p.tax_status as ProductFormState["tax_status"]) ?? (raw.tax_status as ProductFormState["tax_status"]) ?? "taxable") as ProductFormState["tax_status"];
        const taxClass = ((p.tax_class as string | null | undefined) ?? (raw.tax_class as string | null | undefined) ?? "") || "";
        const defaultAttrs = Array.isArray(raw.default_attributes)
          ? (raw.default_attributes as { id?: number; name: string; option: string }[])
          : [];

        let variations: ProductFormState["variations"] = [];
        if (productType === "variable") {
          try {
            variations = await fetchProductVariations(storeId, productId);
          } catch {
            variations = [];
          }
        }

        const slugStr = ((p.slug as string) || "").trim();
        const rawPermalink =
          raw && typeof raw === "object" && typeof (raw as { permalink?: string }).permalink === "string"
            ? (raw as { permalink: string }).permalink.trim()
            : "";
        const baseStoreUrl = typeof store?.url === "string" ? store.url.replace(/\/$/, "") : "";
        const resolvedStorefront =
          rawPermalink.startsWith("http")
            ? rawPermalink
            : baseStoreUrl && slugStr
              ? `${baseStoreUrl}/product/${encodeURIComponent(slugStr)}/`
              : null;
        if (!cancelled) setStorefrontUrl(resolvedStorefront);

        const merged: ProductFormState = {
          ...base,
          name: (p.name as string) || "",
          description: (p.description as string) || "",
          short_description: (p.short_description as string) || "",
          slug: (p.slug as string) || "",
          status: ((p.status as ProductFormState["status"]) || "publish"),
          type: productType === "variable" ? "variable" : "simple",
          regular_price: toNumStr(p.regular_price),
          sale_price: toNumStr(p.sale_price),
          tax_status: taxStatus,
          tax_class: taxClass,
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
          variations,
          default_attributes: defaultAttrs,
          image_mirror_urls:
            p.image_mirror_urls && typeof p.image_mirror_urls === "object"
              ? (p.image_mirror_urls as ProductFormState["image_mirror_urls"])
              : undefined,
        };

        setForm(merged);
        setBaselineForm(JSON.parse(JSON.stringify(merged)) as ProductFormState);
        setInitialFormJson(JSON.stringify(merged));
        if (productType === "variable") setMode("advanced");
      } catch (e) {
        toast({ title: "Failed to load product", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, productId, toast, reloadTick]);

  useEffect(() => {
    const slug = (form?.slug ?? "").trim();
    const url = typeof store?.url === "string" ? store.url.trim() : "";
    if (!slug || !url) return;
    const built = `${url.replace(/\/$/, "")}/product/${encodeURIComponent(slug)}/`;
    setStorefrontUrl((prev) => (prev?.startsWith("http") ? prev : built));
  }, [form?.slug, store?.url]);

  const dirty = !!form && !savedOnce && initialFormJson !== "" && JSON.stringify(form) !== initialFormJson;

  const save = useSiteMutation<unknown, void>({
    mutationFn: () => updateProduct(storeId, productId, form!),
    invalidateQueryFilters: { refetchType: "all" },
    invalidateKeys: [
      queryKeys.products(storeId),
      ["product", productId],
      ["taxonomy", "categories", storeId],
      ["taxonomy", "tags", storeId],
      ["taxonomy", "brands", storeId],
      ["woo", "taxonomy", storeId, "categories"],
      ["woo", "taxonomy", storeId, "tags"],
      ["woo", "taxonomy", storeId, "brands"],
    ],
    siteName: store?.name,
    successToast: "Saved",
    onSuccessExtra: () => { setSavedOnce(true); router.push(returnTo); },
    onErrorExtra: (err) => {
      const e = err as Error & { validationErrors?: ProductValidationIssue[] };
      setServerErrors(e.validationErrors || []);
    },
  });

  const remove = useSiteMutation<unknown, void>({
    invalidateQueryFilters: { refetchType: "all" },
    mutationFn: async () => {
      const res = await authorizedFetch(`/api/stores/${storeId}/products/${productId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || `Delete failed (${res.status})`);
      }
      return res.json();
    },
    invalidateKeys: [
      queryKeys.products(storeId),
      ["taxonomy", "categories", storeId],
      ["taxonomy", "tags", storeId],
      ["taxonomy", "brands", storeId],
      ["woo", "taxonomy", storeId, "categories"],
      ["woo", "taxonomy", storeId, "tags"],
      ["woo", "taxonomy", storeId, "brands"],
    ],
    siteName: store?.name,
    successToast: "Product deleted",
    onSuccessExtra: () => router.push(returnTo),
    onErrorExtra: () => setDeleteOpen(false),
  });

  useBlockingEffect(save.isPending, "Saving product…");
  useBlockingEffect(remove.isPending, "Deleting product…");

  const onPublish = useCallback(() => {
    if (!form) return;
    setServerErrors([]);
    save.mutate();
  }, [form, save]);

  const refreshFromStore = useCallback(async () => {
    if (!storeId || !productId) return;
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/stores/${storeId}/products/${productId}/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Refresh failed (${res.status})`);
      }
      toast({ title: "Refreshed from WooCommerce" });
      void qc.invalidateQueries({ queryKey: queryKeys.products(storeId) });
      void qc.invalidateQueries({ queryKey: ["product", productId] });
      setReloadTick((n) => n + 1);
    } catch (e) {
      toast({
        title: "Refresh failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  }, [storeId, productId, toast, qc]);

  const canAdvance = (tab: AdvancedTabKey) => {
    if (!form) return false;
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

  if (storeLoading || loading) return <ProductEditSkeleton />;
  if (!store || !form) return <div className="p-6">Product not found</div>;
  const editorValidation = validateProductForm(form);
  const saveBlocked = !editorValidation.ok;
  const publishing = form.status === "publish";
  /** Active Basic / Variations segment — same orange whether the product is simple or variable */
  const modeTabActiveClass =
    "bg-orange-500 text-white shadow-sm hover:bg-orange-600";
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
          <h2 className="text-lg font-semibold mb-2">Editing is locked while we finish importing</h2>
          <p className="text-sm text-muted-foreground mb-1">
            Your store is still doing its initial sync. To avoid data conflicts, product edits are disabled until the import finishes — usually just a few minutes.
          </p>
          <p className="text-sm text-muted-foreground mb-5">You can keep browsing in live preview mode in the meantime.</p>
          <Button asChild variant="outline"><Link href={returnTo}>Back to products</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-0 space-y-3 bg-background pt-2 pb-6 mx-auto w-full",
        mode === "advanced"
          ? "max-w-[min(1920px,100%)] px-3 sm:px-5"
          : "max-w-[1400px] px-6",
      )}
    >
      <h1 className="sr-only">Edit product</h1>
      <div
        role="toolbar"
        aria-label="Product editor"
        className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm"
      >
        <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs" asChild>
          <Link href={returnTo}>
            <ArrowLeft className="size-3.5 shrink-0" />
            Back
          </Link>
        </Button>

        {(storefrontUrl || (wooId && store?.url) || wooId) ? (
          <>
            <Separator orientation="vertical" className="hidden h-7 sm:block" />
            <div className="flex min-w-0 flex-wrap items-center gap-0.5 rounded-md border border-border/80 bg-muted/40 p-0.5">
              {storefrontUrl && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
                  <a href={storefrontUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="size-3.5 shrink-0 text-emerald-600" />
                    <span className="hidden md:inline">View in store</span>
                  </a>
                </Button>
              )}
              {wooId && store?.url && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" asChild>
                  <a
                    href={`${(store.url as string).replace(/\/$/, "")}/wp-admin/post.php?post=${wooId}&action=edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-3.5 shrink-0 text-blue-600" />
                    <span className="hidden lg:inline">WordPress</span>
                  </a>
                </Button>
              )}
              {wooId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => void refreshFromStore()}
                  disabled={refreshing}
                >
                  <RefreshCw className={cn("size-3.5 shrink-0 text-muted-foreground", refreshing && "animate-spin text-primary")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              )}
            </div>
          </>
        ) : null}

        <Separator orientation="vertical" className="hidden h-7 sm:block" />

        <div className="flex min-w-0 flex-wrap items-center gap-1">
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
                if (form?.type === "simple") {
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
              onChange={(status) => setForm((p) => (p ? { ...p, status } : p))}
              disabled={save.isPending}
              className="h-8 rounded-md border-0 bg-background px-2 text-xs shadow-none hover:bg-muted/80"
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ActivityHistoryDrawer
            entityType="product"
            entityId={productId}
            storeId={storeId}
            className="h-8 gap-1 px-2 text-xs"
          />
          <Button
            size="sm"
            onClick={onPublish}
            disabled={save.isPending || saveBlocked || (publishing && !form.name.trim())}
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            title={saveBlocked ? editorValidation.errors[0]?.message : "Save changes"}
          >
            {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {save.isPending ? "Saving…" : "Save changes"}
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
        <BasicEditor
          storeId={storeId}
          productId={productId as string}
          form={form}
          setForm={(u) => setForm((p) => (p ? u(p) : p))}
        />
      ) : (
        <AdvancedShell
          form={form}
          baselineForm={baselineForm}
          setForm={(u) => setForm((p) => (p ? u(p) : p))}
          canAdvance={canAdvance}
          onRequestDelete={() => setDeleteOpen(true)}
          storeId={storeId}
          productId={productId}
          tabContent={{
            basic: <BasicInfoTab storeId={storeId} productId={productId as string} form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} />,
            pricing: <PricingTaxTab form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} />,
            inventory: <InventoryShippingTab form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} />,
            variants: <VariantsTab storeId={storeId} productId={productId} form={form} setForm={(u) => setForm((p) => (p ? u(p) : p))} />,
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
              You can still review and save when ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setForm((p) => (p ? { ...p, type: "variable" } : p));
                setVariantsNavTick((n) => n + 1);
                setMode("advanced");
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    <div className="space-y-4 px-6 pb-6 pt-2 max-w-[1400px] mx-auto animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
        <Skeleton className="h-8 w-14 shrink-0" />
        <Skeleton className="hidden h-7 w-px shrink-0 sm:block" />
        <Skeleton className="h-8 w-40 shrink-0 rounded-md" />
        <Skeleton className="hidden h-7 w-px shrink-0 sm:block" />
        <Skeleton className="h-8 min-w-[200px] flex-1 rounded-md sm:max-w-[320px]" />
        <Skeleton className="ml-auto h-8 w-20 shrink-0" />
        <Skeleton className="h-8 w-16 shrink-0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-4 min-w-0">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-4 gap-2.5">
              <Skeleton className="aspect-square rounded-md col-span-2 row-span-2" />
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="aspect-square rounded-md" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
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

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-2 gap-3">
              <div><Skeleton className="h-3 w-20 mb-1.5" /><Skeleton className="h-9 w-full" /></div>
              <div><Skeleton className="h-3 w-16 mb-1.5" /><Skeleton className="h-9 w-full" /></div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
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
