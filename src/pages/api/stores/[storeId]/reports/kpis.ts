import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { ReportsKpisResponse } from "@/lib/reports-kpis-types";

type StoreAccess = { allowed: true } | { allowed: false; status: number; message: string };

async function assertStoreAccess(userId: string, storeId: string): Promise<StoreAccess> {
  const { data: profile } = await supabaseAdmin.from("profiles").select("role, client_id").eq("id", userId).single();
  if (!profile) return { allowed: false, status: 403, message: "Profile not found" };
  const { data: store } = await supabaseAdmin.from("stores").select("id, client_id").eq("id", storeId).single();
  if (!store) return { allowed: false, status: 404, message: "Store not found" };
  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && store.client_id !== profile.client_id) {
    return { allowed: false, status: 403, message: "Forbidden" };
  }
  return { allowed: true };
}

type CacheEntry = { expiresAt: number; payload: ReportsKpisResponse };
const kpisCache = new Map<string, CacheEntry>();
const KPI_CACHE_MS = 60_000;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return 0;
}

function parseKpisPayload(raw: unknown): ReportsKpisResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  return {
    windowDays: Math.round(num(j.windowDays)),
    startsAt: typeof j.startsAt === "string" ? j.startsAt : String(j.startsAt ?? ""),
    endsAt: typeof j.endsAt === "string" ? j.endsAt : String(j.endsAt ?? ""),
    grossSales: num(j.grossSales),
    discounts: num(j.discounts),
    netSales: num(j.netSales),
    taxes: num(j.taxes),
    shipping: num(j.shipping),
    totalSales: num(j.totalSales),
    ordersCount: Math.round(num(j.ordersCount)),
    refundsCount: Math.round(num(j.refundsCount)),
    aov: num(j.aov),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReportsKpisResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  if (!storeId) return res.status(400).json({ error: "Missing storeId" });

  const daysRaw = typeof req.query.days === "string" ? Number.parseInt(req.query.days, 10) : 30;
  const windowDays = Number.isFinite(daysRaw) ? Math.min(366, Math.max(1, daysRaw)) : 30;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) {
    return res.status(gate.status).json({ error: gate.message });
  }

  const cacheKey = `${storeId}:${windowDays}`;
  const cached = kpisCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).json(cached.payload);
  }

  const { data, error } = await supabaseAdmin.rpc("store_reports_kpis", {
    p_store_id: storeId,
    p_days: windowDays,
  });

  if (error) return res.status(500).json({ error: error.message });

  const parsed = parseKpisPayload(data);
  if (!parsed) return res.status(500).json({ error: "Invalid KPI payload" });

  kpisCache.set(cacheKey, { expiresAt: Date.now() + KPI_CACHE_MS, payload: parsed });
  res.setHeader("Cache-Control", "private, max-age=60");
  return res.status(200).json(parsed);
}
