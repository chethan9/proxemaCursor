import { isValidEmail } from "@/lib/email-validation";

export type CustomerWooPatch = {
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
  billing?: Record<string, unknown>;
  shipping?: Record<string, unknown>;
};

/**
 * WooCommerce validates billing.email on its own. Sync from account email when billing email
 * is missing, whitespace-only, or malformed (common after partial edits or bad sync data).
 */
export function normalizeCustomerWooPatch(patch: CustomerWooPatch): CustomerWooPatch {
  const accountEmail = patch.email?.trim();
  const out: CustomerWooPatch = { ...patch };

  if (out.billing && typeof out.billing === "object" && !Array.isArray(out.billing)) {
    const b = { ...out.billing };
    const rawBe = b.email;
    const be = typeof rawBe === "string" ? rawBe.trim() : String(rawBe ?? "").trim();

    if (isValidEmail(accountEmail)) {
      if (!isValidEmail(be)) {
        b.email = accountEmail;
      }
    } else if (be && !isValidEmail(be)) {
      delete b.email;
    }

    out.billing = b;
  }

  return out;
}
