import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { WOO_USER_AGENT, detectBlockingService, type BlockingService } from "@/lib/sync-error";
import { getFixForService } from "@/lib/waf-fixes";

type ProbeName = "root" | "wp_json" | "wc_system_status";

interface ProbeResult {
  name: ProbeName;
  label: string;
  url: string;
  status: number | null;
  ok: boolean;
  duration_ms: number;
  blocking_service: BlockingService | null;
  blocking_hint: string | null;
  body_preview: string;
  error: string | null;
}

type OverallStatus = "ok" | "auth_failed" | "blocked" | "unreachable";

const PROBE_CACHE = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

async function runProbe(
  name: ProbeName,
  label: string,
  url: string,
  init: RequestInit,
  timeoutMs = 12000
): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers || {});
  headers.set("User-Agent", WOO_USER_AGENT);
  headers.set("Accept", "application/json,text/html;q=0.9,*/*;q=0.8");

  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    clearTimeout(timer);
    const text = await res.text().catch(() => "");
    const bodyPreview = text.slice(0, 300);
    const detection = detectBlockingService(res.status, text.slice(0, 3000), res.headers);
    return {
      name,
      label,
      url,
      status: res.status,
      ok: res.ok,
      duration_ms: Date.now() - started,
      blocking_service: detection?.service ?? null,
      blocking_hint: detection?.hint ?? null,
      body_preview: bodyPreview,
      error: null,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      name,
      label,
      url,
      status: null,
      ok: false,
      duration_ms: Date.now() - started,
      blocking_service: null,
      blocking_hint: null,
      body_preview: "",
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { storeId: storeIdRaw } = req.query;
  const storeId = Array.isArray(storeIdRaw) ? storeIdRaw[0] : storeIdRaw;
  if (!storeId) return res.status(400).json({ error: "Missing store id" });

  const lastProbeAt = PROBE_CACHE.get(storeId);
  if (lastProbeAt && Date.now() - lastProbeAt < RATE_LIMIT_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastProbeAt)) / 1000);
    return res.status(429).json({ error: `Rate limited. Try again in ${waitSec}s.`, retry_after_ms: RATE_LIMIT_MS - (Date.now() - lastProbeAt) });
  }
  PROBE_CACHE.set(storeId, Date.now());

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("id, url, consumer_key, consumer_secret")
    .eq("id", storeId)
    .maybeSingle();

  if (!store) return res.status(404).json({ error: "Store not found" });

  const baseUrl = store.url.replace(/\/$/, "");
  const authHeader = store.consumer_key && store.consumer_secret
    ? "Basic " + Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64")
    : null;

  const probes: ProbeResult[] = [];
  probes.push(await runProbe("root", "Site root", baseUrl, { method: "GET" }));
  probes.push(await runProbe("wp_json", "WordPress REST root", `${baseUrl}/wp-json/`, { method: "GET" }));
  probes.push(
    await runProbe(
      "wc_system_status",
      "WooCommerce API (authenticated)",
      `${baseUrl}/wp-json/wc/v3/system_status?per_page=1`,
      { method: "GET", headers: authHeader ? { Authorization: authHeader } : {} }
    )
  );

  const firstBlocked = probes.find((p) => p.blocking_service);
  const detectedService: BlockingService | null = firstBlocked?.blocking_service ?? null;

  let overallStatus: OverallStatus;
  const allOk = probes.every((p) => p.ok);
  if (allOk) {
    overallStatus = "ok";
  } else if (detectedService) {
    overallStatus = "blocked";
  } else if (probes[2].status === 401 || probes[2].status === 403) {
    overallStatus = detectedService ? "blocked" : "auth_failed";
  } else if (probes.every((p) => p.status === null)) {
    overallStatus = "unreachable";
  } else if (probes[2].status && probes[2].status >= 400) {
    overallStatus = "blocked";
  } else {
    overallStatus = "unreachable";
  }

  const fix = detectedService ? getFixForService(detectedService) : overallStatus === "blocked" ? getFixForService("unknown") : null;

  return res.status(200).json({
    overall_status: overallStatus,
    detected_service: detectedService,
    probes,
    fix,
    tested_at: new Date().toISOString(),
  });
}