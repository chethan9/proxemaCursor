// WooCommerce App Authentication Helper
// Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication-over-http

export interface WooAuthParams {
  storeUrl: string;
  storeId: string;
  appName?: string;
  scope?: "read" | "write" | "read_write";
}

/**
 * Cleans a store URL to extract only the base domain
 * Examples:
 *   https://new.vizsoft.in/wp-admin → https://new.vizsoft.in
 *   new.vizsoft.in/shop/products → https://new.vizsoft.in
 *   http://store.com/wp-admin/settings → http://store.com
 */
export function cleanStoreUrl(url: string): string {
  let cleaned = url.trim();
  
  // Add protocol if missing
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned}`;
  }
  
  try {
    const parsed = new URL(cleaned);
    // Return only protocol + host (strips all paths, query params, hash)
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    // If parsing fails, try basic string cleanup
    cleaned = cleaned.replace(/\/(wp-admin|shop|my-account|cart|checkout|product|products|wp-login\.php).*$/i, "");
    cleaned = cleaned.replace(/\/+$/, ""); // Remove trailing slashes
    return cleaned;
  }
}

export function buildWooCommerceAuthUrl({
  storeUrl,
  storeId,
  appName = "WooSync",
  scope = "read_write",
}: WooAuthParams): string {
  // Clean and normalize store URL
  const normalizedUrl = cleanStoreUrl(storeUrl);

  // Get the base URL for callbacks
  const baseUrl = typeof window !== "undefined" 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // WooCommerce callback URL (receives credentials via POST)
  const callbackUrl = `${baseUrl}/api/woocommerce/callback`;
  
  // Return URL (user redirected here after approval)
  const returnUrl = `${baseUrl}/sites/connect/${storeId}?success=1`;

  // Build the WooCommerce auth endpoint URL
  const authEndpoint = `${normalizedUrl}/wc-auth/v1/authorize`;
  
  const params = new URLSearchParams({
    app_name: appName,
    scope: scope,
    user_id: storeId, // We pass our store ID so callback knows which store to update
    return_url: returnUrl,
    callback_url: callbackUrl,
  });

  return `${authEndpoint}?${params.toString()}`;
}

export function validateStoreUrl(url: string): { valid: boolean; error?: string; cleanedUrl?: string } {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: "Store URL is required" };
  }

  const cleaned = cleanStoreUrl(url);

  try {
    const parsed = new URL(cleaned);
    if (!parsed.hostname.includes(".")) {
      return { valid: false, error: "Invalid domain" };
    }
    return { valid: true, cleanedUrl: cleaned };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

export function buildWpAppPasswordUrl({
  storeUrl,
  storeId,
  appName = "WooSync Media",
}: {
  storeUrl: string;
  storeId: string;
  appName?: string;
}): string {
  const normalizedUrl = cleanStoreUrl(storeUrl);
  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const successUrl = `${baseUrl}/api/wordpress/app-password-callback`;
  const rejectUrl = `${successUrl}?rejected=1&state=${encodeURIComponent(storeId)}`;
  const params = new URLSearchParams({
    app_name: appName,
    success_url: successUrl,
    reject_url: rejectUrl,
    state: storeId,
  });
  return `${normalizedUrl}/wp-admin/authorize-application.php?${params.toString()}`;
}