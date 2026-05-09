"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type CategoryRow,
  type FlatCategoryItem,
  type DropIntent,
  applyCategoryPatchesToRows,
  diffCategoryPatches,
  filterCategoriesForSearch,
  flattenCategoriesDfs,
  moveSubtree,
} from "@/lib/category-tree";
import { useAllCategories } from "@/hooks/queries/useTaxonomy";
import { updateCategory } from "@/services/taxonomyService";
import { queryKeys } from "@/lib/query-client";
import { TaxonomyRowExpanded } from "./TaxonomyRowExpanded";
import { useToast } from "@/hooks/use-toast";

const INDENT_PX = 24;

type Props = {
  storeId: string;
  search: string;
  locked?: boolean;
};

function SortableCategoryCard({
  item,
  row,
  depth,
  dragDisabled,
  onToggleEdit,
  expanded,
  dragHandleAriaLabel,
  productCountShort,
  editLabel,
}: {
  item: FlatCategoryItem;
  row: CategoryRow;
  depth: number;
  dragDisabled: boolean;
  onToggleEdit: () => void;
  expanded: boolean;
  dragHandleAriaLabel: string;
  productCountShort: string;
  editLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative", isDragging && "z-10 opacity-90")}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 shadow-sm sm:px-3",
          depth > 0 && "border-l-[3px] border-l-foreground/90",
        )}
        style={{ marginLeft: depth * INDENT_PX }}
      >
        <button
          type="button"
          className={cn(
            "shrink-0 touch-none self-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
            dragDisabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
          )}
          disabled={dragDisabled}
          aria-label={dragHandleAriaLabel}
          {...(dragDisabled ? {} : listeners)}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-x-2 overflow-hidden text-sm">
          <span className="min-w-0 flex-1 truncate text-foreground">{row.name}</span>
          <span className="shrink-0 text-muted-foreground/45" aria-hidden>
            ·
          </span>
          <span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">{productCountShort}</span>
        </div>
        <Button
          type="button"
          variant={expanded ? "secondary" : "outline"}
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 self-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleEdit();
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{editLabel}</span>
        </Button>
      </div>
    </div>
  );
}

