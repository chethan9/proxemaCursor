import type { TFunction } from "i18next";

/** Map WooCommerce `order.status` string to `orders.statuses.*` key in `site` namespace. */
const WOO_STATUS_TO_KEY: Record<
  string,
  "pending" | "processing" | "onHold" | "completed" | "cancelled" | "refunded" | "failed" | "draft" | "trash" | "unknown"
> = {
  pending: "pending",
  processing: "processing",
  "on-hold": "onHold",
  completed: "completed",
  cancelled: "cancelled",
  refunded: "refunded",
  failed: "failed",
  draft: "draft",
  trash: "trash",
};

/**
 * Localized label for a WooCommerce order status (home cards, order lists, etc.).
 */
export function translateOrderStatus(status: string | null | undefined, t: TFunction): string {
  const raw = (status || "").trim();
  if (!raw) return "—";
  const key = WOO_STATUS_TO_KEY[raw.toLowerCase()] ?? "unknown";
  return t(`orders.statuses.${key}`, {
    defaultValue: raw.replace(/-/g, " "),
  });
}
