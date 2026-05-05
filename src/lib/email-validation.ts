/** Pragmatic check for WooCommerce / REST email fields (requires local-part @ domain.tld). */
export function isValidEmail(s: string | undefined | null): boolean {
  const t = (s ?? "").trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}
