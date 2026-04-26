import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Loader2, Search, X } from "lucide-react";
import { ProductFormState } from "@/services/productEditService";
import { useWooAttributes, useCreateWooAttribute, useWooAttributeTerms } from "@/hooks/queries/useWooAttributes";
import { cn } from "@/lib/utils";

type Props = {
  storeId: string;
  form: ProductFormState;
  setForm: (u: (p: ProductFormState) => ProductFormState) => void;
  productMode: "simple" | "variable";
  onPromoteToVariable?: () => void;
};

function AttributeValueChips({
  storeId,
  attrId,
  attrIdx,
  currentOptions,
  onAdd,
}: {
  storeId: string;
  attrId: number | null;
  attrIdx: number;
  currentOptions: string[];
  onAdd: (value: string) => void;
}) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: terms = [], isLoading } = useWooAttributeTerms(storeId, attrId);

  const selectedSet = useMemo(
    () => new Set(currentOptions.map((o) => o.toLowerCase())),
    [currentOptions]
  );

  const sorted = useMemo(
    () => [...terms].sort((a, b) => (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name)),
    [terms]
  );

  const topTen = sorted.slice(0, 10);
  const remaining = Math.max(0, sorted.length - 10);

  const filteredDialog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => t.name.toLowerCase().includes(q));
  }, [sorted, search]);

  if (!attrId || attrId <= 0) return null;
  if (sorted.length === 0 && !isLoading) return null;

  return (
    <div className="space-y-2">
      <Label className="text-[11px] text-muted-foreground">Suggested values</Label>
      <div className="flex flex-wrap gap-1.5">
        {topTen.map((term) => {
          const picked = selectedSet.has(term.name.toLowerCase());
          return (
            <button
              key={term.id}
              type="button"
              disabled={picked}
              onClick={() => onAdd(term.name)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors",
                picked
                  ? "bg-muted text-muted-foreground border-border opacity-60"
                  : "bg-background hover:bg-muted border-border"
              )}
            >
              <Plus className="h-3 w-3" />
              {term.name}
            </button>
          );
        })}
        {remaining > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full gap-1"
            onClick={() => setBrowseOpen(true)}
          >
            +{remaining} more
          </Button>
        )}
      </div>

      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Browse attribute values</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search values…"
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto -mx-1 px-1">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              ) : filteredDialog.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No values match &quot;{search}&quot;
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {filteredDialog.map((term) => {
                    const picked = selectedSet.has(term.name.toLowerCase());
                    return (
                      <button
                        key={term.id}
                        type="button"
                        disabled={picked}
                        onClick={() => onAdd(term.name)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors",
                          picked
                            ? "bg-muted text-muted-foreground border-border opacity-60"
                            : "bg-background hover:bg-muted border-border"
                        )}
                      >
                        {picked ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {term.name}
                        {typeof term.count === "number" && term.count > 0 && (
                          <span className="text-[10px] opacity-60">({term.count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setBrowseOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* reference unused attrIdx to keep linter happy if needed */}
      <input type="hidden" value={attrIdx} />
    </div>
  );
}

export function AttributeEditor({ storeId, form, setForm, productMode, onPromoteToVariable }: Props) {
  const [editingAttr, setEditingAttr] = useState<number | null>(null);
  const [newAttrName, setNewAttrName] = useState("");
  const [newValueInput, setNewValueInput] = useState<Record<number, string>>({});
  const { data: wooAttributes = [] } = useWooAttributes(storeId);
  const createWooAttribute = useCreateWooAttribute(storeId);

  const addAttribute = async (name: string) => {
    const t = name.trim();
    if (!t) return;
    const existing = wooAttributes.find((a) => a.name.toLowerCase() === t.toLowerCase());
    let attrId = existing?.id;
    if (!existing) {
      const created = await createWooAttribute.mutateAsync({ name: t });
      attrId = created.id;
    }
    if (form.attributes.find((a) => a.id === attrId)) return;
    const newIndex = form.attributes.length;
    setForm((p) => ({
      ...p,
      attributes: [...p.attributes, { id: attrId, name: t, options: [], visible: true, variation: productMode === "variable" }],
    }));
    setNewAttrName("");
    setEditingAttr(newIndex);
  };

  const addValue = (i: number, v: string) => {
    const t = v.trim();
    if (!t) return;
    setForm((p) => {
      const attrs = [...p.attributes];
      if (attrs[i].options.some((x) => x.toLowerCase() === t.toLowerCase())) return p;
      attrs[i] = { ...attrs[i], options: [...attrs[i].options, t] };
      return { ...p, attributes: attrs };
    });
    setNewValueInput((s) => ({ ...s, [i]: "" }));
  };

  const removeValue = (i: number, v: string) => {
    setForm((p) => {
      const attrs = [...p.attributes];
      attrs[i] = { ...attrs[i], options: attrs[i].options.filter((x) => x !== v) };
      return { ...p, attributes: attrs };
    });
  };

  const deleteAttribute = (i: number) => {
    setForm((p) => ({ ...p, attributes: p.attributes.filter((_, idx) => idx !== i) }));
    setEditingAttr(null);
  };

  return (
    <div className="space-y-3">
      {form.attributes.map((attr, idx) => {
        const isEditing = editingAttr === idx;
        const matchedGlobal = wooAttributes.find((a) => a.name.toLowerCase() === attr.name.toLowerCase());
        const globalAttrId = matchedGlobal?.id ?? (attr.id && attr.id > 0 ? attr.id : null);
        return (
          <Card key={idx} className="border-l-4 border-l-primary/60">
            <CardContent className="p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs" required>Attribute name</Label>
                    <Input value={attr.name} onChange={(e) => setForm((p) => { const a = [...p.attributes]; a[idx] = { ...a[idx], name: e.target.value }; return { ...p, attributes: a }; })} />
                  </div>

                  {globalAttrId && (
                    <AttributeValueChips
                      storeId={storeId}
                      attrId={globalAttrId}
                      attrIdx={idx}
                      currentOptions={attr.options}
                      onAdd={(v) => addValue(idx, v)}
                    />
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs" required>Values</Label>
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
                  {(productMode === "variable" || onPromoteToVariable) && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={attr.variation} onCheckedChange={(v) => {
                        const checked = !!v;
                        setForm((p) => { const a = [...p.attributes]; a[idx] = { ...a[idx], variation: checked }; return { ...p, attributes: a }; });
                        if (checked && productMode === "simple" && onPromoteToVariable) onPromoteToVariable();
                      }} />
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
                      {attr.variation && <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5">variation</span>}
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
  );
}