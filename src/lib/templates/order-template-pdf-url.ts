/**
 * URL for rendering an order invoice/pick-slip PDF. Includes a cache-buster so the browser
 * never reuses a stale PDF when order data or templates change (same path used to open in a new tab).
 */
export function buildOrderTemplatePdfUrl(templateId: string, storeId: string, orderId: string): string {
  const q = new URLSearchParams({
    format: "pdf",
    store_id: storeId,
    order_id: orderId,
    _: String(Date.now()),
  });
  return `/api/templates/${encodeURIComponent(templateId)}/render?${q.toString()}`;
}
