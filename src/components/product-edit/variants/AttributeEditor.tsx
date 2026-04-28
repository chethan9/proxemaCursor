import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Trash2, Plus, Loader2, Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductFormState } from "@/services/productEditService";
import {
  useWooAttributes,
  useCreateWooAttribute,
  useWooAttributeTerms,
} from "@/hooks/queries/useWooAttributes";
import type { WooAttribute } from "@/services/wooAttributeService";

type Props = {
  storeId: string;
  form: ProductFormState;
  setForm: (u: (p: ProductFormState) => ProductFormState) => void;
  productMode: "simple" | "variable";
  onPromoteToVariable?: () => void;
};

function AttributeNameCombobox({
  wooAttributes,
  onSelectExisting,
  onCreateNew,
  isPending,
  excludeIds,
}: {
  wooAttributes: WooAttribute[];
  onSelectExisting: (attr: WooAttribute) => void;
  onCreateNew: (name: string) => void;
  isPending: boolean;
  excludeIds: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const available = wooAttributes.filter((a) => !excludeIds.has(a.id));
  const exact = wooAttributes.find((a) => a.name.toLowerCase() === search.trim().toLowerCase());
  const showCreate = !!search.trim() && !exact;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between h-9 font-normal text-muted-foreground"
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
            </span>
          ) : (
            <>
              <span className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" />
                Add attribute
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] shadow-lg"
        align="start"
        sideOffset={4}
      >
        <Command className="rounded-md">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search or type new name…"
            className="h-9 text-sm"
          />
          <CommandList className="max-h-64">
            <CommandEmpty className="py-2">
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew(search.trim());
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="flex-1 truncate">
                    Create <strong>&ldquo;{search.trim()}&rdquo;</strong>
                  </span>
                  <span className="text-[10px] uppercase tracking-wide bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5">new</span>
                </button>
              ) : (
                <span className="px-3 py-2 text-xs text-muted-foreground block text-center">No global attributes yet.</span>
              )}
            </CommandEmpty>
            {available.length > 0 && (
              <CommandGroup heading="Existing global attributes" className="px-1 py-1">
                {available.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={a.name}
                    onSelect={() => {
                      onSelectExisting(a);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="text-sm py-1.5"
                  >
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">global</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreate && (
              <CommandGroup className="px-1 py-1 border-t">
                <CommandItem
                  value={`__create__${search}`}
                  onSelect={() => {
                    onCreateNew(search.trim());
                    setOpen(false);
                    setSearch("");
                  }}
                  className="text-sm py-1.5"
                >
                  <Plus className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                  <span className="flex-1 truncate">
                    Create <strong>&ldquo;{search.trim()}&rdquo;</strong>
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5">new</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TermSuggestions({
  storeId,
  attributeId,
  currentOptions,
  onAdd,
}: {
  storeId: string;
  attributeId: number;
  currentOptions: string[];
  onAdd: (name: string) => void;
}) {
  const { data: terms = [], isLoading } = useWooAttributeTerms(storeId, attributeId);
  const currentLower = new Set(currentOptions.map((o) => o.toLowerCase().trim()));
  const suggestions = terms.filter((t) => !currentLower.has(t.name.toLowerCase().trim()));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading existing terms…
      </div>
    );
  }
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-1.5 mt-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Existing terms (click to add)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onAdd(t.name)}
            className="text-xs px-2.5 py-1 rounded-full border border-dashed border-border hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <Plus className="inline h-2.5 w-2.5 mr-1" />
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionRow({
  storeId,
  attributeId,
  value,
  onChange,
  onRemove,
  termNames,
}: {
  storeId: string;
  attributeId?: number;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  termNames: Set<string>;
}) {
  const isNew = !!attributeId && attributeId > 0 && value.trim() && !termNames.has(value.toLowerCase().trim());
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="pr-14" />
        {isNew && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5">new</span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="h-9 w-9 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AttributeEditor({ storeId, form, setForm, productMode, onPromoteToVariable }: Props) {
  const [editingAttr, setEditingAttr] = useState<number | null>(null);
  const [newValueInput, setNewValueInput] = useState<Record<number, string>>({});
  const { data: wooAttributes = [] } = useWooAttributes(storeId);
  const createWooAttribute = useCreateWooAttribute(storeId);

  const usedAttrIds = new Set(
    form.attributes.map((a) => a.id).filter((x): x is number => typeof x === "number" && x > 0)
  );

  const addExistingAttribute = (attr: WooAttribute) => {
    if (form.attributes.find((a) => a.id === attr.id)) return;
    const newIndex = form.attributes.length;
    setForm((p) => ({
      ...p,
      attributes: [
        ...p.attributes,
        { id: attr.id, name: attr.name, options: [], visible: true, variation: productMode === "variable" },
      ],
    }));
    setEditingAttr(newIndex);
  };

  const addNewAttribute = async (name: string) => {
    const t = name.trim();
    if (!t) return;
    const existing = wooAttributes.find((a) => a.name.toLowerCase() === t.toLowerCase());
    if (existing) {
      addExistingAttribute(existing);
      return;
    }
    const created = await createWooAttribute.mutateAsync({ name: t });
    const newIndex = form.attributes.length;
    setForm((p) => ({
      ...p,
      attributes: [
        ...p.attributes,
        { id: created.id, name: created.name, options: [], visible: true, variation: productMode === "variable" },
      ],
    }));
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

  const removeValueAt = (i: number, optIdx: number) => {
    setForm((p) => {
      const attrs = [...p.attributes];
      attrs[i] = { ...attrs[i], options: attrs[i].options.filter((_, k) => k !== optIdx) };
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
        return (
          <Card key={idx} className="border-l-4 border-l-primary/60">
            <CardContent className="p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Attribute name</Label>
                    <Input
                      value={attr.name}
                      onChange={(e) =>
                        setForm((p) => {
                          const a = [...p.attributes];
                          a[idx] = { ...a[idx], name: e.target.value };
                          return { ...p, attributes: a };
                        })
                      }
                      disabled={!!attr.id && attr.id > 0}
                    />
                    {!!attr.id && attr.id > 0 && (
                      <p className="text-[11px] text-muted-foreground">Linked to global attribute — name controlled by store taxonomy.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Values</Label>
                    <AttrValuesEditor
                      storeId={storeId}
                      attribute={attr}
                      onChangeOption={(optIdx, v) =>
                        setForm((p) => {
                          const attrs = [...p.attributes];
                          const opts = [...attrs[idx].options];
                          opts[optIdx] = v;
                          attrs[idx] = { ...attrs[idx], options: opts };
                          return { ...p, attributes: attrs };
                        })
                      }
                      onRemoveOption={(optIdx) => removeValueAt(idx, optIdx)}
                      onAddOption={(v) => addValue(idx, v)}
                      newInputValue={newValueInput[idx] || ""}
                      onNewInputChange={(v) => setNewValueInput((s) => ({ ...s, [idx]: v }))}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={attr.variation}
                      onCheckedChange={(v) => {
                        const checked = !!v;
                        setForm((p) => {
                          const a = [...p.attributes];
                          a[idx] = { ...a[idx], variation: checked };
                          const anyVariation = a.some((x) => x.variation);
                          const nextType = anyVariation
                            ? "variable"
                            : p.type === "variable"
                            ? "simple"
                            : p.type;
                          return { ...p, attributes: a, type: nextType };
                        });
                        if (checked && productMode === "simple" && onPromoteToVariable) onPromoteToVariable();
                      }}
                    />
                    Use for variations
                  </label>
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => deleteAttribute(idx)}
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                    >
                      Delete
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setEditingAttr(null)}
                      className="bg-foreground text-background hover:bg-foreground/90"
                    >
                      Save Attribute
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                      <Checkbox
                        checked={attr.visible}
                        onCheckedChange={(v) =>
                          setForm((p) => {
                            const a = [...p.attributes];
                            a[idx] = { ...a[idx], visible: !!v };
                            return { ...p, attributes: a };
                          })
                        }
                      />
                      <span className="font-medium text-sm">{attr.name}</span>
                      {!!attr.id && attr.id > 0 && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5">global</span>
                      )}
                      {attr.variation && (
                        <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5">variation</span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {attr.options.map((opt) => (
                        <div
                          key={opt}
                          className="text-xs px-2.5 py-1 rounded border border-border"
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingAttr(idx)}>
                    Edit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <AttributeNameCombobox
        wooAttributes={wooAttributes}
        excludeIds={usedAttrIds}
        onSelectExisting={addExistingAttribute}
        onCreateNew={(name) => void addNewAttribute(name)}
        isPending={createWooAttribute.isPending}
      />
    </div>
  );
}

function AttrValuesEditor({
  storeId,
  attribute,
  onChangeOption,
  onRemoveOption,
  onAddOption,
  newInputValue,
  onNewInputChange,
}: {
  storeId: string;
  attribute: ProductFormState["attributes"][number];
  onChangeOption: (optIdx: number, v: string) => void;
  onRemoveOption: (optIdx: number) => void;
  onAddOption: (v: string) => void;
  newInputValue: string;
  onNewInputChange: (v: string) => void;
}) {
  const isGlobal = !!attribute.id && attribute.id > 0;
  const { data: terms = [] } = useWooAttributeTerms(storeId, isGlobal ? attribute.id! : null);
  const termNames = new Set(terms.map((t) => t.name.toLowerCase().trim()));

  return (
    <div className="space-y-1.5">
      {attribute.options.map((opt, optIdx) => (
        <OptionRow
          key={`${optIdx}-${opt}`}
          storeId={storeId}
          attributeId={attribute.id}
          value={opt}
          onChange={(v) => onChangeOption(optIdx, v)}
          onRemove={() => onRemoveOption(optIdx)}
          termNames={termNames}
        />
      ))}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add new option"
          value={newInputValue}
          onChange={(e) => onNewInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddOption(newInputValue);
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => onAddOption(newInputValue)}>
          Add
        </Button>
      </div>
      {isGlobal && (
        <TermSuggestions
          storeId={storeId}
          attributeId={attribute.id!}
          currentOptions={attribute.options}
          onAdd={onAddOption}
        />
      )}
    </div>
  );
}