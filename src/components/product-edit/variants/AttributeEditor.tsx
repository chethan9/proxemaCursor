import { useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Plus, Loader2, ChevronsUpDown, Sparkles, Search, GripVertical, ChevronRight } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  /** When true, switching simple ↔ variable via attributes shows a confirmation (existing products only). */
  isEdit?: boolean;
};

function applyVariationCheckboxChange(p: ProductFormState, idx: number, checked: boolean): ProductFormState {
  const a = [...p.attributes];
  a[idx] = {
    ...a[idx],
    variation: checked,
  };
  const anyVariation = a.some((x) => x.variation);
  /** Stay variable until the user explicitly switches product type — avoids losing the Variants tab when all rows are cleared. */
  const nextType = anyVariation ? "variable" : p.type === "variable" ? "variable" : p.type;
  return { ...p, attributes: a, type: nextType };
}

function isSimpleVariableTransition(prev: ProductFormState["type"], next: ProductFormState["type"]) {
  return (
    (prev === "simple" && next === "variable") ||
    (prev === "variable" && next === "simple")
  );
}

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
  const q = search.trim().toLowerCase();
  const filtered = q ? available.filter((a) => a.name.toLowerCase().includes(q)) : available;
  const exact = wooAttributes.find((a) => a.name.toLowerCase() === q);
  const showCreate = !!q && !exact;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
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
        className="p-0 w-[var(--radix-popover-trigger-width)] shadow-lg overflow-hidden"
        align="start"
        sideOffset={4}
      >
        <div className="relative border-b">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or type new name…"
            className="w-full h-9 pl-8 pr-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 && !showCreate && (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              No global attributes yet.
            </div>
          )}
          {filtered.length > 0 && (
            <div className="px-1">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Existing global attributes</div>
              {filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onSelectExisting(a); setOpen(false); setSearch(""); }}
                  className="flex items-center w-full text-sm py-1.5 px-2 rounded-sm hover:bg-accent text-left"
                >
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">global</span>
                </button>
              ))}
            </div>
          )}
          {showCreate && (
            <div className={cn("px-1", filtered.length > 0 && "border-t mt-1 pt-1")}>
              <button
                type="button"
                onClick={() => { onCreateNew(q); setOpen(false); setSearch(""); }}
                className="flex items-center w-full text-sm py-1.5 px-2 rounded-sm hover:bg-accent text-left"
              >
                <Plus className="mr-2 h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="flex-1 truncate">
                  Create <strong>&ldquo;{search.trim()}&rdquo;</strong>
                </span>
                <span className="ml-2 text-[10px] uppercase tracking-wide bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5">new</span>
              </button>
            </div>
          )}
        </div>
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
  dragHandle,
}: {
  storeId: string;
  attributeId?: number;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  termNames: Set<string>;
  dragHandle?: ReactNode;
}) {
  const isNew = !!attributeId && attributeId > 0 && value.trim() && !termNames.has(value.toLowerCase().trim());
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      {dragHandle}
      <div className="relative flex-1 min-w-0">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="pr-14" />
        {isNew && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5">new</span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="h-9 w-9 shrink-0 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SortableOptionRow({
  id,
  storeId,
  attributeId,
  value,
  onChange,
  onRemove,
  termNames,
}: {
  id: string;
  storeId: string;
  attributeId?: number;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  termNames: Set<string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : undefined,
  };
  const handle = (
    <button
      type="button"
      className="h-9 w-9 shrink-0 rounded-md border border-transparent flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
      aria-label="Reorder value"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className="w-full">
      <OptionRow
        storeId={storeId}
        attributeId={attributeId}
        value={value}
        onChange={onChange}
        onRemove={onRemove}
        termNames={termNames}
        dragHandle={handle}
      />
    </div>
  );
}

export function AttributeEditor({ storeId, form, setForm, productMode, onPromoteToVariable, isEdit }: Props) {
  const [editingAttr, setEditingAttr] = useState<number | null>(null);
  const [newValueInput, setNewValueInput] = useState<Record<number, string>>({});
  const [typeSwitchOpen, setTypeSwitchOpen] = useState(false);
  const pendingFormRef = useRef<ProductFormState | null>(null);
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

  const reorderValuesAt = (attrIdx: number, from: number, to: number) => {
    setForm((p) => {
      const attrs = [...p.attributes];
      attrs[attrIdx] = {
        ...attrs[attrIdx],
        options: arrayMove(attrs[attrIdx].options, from, to),
      };
      return { ...p, attributes: attrs };
    });
  };

  const deleteAttribute = (i: number) => {
    setForm((p) => ({ ...p, attributes: p.attributes.filter((_, idx) => idx !== i) }));
    setEditingAttr(null);
  };

  const confirmTypeSwitch = () => {
    const next = pendingFormRef.current;
    pendingFormRef.current = null;
    setTypeSwitchOpen(false);
    if (!next) return;
    setForm(() => next);
    if (next.type === "variable" && onPromoteToVariable) {
      queueMicrotask(() => onPromoteToVariable());
    }
  };

  return (
    <>
    <div className="rounded-lg border border-border bg-background">
      <div className="divide-y divide-border/70">
      {form.attributes.map((attr, idx) => {
        const expanded = editingAttr === idx;
        return (
          <div key={idx} className="p-3 sm:p-4 bg-background">
              {expanded ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Attribute name</Label>
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
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Values</Label>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Drag the grip to change order on the product page. WooCommerce uses this list order when the attribute is set to sort by custom ordering (menu order).
                    </p>
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
                      onReorderOptions={(from, to) => reorderValuesAt(idx, from, to)}
                      onAddOption={(v) => addValue(idx, v)}
                      newInputValue={newValueInput[idx] || ""}
                      onNewInputChange={(v) => setNewValueInput((s) => ({ ...s, [idx]: v }))}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
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
                    Visible on product page
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={attr.variation}
                      onCheckedChange={(v) => {
                        const checked = !!v;
                        setForm((p) => {
                          const nextState = applyVariationCheckboxChange(p, idx, checked);
                          if (
                            isEdit &&
                            nextState.type !== p.type &&
                            isSimpleVariableTransition(p.type, nextState.type)
                          ) {
                            pendingFormRef.current = nextState;
                            queueMicrotask(() => setTypeSwitchOpen(true));
                            return p;
                          }
                          if (checked && p.type === "simple" && nextState.type === "variable" && onPromoteToVariable) {
                            queueMicrotask(() => onPromoteToVariable());
                          }
                          return nextState;
                        });
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
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-medium text-sm">{attr.name}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground bg-muted/80 rounded px-1.5 py-0.5">
                        {attr.options.length} option{attr.options.length === 1 ? "" : "s"}
                      </span>
                      {!!attr.id && attr.id > 0 && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5">global</span>
                      )}
                      {attr.variation && (
                        <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/10 rounded px-1.5 py-0.5">variation</span>
                      )}
                      {!attr.visible && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">hidden</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                      {attr.options.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No values yet</span>
                      ) : (
                        attr.options.slice(0, 12).map((opt) => (
                          <span key={opt} className="text-[11px] px-2 py-0.5 rounded-md border border-border/80 bg-muted/30 truncate max-w-[140px]">
                            {opt}
                          </span>
                        ))
                      )}
                      {attr.options.length > 12 && (
                        <span className="text-[10px] text-muted-foreground self-center">+{attr.options.length - 12} more</span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1"
                    onClick={() => setEditingAttr(idx)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    Edit values
                  </Button>
                </div>
              )}
          </div>
        );
      })}
      </div>

      <div className="border-t border-border/70 p-3 sm:p-4 bg-muted/20">
        <AttributeNameCombobox
          wooAttributes={wooAttributes}
          excludeIds={usedAttrIds}
          onSelectExisting={addExistingAttribute}
          onCreateNew={(name) => void addNewAttribute(name)}
          isPending={createWooAttribute.isPending}
        />
      </div>
    </div>

    <AlertDialog
      open={typeSwitchOpen}
      onOpenChange={(open) => {
        if (!open) pendingFormRef.current = null;
        setTypeSwitchOpen(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change product type?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground space-y-2">
            <span className="block">
              Switching between a simple product and a variable product affects SKUs, pricing, and variations already linked in WooCommerce.
            </span>
            <span className="block font-medium text-foreground">
              Save after changing type so WooCommerce stays in sync. Review variations and default options before publishing.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
          <AlertDialogAction type="button" className="bg-foreground text-background hover:bg-foreground/90" onClick={confirmTypeSwitch}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function AttrValuesEditor({
  storeId,
  attribute,
  onChangeOption,
  onRemoveOption,
  onReorderOptions,
  onAddOption,
  newInputValue,
  onNewInputChange,
}: {
  storeId: string;
  attribute: ProductFormState["attributes"][number];
  onChangeOption: (optIdx: number, v: string) => void;
  onRemoveOption: (optIdx: number) => void;
  onReorderOptions: (from: number, to: number) => void;
  onAddOption: (v: string) => void;
  newInputValue: string;
  onNewInputChange: (v: string) => void;
}) {
  const [quickBulk, setQuickBulk] = useState("");
  const isGlobal = !!attribute.id && attribute.id > 0;
  const { data: terms = [] } = useWooAttributeTerms(storeId, isGlobal ? attribute.id! : null);
  const termNames = new Set(terms.map((t) => t.name.toLowerCase().trim()));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortableIds = attribute.options.map((_, i) => String(i));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (!Number.isInteger(oldIndex) || !Number.isInteger(newIndex)) return;
    if (oldIndex < 0 || newIndex < 0 || oldIndex >= attribute.options.length || newIndex >= attribute.options.length) return;
    onReorderOptions(oldIndex, newIndex);
  };

  const optionRows =
    attribute.options.length <= 1
      ? attribute.options.map((opt, optIdx) => (
          <OptionRow
            key={`${optIdx}-${opt}`}
            storeId={storeId}
            attributeId={attribute.id}
            value={opt}
            onChange={(v) => onChangeOption(optIdx, v)}
            onRemove={() => onRemoveOption(optIdx)}
            termNames={termNames}
          />
        ))
      : attribute.options.map((opt, optIdx) => (
          <SortableOptionRow
            key={`${optIdx}-${opt}`}
            id={String(optIdx)}
            storeId={storeId}
            attributeId={attribute.id}
            value={opt}
            onChange={(v) => onChangeOption(optIdx, v)}
            onRemove={() => onRemoveOption(optIdx)}
            termNames={termNames}
          />
        ));

  const applyQuickBulk = () => {
    const parts = quickBulk.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => onAddOption(p));
    setQuickBulk("");
  };

  return (
    <div className="space-y-1.5">
      {attribute.options.length <= 1 ? (
        optionRows
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {optionRows}
          </SortableContext>
        </DndContext>
      )}
      <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-2 py-2 space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Quick add (comma-separated)</Label>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <Input
            className="h-8 text-sm"
            placeholder="e.g. Red, Blue, Green"
            value={quickBulk}
            onChange={(e) => setQuickBulk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyQuickBulk();
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={applyQuickBulk}>
            Add all
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="h-9"
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
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onAddOption(newInputValue)}>
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