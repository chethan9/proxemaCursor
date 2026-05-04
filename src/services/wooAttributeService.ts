import { authorizedFetch } from "@/lib/api-client";

export type WooAttribute = {
  id: number;
  name: string;
  slug: string;
  type: string;
  order_by: string;
  has_archives: boolean;
};

export type WooAttributeTerm = {
  id: number;
  name: string;
  slug: string;
  description: string;
  menu_order: number;
  count: number;
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listAttributes(storeId: string): Promise<WooAttribute[]> {
  const res = await authorizedFetch(`/api/stores/${storeId}/wc/attributes`);
  return handle<WooAttribute[]>(res);
}

export async function createAttribute(
  storeId: string,
  payload: { name: string; slug?: string; type?: string; order_by?: string; has_archives?: boolean }
): Promise<WooAttribute> {
  const res = await authorizedFetch(`/api/stores/${storeId}/wc/attributes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<WooAttribute>(res);
  console.log("createAttribute:", { data });
  return data;
}

export async function listAttributeTerms(storeId: string, attributeId: number): Promise<WooAttributeTerm[]> {
  const res = await authorizedFetch(`/api/stores/${storeId}/wc/attributes/${attributeId}/terms`);
  return handle<WooAttributeTerm[]>(res);
}

export async function createAttributeTerm(
  storeId: string,
  attributeId: number,
  payload: { name: string; slug?: string; description?: string }
): Promise<WooAttributeTerm> {
  const res = await authorizedFetch(`/api/stores/${storeId}/wc/attributes/${attributeId}/terms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<WooAttributeTerm>(res);
  console.log("createAttributeTerm:", { data });
  return data;
}

export async function deleteAttributeTerm(storeId: string, attributeId: number, termId: number): Promise<void> {
  const res = await authorizedFetch(`/api/stores/${storeId}/wc/attributes/${attributeId}/terms`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ termId }),
  });
  await handle(res);
}