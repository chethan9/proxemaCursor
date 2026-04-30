import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ProductFormState,
  Variation,
  fetchProductVariations,
  defaultAttributesFromVariation,
  variationMatchesDefault,
} from "@/services/productEditService";
import { AttributeEditor } from "@/components/product-edit/variants/AttributeEditor";
import { VariationsTable } from "@/components/product-edit/variants/VariationsTable";
import { VariationEditDialog } from "@/components/product-edit/variants/VariationEditDialog";
import { generateMatrix, mergeVariations, variationAttributeComboKey } from "@/components/product-edit/variants/utils";
import { Loader2, RefreshCw, Info } from "lucide-react";

type Props = {
  storeId: string;
  productId?: string;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
};

export function VariantsTab({ storeId, productId, form, setForm }: Props) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedFromWoo, setLoadedFromWoo] = useState(false);
  const fetchedRef = useRef(false);
  const productMode: "simple" | "variable" = form.type === "variable" ? "variable" : "simple";

  const loadVariations = async (refresh = false) => {
    if (!productId || productMode !== "variable") return;
    setLoading(true);
    try {
      const url = `/api/stores/${storeId}/products/${productId}/variations${refresh ? "?refresh=1" : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const vs = (await res.json()) as Variation[];
        setForm((p) => ({ ...p, variations: vs }));
        setLoadedFromWoo(true);
      }
    } catch (e) {
      console.error("[variants-tab] load error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount for variable products with no variations yet
  useEffect(() => {
    if (fetchedRef.current) return;
    if (productMode !== "variable") return;
    if (!productId) return;
    if (form.variations.length > 0) { fetchedRef.current = true; return; }
    fetchedRef.current = true;
    void loadVariations(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, productMode]);

  const regenerate = () => {
    const fresh = generateMatrix(form.attributes);
    setForm((p) => {
      const merged = mergeVariations(fresh, p.variations);
      const freshKeys = new Set(fresh.map((v) => v.key));
      const orphanedIds = p.variations.filter((v) => v.id && !freshKeys.has(v.key)).map((v) => v.id!) as number[];
      return {
        ...p,
        variations: merged,
        deletedVariationIds: [...(p.deletedVariationIds || []), ...orphanedIds],
      };
    });
  };

  const updateVariation = (idx: number, patch: Partial<Variation>) => {
    setForm((p) => {
      const vs = [...p.variations];
      vs[idx] = { ...vs[idx], ...patch };
      return { ...p, variations: vs };
    });
  };

  const removeVariation = (idx: number) => {
    setForm((p) => {
      const v = p.variations[idx];
      const deleted = v.id ? [...(p.deletedVariationIds || []), v.id] : (p.deletedVariationIds || []);
      const wasDefault = variationMatchesDefault(v, p.default_attributes);
      return {
        ...p,
        variations: p.variations.filter((_, i) => i !== idx),
        deletedVariationIds: deleted,
        default_attributes: wasDefault ? [] : p.default_attributes,
      };
    });
    setEditIdx(null);
  };

  const applyBulk = (patch: Partial<Variation>, onlySelected: boolean, selectedKeys: Set<string>) => {
    setForm((p) => ({
      ...p,
      variations: p.variations.map((v) => (onlySelected && !selectedKeys.has(v.key) ? v : { ...v, ...patch })),
    }));
  };

  const bulkDelete = (keys: Set<string>) => {
    setForm((p) => {
      const removedIds = p.variations.filter((v) => keys.has(v.key) && v.id).map((v) => v.id!) as number[];
      const removed = p.variations.filter((v) => keys.has(v.key));
      const stillDefault = removed.every((v) => !variationMatchesDefault(v, p.default_attributes));
      return {
        ...p,
        variations: p.variations.filter((v) => !keys.has(v.key)),
        deletedVariationIds: [...(p.deletedVariationIds || []), ...removedIds],
        default_attributes: stillDefault ? p.default_attributes : [],
      };
    });
  };

  const setDefaultVariation = (idx: number) => {
    setForm((p) => {
      const v = p.variations[idx];
      if (!v) return p;
      const isAlready = variationMatchesDefault(v, p.default_attributes);
      if (isAlready) return { ...p, default_attributes: [] };
      return { ...p, default_attributes: defaultAttributesFromVariation(v, p.attributes) };
    });
  };

  const hasVariableAttrs = form.attributes.some((a) => a.variation && a.options.length > 0);

  const duplicateCombos = (() => {
    if (productMode !== "variable") return [] as number[];
    const seen = new Map<string, number>();
    const dupes: number[] = [];
    form.variations.forEach((v, idx) => {
      if (v.enabled === false) return;
      const key = variationAttributeComboKey(v);
      if (seen.has(key)) dupes.push(idx);
      else seen.set(key, idx);
    });
    return dupes;
  })();

  const removeDuplicateVariations = () => {
    const n = duplicateCombos.length;
    if (n === 0) return;
    if (
      !window.confirm(
        `Remove ${n} duplicate row${n === 1 ? "" : "s"}, keeping the first occurrence of each option combination? Variations removed here will be deleted in WooCommerce when you save.`,
      )
    ) {
      return;
    }
    setForm((p) => {
      const seen = new Map<string, number>();
      const removeIdx = new Set<number>();
      p.variations.forEach((v, idx) => {
        if (v.enabled === false) return;
        const key = variationAttributeComboKey(v);
        if (seen.has(key)) removeIdx.add(idx);
        else seen.set(key, idx);
      });
      if (removeIdx.size === 0) return p;
      const removedIds = p.variations.filter((v, i) => removeIdx.has(i) && v.id).map((v) => v.id!) as number[];
      return {
        ...p,
        variations: p.variations.filter((_, i) => !removeIdx.has(i)),
        deletedVariationIds: [...(p.deletedVariationIds || []), ...removedIds],
      };
    });
  };

  const missingPriceCount = productMode === "variable"
    ? form.variations.filter((v) => v.enabled !== false && (!v.regular_price || Number(v.regular_price) <= 0)).length
    : 0;

  return (
    <div className="space-y-5">
      <div className="text-sm font-medium text-primary">Attributes</div>
      <AttributeEditor storeId={storeId} form={form} setForm={setForm} productMode={productMode} />

      {productMode === "variable" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-primary">Variations</div>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {loadedFromWoo && !loading && form.variations.length > 0 && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted rounded-full px-2 py-0.5">Live from WooCommerce</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {productId && (
                <Button type="button" variant="ghost" size="sm" onClick={() => loadVariations(true)} disabled={loading} className="gap-1.5">
                  <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                  Refresh
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={regenerate} disabled={!hasVariableAttrs}>Regenerate from attributes</Button>
            </div>
          </div>

          {(duplicateCombos.length > 0 || missingPriceCount > 0) && !loading && form.variations.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs space-y-1">
              {missingPriceCount > 0 && (
                <div className="text-destructive">{missingPriceCount} variation{missingPriceCount === 1 ? "" : "s"} missing price — must be greater than 0 to publish.</div>
              )}
              {duplicateCombos.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="text-destructive min-w-0">
                    Duplicate attribute combinations detected at row{duplicateCombos.length === 1 ? "" : "s"} {duplicateCombos.map((i) => i + 1).join(", ")}. Remove the extra rows before saving (auto-fill SKUs stays disabled until resolved).
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={removeDuplicateVariations}
                  >
                    Remove duplicate rows ({duplicateCombos.length})
                  </Button>
                </div>
              )}
            </div>
          )}

          {loading && form.variations.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-6 flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <div>
                <div className="font-medium text-foreground">Loading variations from WooCommerce…</div>
                <div className="text-xs mt-0.5">Fetching on-demand since background sync hasn&apos;t reached this product yet.</div>
              </div>
            </div>
          ) : !hasVariableAttrs ? (
            <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">Tick &quot;Use for variations&quot; on at least one attribute with values, then regenerate.</div>
          ) : form.variations.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>Click &quot;Regenerate from attributes&quot; to create variations based on the options above.</div>
            </div>
          ) : (
            <VariationsTable
              variations={form.variations}
              parentSku={form.sku}
              parentName={form.name}
              defaultAttrs={form.default_attributes}
              onSetDefault={setDefaultVariation}
              onEdit={setEditIdx}
              onUpdate={updateVariation}
              onBulk={applyBulk}
              onBulkDelete={bulkDelete}
              duplicateRowCount={duplicateCombos.length}
            />
          )}
        </div>
      )}

      {editIdx !== null && form.variations[editIdx] && (
        <VariationEditDialog
          storeId={storeId}
          open={editIdx !== null}
          onOpenChange={(o) => { if (!o) setEditIdx(null); }}
          variation={form.variations[editIdx]}
          hasNext={editIdx < form.variations.length - 1}
          onSaveAndNext={() => setEditIdx((i) => (i !== null && i < form.variations.length - 1 ? i + 1 : null))}
          onUpdate={(patch) => updateVariation(editIdx, patch)}
          onRemove={() => removeVariation(editIdx)}
          isDefault={variationMatchesDefault(form.variations[editIdx], form.default_attributes)}
          onToggleDefault={() => setDefaultVariation(editIdx)}
        />
      )}
    </div>
  );
}