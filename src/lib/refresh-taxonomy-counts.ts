import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooRequest, type StoreCreds } from "@/lib/woo-client";

type Kind = "categories" | "tags" | "brands";

const ENDPOINT: Record<Kind, string> = {
  categories: "products/categories",
  tags: "products/tags",
  brands: "products/brands",
};

const TABLE: Record<Kind, "categories" | "tags" | "brands"> = {
  categories: "categories",
  tags: "tags",
  brands: "brands",
};

export async function refreshTaxonomyCounts(
  creds: StoreCreds,
  storeId: string,
  kind: Kind,
  wooIds: number[],
): Promise<void> {
  const ids = Array.from(new Set(wooIds.filter((n) => Number.isFinite(n) && n > 0)));
  if (ids.length === 0) return;
  try {
    const fresh = await wooRequest<Array<{ id: number; count?: number }>>(
      creds,
      "GET",
      `${ENDPOINT[kind]}?include=${ids.join(",")}&per_page=${ids.length}`,
    );
    if (!Array.isArray(fresh) || fresh.length === 0) return;
    const now = new Date().toISOString();
    await Promise.all(
      fresh.map((item) =>
        supabaseAdmin
          .from(TABLE[kind])
          .update({ count: item.count ?? 0, synced_at: now })
          .eq("store_id", storeId)
          .eq("woo_id", item.id),
      ),
    );
  } catch (err) {
    console.warn(`[refresh-taxonomy-counts] ${kind}`, err instanceof Error ? err.message : err);
  }
}

export function extractTaxonomyIds(items: unknown): number[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x) => (x && typeof x === "object" && "id" in x ? Number((x as { id: unknown }).id) : NaN))
    .filter((n) => Number.isFinite(n) && n > 0);
}