export type WooTerm = {
  id: number;
  name: string;
  slug: string;
  parent?: number;
  description?: string;
  count?: number;
  image?: { id: number; src: string } | null;
};

import { authorizedFetch } from "@/lib/api-client";

export type TaxonomyKind = "categories" | "tags" | "brands";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || `Request failed (${res.status})`);
    (error as Error & { brandsUnavailable?: boolean }).brandsUnavailable = err.brandsUnavailable;
    throw error;
  }
  return (await res.json()) as T;
}

export async function listTaxonomy(storeId: string, kind: TaxonomyKind): Promise<WooTerm[]> {
  const res = await authorizedFetch(`/api/stores/${storeId}/wc/taxonomy?kind=${kind}`);
  return handle<WooTerm[]>(res);
}

export async function createTaxonomy(
  storeId: string,
  kind: TaxonomyKind,
  payload: { name: string; slug?: string; parent?: number; description?: string }
): Promise<WooTerm> {
  const res = await authorizedFetch(`/api/stores/${storeId}/wc/taxonomy?kind=${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<WooTerm>(res);
  console.log(`create${kind}:`, { data });
  return data;
}