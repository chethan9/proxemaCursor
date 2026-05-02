import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { getWooUserAgent } from "@/lib/brand-name-server";
import type { ActivityLogEntry, ActorType } from "@/services/activityLogService";
import type { ProductHistoryEntry, ProductHistorySourceKind } from "@/types/product-history";

type WpRevision = {
  id: number;
  modified?: string;
  date?: string;
  slug?: string;
  title?: unknown;
  content?: unknown;
  excerpt?: unknown;
  _embedded?: { author?: Array<{ name?: string }> };
};

function wpRendered(obj: unknown): string {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "object" && obj !== null && "rendered" in obj) {
    return String((obj as { rendered?: string }).rendered ?? "");
  }
  return String(obj);
}

function pickWpSnapshot(r: WpRevision) {
  return {
    title: wpRendered(r.title),
    content: wpRendered(r.content),
    excerpt: wpRendered(r.excerpt),
    slug: r.slug || "",
  };
}

function actorFromWpRevision(r: WpRevision): string {
  const emb = r._embedded?.author?.[0]?.name;
  if (emb && emb.trim()) return emb.trim();
  return "WordPress";
}

async function fetchWpProductRevisions(
  storeUrl: string,
  wooId: number,
  wpUser: string,
  wpAppPassword: string
): Promise<{ revisions: WpRevision[]; error?: string }> {
  const base = storeUrl.replace(/\/$/, "");
  const url = `${base}/wp-json/wp/v2/product/${wooId}/revisions?context=edit&per_page=100&_embed=author`;
  const auth = Buffer.from(`${wpUser}:${wpAppPassword.replace(/\s+/g, "")}`).toString("base64");
  const ua = await getWooUserAgent();
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "User-Agent": ua,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { revisions: [], error: `WP revisions ${res.status}: ${t.slice(0, 120)}` };
    }
    const data = (await res.json()) as WpRevision[] | { revisions?: WpRevision[] };
    const list = Array.isArray(data) ? data : data.revisions;
    if (!Array.isArray(list)) return { revisions: [], error: "Unexpected WP revisions response" };
    return { revisions: list };
  } catch (e) {
    return { revisions: [], error: e instanceof Error ? e.message : "WP revisions fetch failed" };
  } finally {
    clearTimeout(to);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { storeId, productId } = req.query;
  if (typeof storeId !== "string" || typeof productId !== "string") {
    return res.status(400).json({ error: "storeId and productId required" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const { data: product, error: pErr } = await supabaseAdmin
    .from("products")
    .select("id, woo_id, store_id")
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (pErr || !product?.woo_id) {
    return res.status(404).json({ error: "Product not found" });
  }

  const wooId = product.woo_id as number;

  const { data: storeRow } = await supabaseAdmin
    .from("stores")
    .select("url, wp_username, wp_app_password")
    .eq("id", storeId)
    .single();

  const wpUser = storeRow?.wp_username?.trim();
  const wpPass = storeRow?.wp_app_password?.trim();
  const canWp = !!(storeRow?.url && wpUser && wpPass);

  const [alRes, ecRes, wpData] = await Promise.all([
    supabaseAdmin
      .from("activity_log")
      .select("*")
      .eq("entity_type", "product")
      .eq("entity_id", productId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("entity_changes")
      .select("*")
      .eq("entity_type", "product")
      .eq("entity_id", productId)
      .in("source", ["webhook", "sync"])
      .order("created_at", { ascending: false })
      .limit(200),
    canWp
      ? fetchWpProductRevisions(storeRow!.url as string, wooId, wpUser!, wpPass!)
      : Promise.resolve({ revisions: [] as WpRevision[], error: "WordPress app password not configured" }),
  ]);

  if (alRes.error) return res.status(500).json({ error: alRes.error.message });
  if (ecRes.error) return res.status(500).json({ error: ecRes.error.message });

  const platformRows: ProductHistoryEntry[] = ((alRes.data || []) as ActivityLogEntry[]).map((row) => ({
    ...row,
    history_source: "platform" as const,
    history_source_kind: "dashboard" as const,
  }));

  const ecRows: ProductHistoryEntry[] = (ecRes.data || []).map((ec: Record<string, unknown>) => {
    const id = String(ec.id);
    const created_at = (ec.created_at as string) || new Date().toISOString();
    const changeType = String(ec.change_type || "updated");
    const source = String(ec.source || "webhook");
    const kind: ProductHistorySourceKind = source === "sync" ? "sync" : "webhook";
    const snapBefore = ec.snapshot_before as Record<string, unknown> | null;
    const snapAfter = ec.snapshot_after as Record<string, unknown> | null;
    const changedFields = ec.changed_fields as Array<{ field?: string; old?: unknown; new?: unknown }> | null;

    const diff: Record<string, unknown> | null =
      snapBefore && snapAfter
        ? { before: snapBefore, after: snapAfter }
        : changedFields && changedFields.length > 0
          ? Object.fromEntries(
              changedFields
                .filter((x) => x?.field)
                .map((x) => [String(x.field), { old: x.old, new: x.new }])
            )
          : null;

    const label =
      kind === "sync" ? "WooCommerce sync" : "WordPress (webhook)";

    return {
      id: `ec:${id}`,
      created_at,
      actor_user_id: null,
      actor_email: null,
      actor_type: "system" as ActorType,
      action: `product.${changeType}`,
      entity_type: "product",
      entity_id: productId,
      client_id: null,
      diff,
      metadata: { module: "sites", entity_change_id: id, woo_change_source: source },
      history_source: "wordpress",
      history_source_kind: kind,
      display_actor: label,
    };
  });

  const revList = wpData.revisions || [];
  const sorted = [...revList].sort((a, b) => {
    const ta = new Date(a.modified || a.date || 0).getTime();
    const tb = new Date(b.modified || b.date || 0).getTime();
    return ta - tb;
  });

  const wpRows: ProductHistoryEntry[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = pickWpSnapshot(sorted[i - 1]);
    const cur = pickWpSnapshot(sorted[i]);
    const before = { title: prev.title, description: prev.content, short_description: prev.excerpt, slug: prev.slug };
    const after = { title: cur.title, description: cur.content, short_description: cur.excerpt, slug: cur.slug };
    const unchanged = JSON.stringify(before) === JSON.stringify(after);
    if (unchanged) continue;

    const ts = sorted[i].modified || sorted[i].date || new Date().toISOString();
    wpRows.push({
      id: `wpr:${sorted[i].id}`,
      created_at: ts,
      actor_user_id: null,
      actor_email: null,
      actor_type: "system",
      action: "product.wp_revision",
      entity_type: "product",
      entity_id: productId,
      client_id: null,
      diff: { before, after },
      metadata: { wp_revision_id: sorted[i].id },
      history_source: "wordpress",
      history_source_kind: "wp_revision",
      display_actor: actorFromWpRevision(sorted[i]),
    });
  }

  const merged = [...platformRows, ...ecRows, ...wpRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return res.status(200).json({
    entries: merged,
    wpRevisionsAvailable: canWp && !wpData.error,
    wpReason: wpData.error ?? (!canWp ? "WordPress app password not configured" : undefined),
  });
}
