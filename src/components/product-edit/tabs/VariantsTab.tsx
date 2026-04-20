import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductFormState, Variation } from "@/services/productEditService";
import { AttributeEditor } from "@/components/product-edit/variants/AttributeEditor";
import { VariationsTable } from "@/components/product-edit/variants/VariationsTable";
import { VariationEditDialog } from "@/components/product-edit/variants/VariationEditDialog";
import { generateMatrix, mergeVariations } from "@/components/product-edit/variants/utils";

type Props = {
  storeId: string;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
};

export function VariantsTab({ storeId, form, setForm }: Props) {
  const [productMode, setProductMode] = useState<"simple" | "variable">(form.type === "variable" ? "variable" : "simple");
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const setMode = (m: "simple" | "variable") => {
    setProductMode(m);
    setForm((p) => ({ ...p, type: m === "variable" ? "variable" : "simple" }));
  };

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
      return {
        ...p,
        variations: p.variations.filter((_, i) => i !== idx),
        deletedVariationIds: deleted,
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

  const hasVariableAttrs = form.attributes.some((a) => a.variation && a.options.length > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-0 rounded-full bg-muted/50 p-1">
        <button type="button" onClick={() => setMode("simple")} className={cn("py-2 text-sm rounded-full transition-colors", productMode === "simple" ? "bg-foreground text-background font-medium" : "text-muted-foreground")}>Simple Product</button>
        <button type="button" onClick={() => setMode("variable")} className={cn("py-2 text-sm rounded-full transition-colors", productMode === "variable" ? "bg-foreground text-background font-medium" : "text-muted-foreground")}>Variable Product</button>
      </div>

      {productMode === "simple" && (
        <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
          Simple product — no variations needed. Optionally add non-varying attributes (e.g. Material) for display on the product page.
        </div>
      )}

      <div className="text-sm font-medium text-primary">Attributes</div>
      <AttributeEditor storeId={storeId} form={form} setForm={setForm} productMode={productMode} />

      {productMode === "variable" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-primary">Variations</div>
            <Button type="button" variant="outline" size="sm" onClick={regenerate} disabled={!hasVariableAttrs}>Regenerate from attributes</Button>
          </div>
          {!hasVariableAttrs ? (
            <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">Tick "Use for variations" on at least one attribute with values, then regenerate.</div>
          ) : form.variations.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">Click "Regenerate from attributes" to create variations based on the options above.</div>
          ) : (
            <VariationsTable variations={form.variations} onEdit={setEditIdx} onUpdate={updateVariation} onBulk={applyBulk} />
          )}
        </div>
      )}

      {editIdx !== null && form.variations[editIdx] && (
        <VariationEditDialog
          storeId={storeId}
          variation={form.variations[editIdx]}
          index={editIdx}
          total={form.variations.length}
          onClose={() => setEditIdx(null)}
          onSaveNext={() => setEditIdx((i) => (i !== null && i < form.variations.length - 1 ? i + 1 : null))}
          onUpdate={(patch) => updateVariation(editIdx, patch)}
          onRemove={() => removeVariation(editIdx)}
        />
      )}
    </div>
  );
}