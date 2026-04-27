import type { WooStoreCreds } from "./woo-client";
import { wooRequest } from "./woo-client";

type WooAttribute = {
  id?: number;
  name: string;
  options?: string[];
  variation?: boolean;
  visible?: boolean;
  position?: number;
};

type WooVariationAttr = {
  id?: number;
  name: string;
  option: string;
};

type WooVariation = {
  attributes?: WooVariationAttr[];
  [key: string]: unknown;
};

type WooTerm = { id: number; name: string; slug: string };

async function fetchAllTerms(creds: WooStoreCreds, attrId: number): Promise<WooTerm[]> {
  const all: WooTerm[] = [];
  let page = 1;
  while (page < 10) {
    const batch = await wooRequest<WooTerm[]>(
      creds,
      "GET",
      `products/attributes/${attrId}/terms?per_page=100&page=${page}`
    );
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

export async function reconcileAttributeTerms<V extends WooVariation>(
  creds: WooStoreCreds,
  parentAttributes: WooAttribute[],
  variations: V[]
): Promise<{ parentAttributes: WooAttribute[]; variations: V[] }> {
  const globalAttrs = parentAttributes.filter((a) => typeof a.id === "number" && a.id > 0);
  if (globalAttrs.length === 0) {
    return { parentAttributes, variations };
  }

  const canonicalByAttr = new Map<number, Map<string, string>>();

  for (const attr of globalAttrs) {
    const attrId = attr.id as number;
    const usedOptions = new Set<string>();
    (attr.options || []).forEach((o) => {
      const t = (o || "").trim();
      if (t) usedOptions.add(t);
    });
    variations.forEach((v) => {
      (v.attributes || []).forEach((va) => {
        const matchById = va.id === attrId;
        const matchByName = !va.id && va.name && va.name.toLowerCase() === attr.name.toLowerCase();
        if (matchById || matchByName) {
          const t = (va.option || "").trim();
          if (t) usedOptions.add(t);
        }
      });
    });

    let existing: WooTerm[] = [];
    try {
      existing = await fetchAllTerms(creds, attrId);
    } catch (e) {
      console.error(`[attr-reconcile] fetch terms failed for attr ${attrId}:`, e);
      continue;
    }

    const byKey = new Map<string, WooTerm>();
    existing.forEach((t) => {
      byKey.set(t.name.toLowerCase().trim(), t);
      byKey.set(t.slug.toLowerCase().trim(), t);
    });

    const missing: string[] = [];
    usedOptions.forEach((o) => {
      if (!byKey.has(o.toLowerCase())) missing.push(o);
    });

    for (const name of missing) {
      try {
        const created = await wooRequest<WooTerm>(
          creds,
          "POST",
          `products/attributes/${attrId}/terms`,
          { name }
        );
        byKey.set(created.name.toLowerCase().trim(), created);
        byKey.set(created.slug.toLowerCase().trim(), created);
        console.log(`[attr-reconcile] created term "${name}" -> id=${created.id} for attr ${attrId}`);
      } catch (e) {
        console.error(`[attr-reconcile] create term "${name}" failed for attr ${attrId}:`, e);
      }
    }

    const canonical = new Map<string, string>();
    usedOptions.forEach((o) => {
      const t = byKey.get(o.toLowerCase());
      if (t) canonical.set(o.toLowerCase(), t.name);
    });
    canonicalByAttr.set(attrId, canonical);
  }

  const rewrittenParent = parentAttributes.map((a) => {
    if (typeof a.id !== "number" || a.id <= 0) return a;
    const canonical = canonicalByAttr.get(a.id);
    if (!canonical) return a;
    return {
      ...a,
      options: (a.options || []).map((o) => canonical.get((o || "").toLowerCase().trim()) || o),
    };
  });

  const rewrittenVariations = variations.map((v) => {
    const attrs = (v.attributes || []).map((va) => {
      const matchedAttr = globalAttrs.find(
        (g) => g.id === va.id || (!va.id && g.name.toLowerCase() === (va.name || "").toLowerCase())
      );
      if (!matchedAttr || typeof matchedAttr.id !== "number") return va;
      const canonical = canonicalByAttr.get(matchedAttr.id);
      if (!canonical) return va;
      const canonicalName = canonical.get((va.option || "").toLowerCase().trim());
      if (!canonicalName) return va;
      return { ...va, id: matchedAttr.id, name: matchedAttr.name, option: canonicalName };
    });
    return { ...v, attributes: attrs };
  });

  return { parentAttributes: rewrittenParent, variations: rewrittenVariations };
}