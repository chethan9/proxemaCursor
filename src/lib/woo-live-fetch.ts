import { getStoreCreds, type WooStoreCreds } from "./woo-client";

export interface LiveFetchParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  orderby?: string;
  order?: "asc" | "desc";
  category?: string;
  stock_status?: string;
  after?: string;
  before?: string;
  min_price?: string;
  max_price?: string;
}

export async function wooLiveFetch<T>(
  storeId: string,
  resource: "products" | "orders" | "products/categories" | "products/tags",
  params: LiveFetchParams = {}
): Promise<{ data: T[]; total: number; totalPages: number }> {
  const creds = await getStoreCreds(storeId);
  if (!creds) throw new Error("Store credentials not found");
  return wooLiveFetchWithCreds<T>(creds, resource, params);
}

export async function wooLiveFetchWithCreds<T>(
  creds: WooStoreCreds,
  resource: "products" | "orders" | "products/categories" | "products/tags",
  params: LiveFetchParams = {}
): Promise<{ data: T[]; total: number; totalPages: number }> {
  const qs = new URLSearchParams();
  const perPage = Math.min(params.per_page ?? 50, 100);
  qs.set("per_page", String(perPage));
  qs.set("page", String(params.page ?? 1));
  if (params.search) qs.set("search", params.search);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.orderby) qs.set("orderby", params.orderby);
  if (params.order) qs.set("order", params.order);
  if (params.category) qs.set("category", params.category);
  if (params.stock_status && params.stock_status !== "all") qs.set("stock_status", params.stock_status);
  if (params.after) qs.set("after", params.after);
  if (params.before) qs.set("before", params.before);
  if (params.min_price) qs.set("min_price", params.min_price);
  if (params.max_price) qs.set("max_price", params.max_price);

  const auth = Buffer.from(`${creds.consumer_key}:${creds.consumer_secret}`).toString("base64");
  const url = `${creds.url.replace(/\/$/, "")}/wp-json/wc/v3/${resource}?${qs.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WooCommerce ${resource} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    const total = parseInt(res.headers.get("x-wp-total") || "0", 10);
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
    const data = (await res.json()) as T[];
    return { data, total, totalPages };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}