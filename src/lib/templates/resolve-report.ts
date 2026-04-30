import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReportRow {
  order_number: string;
  date: string;
  customer: string;
  total: number;
  status: string;
}

export interface ReportContext {
  store: { name: string; currency: string };
  report: {
    title: string;
    generated_at: string;
    period_label: string;
    currency: string;
  };
  rows: ReportRow[];
  summary: { order_count: number; revenue: number };
}

export function getReportSampleContext(_templateMeta: { name: string; type: string }): ReportContext {
  return {
    store: { name: "Sample Store", currency: "USD" },
    report: {
      title: "Sales report",
      generated_at: new Date().toLocaleString("en-US"),
      period_label: "Last 30 days (sample)",
      currency: "USD",
    },
    rows: [
      { order_number: "1024", date: "May 22, 2024", customer: "Sarah Johnson", total: 88.8, status: "completed" },
      { order_number: "1025", date: "May 21, 2024", customer: "Alex Chen", total: 42.0, status: "processing" },
    ],
    summary: { order_count: 2, revenue: 130.8 },
  };
}

export async function resolveReportContext(
  supabase: SupabaseClient,
  storeId: string,
  opts?: { from?: string; to?: string },
): Promise<ReportContext> {
  const { data: store } = await supabase
    .from("stores")
    .select("name, currency")
    .eq("id", storeId)
    .maybeSingle();
  const currency = String(store?.currency || "USD");

  let q = supabase
    .from("orders")
    .select("id, date_created, total, status, currency, billing, order_number")
    .eq("store_id", storeId)
    .order("date_created", { ascending: false })
    .limit(500);
  if (opts?.from) q = q.gte("date_created", opts.from);
  if (opts?.to) q = q.lte("date_created", opts.to);
  const { data: orders, error } = await q;
  if (error) throw error;

  const rows: ReportRow[] = (orders || []).map((o) => {
    const billing = (o.billing as Record<string, unknown>) || {};
    const first = String(billing.first_name || "");
    const last = String(billing.last_name || "");
    const customer = [first, last].filter(Boolean).join(" ") || String(billing.email || "—");
    const num = o.order_number != null && String(o.order_number).trim() !== "" ? String(o.order_number) : String(o.id || "").slice(0, 8);
    const d = o.date_created ? new Date(String(o.date_created)) : new Date();
    return {
      order_number: num,
      date: d.toLocaleDateString("en-US"),
      customer,
      total: Number(o.total || 0),
      status: String(o.status || ""),
    };
  });

  const revenue = rows.reduce((s, r) => s + r.total, 0);
  const period_label =
    opts?.from && opts?.to
      ? `${new Date(opts.from).toLocaleDateString()} – ${new Date(opts.to).toLocaleDateString()}`
      : "Recent orders";

  return {
    store: { name: String(store?.name || "Store"), currency },
    report: {
      title: "Sales report",
      generated_at: new Date().toLocaleString("en-US"),
      period_label,
      currency,
    },
    rows,
    summary: { order_count: rows.length, revenue },
  };
}