export function CategoryTreePanel({ storeId, search, locked = false }: Props) {
  const { t } = useTranslation("site");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: allCats, isLoading, isFetching } = useAllCategories(storeId, true);

  const baseFlat = useMemo(() => {
    if (!allCats?.length) return [] as FlatCategoryItem[];
    const filtered = filterCategoriesForSearch(allCats, search);
    return flattenCategoriesDfs(filtered);
  }, [allCats, search]);

  const [optimisticBase, setOptimisticBase] = useState<FlatCategoryItem[] | null>(null);

  useEffect(() => {
    setOptimisticBase(null);
  }, [allCats]);

  const flat = optimisticBase ?? baseFlat;

  const rowById = useMemo(() => {
    const m = new Map<string, CategoryRow>();
    if (!allCats) return m;
    for (const r of allCats) m.set(r.id, r);
    return m;
  }, [allCats]);

  const dragDisabled = !!search.trim() || locked;

  const pointerYRef = useRef<number | null>(null);
  const dropIntentRef = useRef<DropIntent>("beforeSibling");

  useEffect(() => {
    const track = (e: PointerEvent) => {
      pointerYRef.current = e.clientY;
    };
    window.addEventListener("pointermove", track, { passive: true });
    return () => window.removeEventListener("pointermove", track);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Short-lived: blocks overlapping drags while Woo PATCH requests run. */
  const [patching, setPatching] = useState(false);

  const onDragStart = useCallback((_e: DragStartEvent) => {
    pointerYRef.current = null;
  }, []);

  const onDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    const rect = over?.rect as { top: number; height: number } | undefined;
    if (!rect || pointerYRef.current == null) {
      dropIntentRef.current = "beforeSibling";
      return;
    }
    const mid = rect.top + rect.height / 2;
    dropIntentRef.current = pointerYRef.current > mid ? "child" : "beforeSibling";
  }, []);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || dragDisabled || !allCats?.length) return;

      const activeIndex = flat.findIndex((x) => x.id === active.id);
      const overIndex = flat.findIndex((x) => x.id === over.id);
      if (activeIndex < 0 || overIndex < 0) return;

      const alt = typeof PointerEvent !== "undefined" && event.activatorEvent instanceof PointerEvent && event.activatorEvent.altKey;
      const intent: DropIntent = alt ? "child" : dropIntentRef.current;
      const next = moveSubtree(flat, activeIndex, overIndex, intent);
      if (!next) {
        toast({
          title: t("taxonomy.categoryTree.invalidMoveTitle"),
          description: t("taxonomy.categoryTree.invalidMoveDesc"),
          variant: "destructive",
        });
        return;
      }

      const patches = diffCategoryPatches(allCats, next);
      if (patches.length === 0) {
        setOptimisticBase(null);
        return;
      }

      setOptimisticBase(next);
      setPatching(true);
      try {
        await Promise.all(
          patches.map((p) => updateCategory(storeId, p.id, { parent: p.parent, menu_order: p.menu_order })),
        );
        qc.setQueryData([...queryKeys.taxonomy(storeId, "categories"), "all"], (prev: CategoryRow[] | undefined) =>
          prev ? applyCategoryPatchesToRows(prev, patches) : prev,
        );
        setOptimisticBase(null);
        void qc.invalidateQueries({ queryKey: ["taxonomy", "categories", storeId] });
        void qc.invalidateQueries({ queryKey: queryKeys.productCategoryOptions(storeId) });
        toast({ title: t("taxonomy.categoryTree.reorderSaved") });
      } catch (e) {
        setOptimisticBase(null);
        void qc.invalidateQueries({ queryKey: [...queryKeys.taxonomy(storeId, "categories"), "all"] });
        toast({
          title: t("taxonomy.categoryTree.reorderFailedTitle"),
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      } finally {
        setPatching(false);
      }
    },
    [allCats, dragDisabled, flat, qc, storeId, t, toast],
  );

  const sortableIds = useMemo(() => flat.map((x) => x.id), [flat]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!allCats?.length) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        {search.trim()
          ? t("taxonomy.empty.noMatch", { mode: "categories", search })
          : t("taxonomy.empty.noItems", { mode: "categories" })}
      </div>
    );
  }

  return (
    <div className="relative space-y-3 p-3 sm:p-4">
      <p className="text-xs text-muted-foreground">
        {!dragDisabled
          ? t("taxonomy.categoryTree.dragHint")
          : search.trim()
            ? t("taxonomy.categoryTree.dragDisabledSearch")
            : locked
              ? t("taxonomy.categoryTree.dragDisabledLocked")
              : t("taxonomy.categoryTree.dragHint")}
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className={cn("space-y-2", isFetching && !isLoading && "opacity-70")}>
            {flat.map((item) => {
              const row = rowById.get(item.id);
              if (!row) return null;
              const expanded = expandedId === item.id;
              return (
                <div key={item.id} className="space-y-0">
                  <SortableCategoryCard
                    item={item}
                    row={row}
                    depth={item.depth}
                    dragDisabled={dragDisabled || patching}
                    expanded={expanded}
                    dragHandleAriaLabel={t("taxonomy.categoryTree.dragHandleAria")}
                    productCountShort={t("taxonomy.categoryTree.productCountShort", { count: row.count ?? 0 })}
                    editLabel={t("taxonomy.categoryTree.edit")}
                    onToggleEdit={() => setExpandedId(expanded ? null : item.id)}
                  />
                  {expanded && (
                    <div className="border-t border-border/60 bg-muted/20">
                      <TaxonomyRowExpanded
                        item={row}
                        mode="categories"
                        storeId={storeId}
                        onClose={() => setExpandedId(null)}
                        locked={locked}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
