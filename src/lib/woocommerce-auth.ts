// WooCommerce App Authentication Helper
// Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication-over-http

export interface WooAuthParams {
  storeUrl: string;
  storeId: string;
  appName?: string;
  scope?: "read" | "write" | "read_write";
}

export function buildWooCommerceAuthUrl({
  storeUrl,
  storeId,
  appName = "WooSync",
  scope = "read_write",
}: WooAuthParams): string {
  // Normalize store URL
  let normalizedUrl = storeUrl.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  // Remove trailing slash
  normalizedUrl = normalizedUrl.replace(/\/$/, "");

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

export function validateStoreUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: "Store URL is required" };
  }

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const parsed = new URL(normalizedUrl);
    if (!parsed.hostname.includes(".")) {
      return { valid: false, error: "Invalid domain" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}