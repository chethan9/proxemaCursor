import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, X, Loader2, ImageIcon, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductFormState, ProductAttribute, Variation } from "@/services/productEditService";
import { useWooAttributes, useCreateWooAttribute } from "@/hooks/queries/useWooAttributes";
import { ImagePickerDialog } from "@/components/product-edit/ImagePickerDialog";

type Props = {
  storeId: string;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
};

function generateMatrix(attrs: ProductAttribute[]): Variation[] {
  const forVar = attrs.filter((a) => a.variation && a.options.length > 0);
  if (forVar.length === 0) return [];
  const combos: string[][] = [[]];
  for (const a of forVar) {
    const next: string[][] = [];
    for (const combo of combos) {
      for (const opt of a.options) next.push([...combo, opt]);
    }
    combos.splice(0, combos.length, ...next);
  }
  return combos.map((combo) => ({
    key: combo.join("|"),
    attributes: forVar.map((a, i) => ({ name: a.name, option: combo[i] })),
    regular_price: "",
    sale_price: "",
    sku: "",
    stock_quantity: null,
    stock_status: "instock",
    manage_stock: false,
    weight: "",
    dimensions: { length: "", width: "", height: "" },
    description: "",
    image: null,
  }));
}

export function VariantsTab({ storeId, form, setForm }: Props) {
  const [productMode, setProductMode] = useState<"simple" | "variable">(form.type === "variable" ? "variable" : "simple");
  const [editingAttr, setEditingAttr] = useState<number | null>(null);
  const [newAttrName, setNewAttrName] = useState("");
  const [newValueInput, setNewValueInput] = useState<Record<number, string>>({});
  const [editVariationIdx, setEditVariationIdx] = useState<number | null>(null);

  const { data: wooAttributes = [] } = useWooAttributes(storeId);
  const createWooAttribute = useCreateWooAttribute(storeId);

  const setMode = (m: "simple" | "variable") => {
    setProductMode(m);
    setForm((p) => ({ ...p, type: m === "variable" ? "variable" : "simple" }));
  };

  const addAttribute = async (name: string) => {
    const t = name.trim();
    if (!t) return;
    const existing = wooAttributes.find((a) => a.name.toLowerCase() === t.toLowerCase());
    let attrId = existing?.id;
    if (!existing) {
      const created = await createWooAttribute.mutateAsync({ name: t });
      attrId = created.id;
    }
    const alreadyOnProduct = form.attributes.find((a) => a.id === attrId);
    if (alreadyOnProduct) return;
    setForm((p) => ({
      ...p,
      attributes: [...p.attributes, { id: attrId, name: t, options: [], visible: true, variation: productMode === "variable" }],
    }));
    setNewAttrName("");
    setEditingAttr(p => p);
    setEditingAttr(form.attributes.length);
  };

  const addValue = (attrIdx: number, value: string) => {
    const t = value.trim();
    if (!t) return;
    setForm((p) => {
      const attrs = [...p.attributes];
      if (attrs[attrIdx].options.includes(t)) return p;
      attrs[attrIdx] = { ...attrs[attrIdx], options: [...attrs[attrIdx].options, t] };
      return { ...p, attributes: attrs };
    });
    setNewValueInput((s) => ({ ...s, [attrIdx]: "" }));
  };

  const removeValue = (attrIdx: number, value: string) => {
    setForm((p) => {
      const attrs = [...p.attributes];
      attrs[attrIdx] = { ...attrs[attrIdx], options: attrs[attrIdx].options.filter((v) => v !== value) };
      return { ...p, attributes: attrs };
    });
  };

  const deleteAttribute = (attrIdx: number) => {
    setForm((p) => ({ ...p, attributes: p.attributes.filter((_, i) => i !== attrIdx) }));
    setEditingAttr(null);
  };

  const regenerateVariations = () => {
    const fresh = generateMatrix(form.attributes);
    setForm((p) => {
      const existingMap = new Map(p.variations.map((v) => [v.key, v]));
      const merged = fresh.map((v) => existingMap.get(v.key) || v);
      return { ...p, variations: merged };
    });
  };

  const updateVariation = (idx: number, patch: Partial<Variation>) => {
    setForm((p) => {
      const vs = [...p.variations];
      vs[idx] = { ...vs[idx], ...patch };
      return { ...p, variations: vs };
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-0 rounded-full bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => setMode("simple")}
          className={cn("py-2 text-sm rounded-full transition-colors", productMode === "simple" ? "bg-foreground text-background font-medium" : "text-muted-foreground")}
        >
          Simple Product
        </button>
        <button
          type="button"
          onClick={() => setMode("variable")}
          className={cn("py-2 text-sm rounded-full transition-colors", productMode === "variable" ? "bg-foreground text-background font-medium" : "text-muted-foreground")}
        >
          Variable Product
        </button>
      </div>

      {productMode === "simple" && (
        <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
          Simple product — no variations needed. Optionally add non-varying attributes (e.g. Material) for display on the product page.
        </div>
      )}

      <div className="text-sm font-medium text-primary">Attributes</div>
      <div className="space-y-3">
        {form.attributes.map((attr, idx) => {
          const isEditing = editingAttr === idx;
          return (
            <Card key={idx} className="border-l-4 border-l-primary/60">
              <CardContent className="p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Attribute name</Label>
                      <Input value={attr.name} onChange={(e) => setForm((p) => { const a = [...p.attributes]; a[idx] = { ...a[idx], name: e.target.value }; return { ...p, attributes: a }; })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Values</Label>
                      <div className="space-y-1.5">
                        {attr.options.map((opt) => (
                          <div key={opt} className="flex items-center gap-2">
                            <Input value={opt} readOnly className="flex-1" />
                            <button type="button" onClick={() => removeValue(idx, opt)} className="h-9 w-9 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Add new option"
                            value={newValueInput[idx] || ""}
                            onChange={(e) => setNewValueInput((s) => ({ ...s, [idx]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addValue(idx, newValueInput[idx] || ""); } }}
                          />
                          <Button type="button" variant="outline" onClick={() => addValue(idx, newValueInput[idx] || "")}>Add</Button>
                        </div>
                      </div>
                    </div>
                    {productMode === "variable" && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={attr.variation} onCheckedChange={(v) => setForm((p) => { const a = [...p.attributes]; a[idx] = { ...a[idx], variation: !!v }; return { ...p, attributes: a }; })} />
                        Use for variations
                      </label>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <Button type="button" variant="outline" onClick={() => deleteAttribute(idx)} className="text-destructive border-destructive/30 hover:bg-destructive/5">Delete</Button>
                      <Button type="button" onClick={() => setEditingAttr(null)} className="bg-foreground text-background hover:bg-foreground/90">Save Attribute</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <Checkbox checked={attr.visible} onCheckedChange={(v) => setForm((p) => { const a = [...p.attributes]; a[idx] = { ...a[idx], visible: !!v }; return { ...p, attributes: a }; })} />
                        <span className="font-medium text-sm">{attr.name}</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {attr.options.map((opt) => (
                          <div key={opt} className="text-xs px-2.5 py-1 rounded border border-border">{opt}</div>
                        ))}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingAttr(idx)}>Edit</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <div className="flex items-center gap-2">
          <Input list="attr-options" value={newAttrName} onChange={(e) => setNewAttrName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAttribute(newAttrName); } }} placeholder="+ Add new attribute (type name and press Enter)" />
          <datalist id="attr-options">{wooAttributes.map((a) => <option key={a.id} value={a.name} />)}</datalist>
          <Button type="button" variant="outline" onClick={() => addAttribute(newAttrName)} disabled={!newAttrName.trim() || createWooAttribute.isPending}>
            {createWooAttribute.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {productMode === "variable" && form.attributes.some((a) => a.variation && a.options.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-primary">Variations</div>
            <Button type="button" variant="outline" size="sm" onClick={regenerateVariations}>Regenerate from attributes</Button>
          </div>
          {form.variations.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">Click "Regenerate from attributes" to create variations based on the options above.</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="grid grid-cols-[1fr_120px_110px_90px_60px] gap-0 text-xs text-muted-foreground px-4 py-2 border-b bg-muted/30">
                  <div>Options</div>
                  <div>SKU</div>
                  <div>Price</div>
                  <div>Stock</div>
                  <div></div>
                </div>
                {form.variations.map((v, i) => (
                  <div key={v.key} className="grid grid-cols-[1fr_120px_110px_90px_60px] gap-0 items-center px-4 py-2 border-b last:border-b-0 text-sm">
                    <div className="truncate">{v.attributes.map((a) => a.option).join(" / ")}</div>
                    <Input className="h-8" value={v.sku} onChange={(e) => updateVariation(i, { sku: e.target.value })} placeholder="—" />
                    <Input className="h-8" value={v.regular_price} onChange={(e) => updateVariation(i, { regular_price: e.target.value })} placeholder="0.00" />
                    <Input className="h-8" type="number" value={v.stock_quantity ?? ""} onChange={(e) => updateVariation(i, { stock_quantity: e.target.value ? Number(e.target.value) : null, manage_stock: true })} placeholder="—" />
                    <button type="button" onClick={() => setEditVariationIdx(i)} className="h-8 w-8 rounded hover:bg-muted flex items-center justify-center text-muted-foreground">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {editVariationIdx !== null && form.variations[editVariationIdx] && (
        <VariationDetailDialog
          storeId={storeId}
          variation={form.variations[editVariationIdx]}
          index={editVariationIdx}
          total={form.variations.length}
          onClose={() => setEditVariationIdx(null)}
          onSaveNext={() => setEditVariationIdx((i) => (i !== null && i < form.variations.length - 1 ? i + 1 : null))}
          onUpdate={(patch) => updateVariation(editVariationIdx, patch)}
          onRemove={() => {
            setForm((p) => ({ ...p, variations: p.variations.filter((_, i) => i !== editVariationIdx) }));
            setEditVariationIdx(null);
          }}
        />
      )}
    </div>
  );
}

function VariationDetailDialog({ storeId, variation, index, total, onClose, onSaveNext, onUpdate, onRemove }: {
  storeId: string;
  variation: Variation;
  index: number;
  total: number;
  onClose: () => void;
  onSaveNext: () => void;
  onUpdate: (patch: Partial<Variation>) => void;
  onRemove: () => void;
}) {
  const [imageOpen, setImageOpen] = useState(false);
  const label = variation.attributes.map((a) => a.option).join(" / ");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b">
          <DialogTitle>Edit {label}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Regular Price</Label>
                <Input type="number" step="0.01" value={variation.regular_price} onChange={(e) => onUpdate({ regular_price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Offer Price</Label>
                <Input type="number" step="0.01" value={variation.sale_price} onChange={(e) => onUpdate({ sale_price: e.target.value })} />
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Variation Image</Label>
                <button type="button" onClick={() => setImageOpen(true)} className="h-24 w-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                  {variation.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={variation.image.src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Inventory</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">SKU</span>
                  <Input value={variation.sku} onChange={(e) => onUpdate({ sku: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Quantity</span>
                  <Input type="number" value={variation.stock_quantity ?? ""} onChange={(e) => onUpdate({ stock_quantity: e.target.value ? Number(e.target.value) : null, manage_stock: true })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Stock Status</span>
                  <select className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm" value={variation.stock_status} onChange={(e) => onUpdate({ stock_status: e.target.value as Variation["stock_status"] })}>
                    <option value="instock">In Stock</option>
                    <option value="outofstock">Out Of Stock</option>
                    <option value="onbackorder">On Backorder</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">Shipping</Label>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Weight (kg)</span>
                  <Input value={variation.weight} onChange={(e) => onUpdate({ weight: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Length</span>
                  <Input value={variation.dimensions.length} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, length: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Width</span>
                  <Input value={variation.dimensions.width} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, width: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Height</span>
                  <Input value={variation.dimensions.height} onChange={(e) => onUpdate({ dimensions: { ...variation.dimensions, height: e.target.value } })} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea rows={3} value={variation.description} onChange={(e) => onUpdate({ description: e.target.value })} />
            </div>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between gap-2 p-4 border-t bg-muted/30">
          <Button variant="ghost" className="text-destructive" onClick={onRemove}>Remove</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {index < total - 1 && <Button variant="outline" onClick={onSaveNext}>Save & Edit Next</Button>}
            <Button className="bg-foreground text-background hover:bg-foreground/90" onClick={onClose}>Save Changes</Button>
          </div>
        </div>
        {imageOpen && (
          <ImagePickerDialog
            storeId={storeId}
            open={imageOpen}
            onOpenChange={setImageOpen}
            mode="single"
            onConfirm={(items) => {
              const [first] = items;
              if (first) onUpdate({ image: { id: first.id, src: first.src, alt: first.alt } });
              setImageOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}