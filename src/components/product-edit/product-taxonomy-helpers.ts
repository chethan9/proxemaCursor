import type { WooTerm } from "@/services/wooTaxonomyService";

/** Full path like `Parent › Child` for hierarchy display. */
export function categoryBreadcrumb(terms: WooTerm[], c: WooTerm): string {
  const byId = new Map(terms.map((t) => [t.id, t]));
  const parts: string[] = [];
  let cur: WooTerm | undefined = c;
  const seen = new Set<number>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    const p = cur.parent;
    cur = p && p > 0 ? byId.get(p) : undefined;
    if (seen.size > 50) break;
  }
  return parts.join(" › ");
}

export function sortCategoriesForPicker(terms: WooTerm[]): WooTerm[] {
  return [...terms].sort((a, b) =>
    categoryBreadcrumb(terms, a).localeCompare(categoryBreadcrumb(terms, b), undefined, { sensitivity: "base" }),
  );
}
