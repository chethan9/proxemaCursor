import type { Database } from "@/integrations/supabase/helpers";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

/** Woo REST uses 0 for “no parent”; DB may use null. */
export function normalizeParentWoo(p: number | null | undefined): number {
  if (p == null || p === 0) return 0;
  return p;
}

export type FlatCategoryItem = {
  id: string;
  woo_id: number;
  depth: number;
  parentWoo: number;
};

export function flattenCategoriesDfs(rows: CategoryRow[]): FlatCategoryItem[] {
  const byParent = new Map<number, CategoryRow[]>();
  for (const r of rows) {
    const p = normalizeParentWoo(r.parent_id);
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(r);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => {
      const mo = (a.menu_order ?? 0) - (b.menu_order ?? 0);
      if (mo !== 0) return mo;
      return (a.name || "").localeCompare(b.name || "");
    });
  }

  const out: FlatCategoryItem[] = [];
  const walk = (parentWoo: number, depth: number) => {
    const kids = byParent.get(parentWoo);
    if (!kids) return;
    for (const r of kids) {
      const wid = r.woo_id;
      if (wid == null) continue;
      out.push({
        id: r.id,
        woo_id: wid,
        depth,
        parentWoo,
      });
      walk(wid, depth + 1);
    }
  };
  walk(0, 0);
  return out;
}

/** Indices [start, end) covering `start` and all descendants in DFS flat order. */
export function subtreeRange(flat: FlatCategoryItem[], start: number): { start: number; end: number } {
  if (start < 0 || start >= flat.length) return { start: 0, end: 0 };
  const baseDepth = flat[start].depth;
  let end = start + 1;
  while (end < flat.length && flat[end].depth > baseDepth) end++;
  return { start, end };
}

export function collectSubtreeWooIds(flat: FlatCategoryItem[], start: number): Set<number> {
  const { start: s, end } = subtreeRange(flat, start);
  const ids = new Set<number>();
  for (let i = s; i < end; i++) ids.add(flat[i].woo_id);
  return ids;
}

/** Clamp depths so each row is at most one level deeper than the previous. */
export function normalizeDepths(flat: Array<{ depth: number }>): void {
  if (flat.length === 0) return;
  flat[0].depth = Math.max(0, flat[0].depth);
  for (let i = 1; i < flat.length; i++) {
    const max = flat[i - 1].depth + 1;
    if (flat[i].depth > max) flat[i].depth = max;
    if (flat[i].depth < 0) flat[i].depth = 0;
  }
}

/** Assign parentWoo from depths using a depth-indexed stack of woo_ids. */
export function assignParentsFromDepths(flat: FlatCategoryItem[]): void {
  const stack: number[] = [];
  for (const row of flat) {
    const d = row.depth;
    stack.length = d;
    row.parentWoo = d === 0 ? 0 : stack[d - 1]!;
    stack[d] = row.woo_id;
  }
}

export type DropIntent = "beforeSibling" | "child";

/**
 * Move contiguous subtree starting at `activeIndex` so its root lands relative to `overIndex`:
 * - beforeSibling: root becomes sibling immediately before former `over` row (same depth as over).
 * - child: root becomes first child of `over` (depth over.depth + 1), inserted directly under over.
 */
export function moveSubtree(
  flat: FlatCategoryItem[],
  activeIndex: number,
  overIndex: number,
  intent: DropIntent,
): FlatCategoryItem[] | null {
  if (activeIndex === overIndex || flat.length === 0) return flat.slice();

  const block = subtreeRange(flat, activeIndex);
  const subtreeIds = collectSubtreeWooIds(flat, activeIndex);

  if (intent === "beforeSibling") {
    if (overIndex >= block.start && overIndex < block.end) return null;
  } else {
    if (overIndex >= block.start && overIndex < block.end) return null;
    if (subtreeIds.has(flat[overIndex].woo_id)) return null;
  }

  const blockLen = block.end - block.start;
  const slice = flat.slice(block.start, block.end);
  const without = [...flat.slice(0, block.start), ...flat.slice(block.end)];

  let overIdxInWithout = overIndex;
  if (overIndex > block.start) overIdxInWithout -= blockLen;

  if (overIdxInWithout < 0 || overIdxInWithout >= without.length) return null;

  let insertAt: number;
  let newRootDepth: number;

  if (intent === "beforeSibling") {
    insertAt = overIdxInWithout;
    newRootDepth = without[overIdxInWithout].depth;
  } else {
    insertAt = overIdxInWithout + 1;
    newRootDepth = without[overIdxInWithout].depth + 1;
  }

  const rootOldDepth = slice[0].depth;
  const delta = newRootDepth - rootOldDepth;
  const moved: FlatCategoryItem[] = slice.map((row) => ({
    ...row,
    depth: row.depth + delta,
  }));

  const merged = [...without.slice(0, insertAt), ...moved, ...without.slice(insertAt)];
  normalizeDepths(merged);
  assignParentsFromDepths(merged);
  return merged;
}

export type CategoryPatch = { id: string; woo_id: number; parent: number; menu_order: number };

/** Merge successful reorder patches into local category rows (instant cache alignment). */
export function applyCategoryPatchesToRows(rows: CategoryRow[], patches: CategoryPatch[]): CategoryRow[] {
  if (patches.length === 0) return rows;
  const patchById = new Map(patches.map((p) => [p.id, p] as const));
  return rows.map((r) => {
    const p = patchById.get(r.id);
    if (!p) return r;
    return {
      ...r,
      parent_id: p.parent === 0 ? null : p.parent,
      menu_order: p.menu_order,
    };
  });
}

/** Build Woo PATCH payloads for rows whose parent or sibling order changed. */
export function diffCategoryPatches(prevRows: CategoryRow[], nextFlat: FlatCategoryItem[]): CategoryPatch[] {
  const prevById = new Map(prevRows.map((r) => [r.id, r] as const));
  const patches: CategoryPatch[] = [];

  const byParent = new Map<number, FlatCategoryItem[]>();
  for (const x of nextFlat) {
    const p = x.parentWoo;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(x);
  }

  for (const [, siblings] of byParent) {
    siblings.forEach((x, menu_order) => {
      const row = prevById.get(x.id);
      if (!row) return;
      const prevParent = normalizeParentWoo(row.parent_id);
      const prevOrder = row.menu_order ?? 0;
      if (prevParent !== x.parentWoo || prevOrder !== menu_order) {
        patches.push({ id: x.id, woo_id: row.woo_id, parent: x.parentWoo, menu_order });
      }
    });
  }

  return patches;
}

/** Include ancestors so filtered paths stay connected for tree display. */
export function filterCategoriesForSearch(rows: CategoryRow[], q: string): CategoryRow[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  const byWoo = new Map<number, CategoryRow>();
  for (const r of rows) {
    if (r.woo_id != null) byWoo.set(r.woo_id, r);
  }
  const keep = new Set<string>();
  const matches = (r: CategoryRow) =>
    (r.name || "").toLowerCase().includes(s) || (r.slug || "").toLowerCase().includes(s);
  for (const r of rows) {
    if (!matches(r)) continue;
    let cur: CategoryRow | undefined = r;
    while (cur) {
      keep.add(cur.id);
      const pw = normalizeParentWoo(cur.parent_id);
      if (pw === 0) break;
      cur = byWoo.get(pw);
    }
  }
  return rows.filter((r) => keep.has(r.id));
}
