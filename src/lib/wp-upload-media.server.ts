import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWooUserAgent } from "@/lib/brand-name-server";

async function getWpCreds(storeId: string) {
  const { data } = await supabaseAdmin
    .from("stores")
    .select("url, wp_username, wp_app_password")
    .eq("id", storeId)
    .maybeSingle();
  if (!data?.wp_username || !data?.wp_app_password) return null;
  return { url: data.url.replace(/\/$/, ""), user: data.wp_username, pass: data.wp_app_password };
}

export type WpUploadedMedia = {
  id: number;
  source_url: string;
  thumbnail_url: string;
  alt: string;
  title: string;
  mime_type: string;
};

type RawMedia = {
  id: number;
  date: string;
  slug: string;
  title?: { rendered?: string };
  source_url: string;
  alt_text?: string;
  mime_type?: string;
  media_details?: { sizes?: Record<string, { source_url?: string }> };
};

function slim(m: RawMedia): WpUploadedMedia {
  const sizes = m.media_details?.sizes || {};
  const thumb =
    sizes.thumbnail?.source_url ||
    sizes.medium?.source_url ||
    sizes.woocommerce_thumbnail?.source_url ||
    m.source_url;
  return {
    id: m.id,
    source_url: m.source_url,
    thumbnail_url: thumb,
    alt: m.alt_text || "",
    title: m.title?.rendered || m.slug || "",
    mime_type: m.mime_type || "image/jpeg",
  };
}

/** Upload image bytes to WooCommerce Media library for a store. */
export async function uploadImageBufferToWp(
  storeId: string,
  buffer: Buffer,
  filename: string,
  mime: string
): Promise<{ ok: true; media: WpUploadedMedia } | { ok: false; error: string }> {
  const creds = await getWpCreds(storeId);
  if (!creds) return { ok: false, error: "WordPress credentials not configured" };

  const authHeader = "Basic " + Buffer.from(`${creds.user}:${creds.pass}`).toString("base64");
  const ua = await getWooUserAgent();

  const r = await fetch(`${creds.url}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "User-Agent": ua,
    },
    body: buffer,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: (json as { message?: string })?.message || r.statusText };
  return { ok: true, media: slim(json as RawMedia) };
}
