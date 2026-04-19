export type WpMediaItem = {
  id: number;
  date: string;
  slug: string;
  title: { rendered: string };
  source_url: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url: string; width: number; height: number }>;
  };
  alt_text?: string;
  mime_type?: string;
};

export type WpMediaListResult = {
  data: WpMediaItem[];
  total: number;
  totalPages: number;
};

export async function listWpMedia(
  storeId: string,
  params: { search?: string; page?: number; perPage?: number } = {}
): Promise<WpMediaListResult> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  qs.set("page", String(params.page || 1));
  qs.set("per_page", String(params.perPage || 28));

  const res = await fetch(`/api/stores/${storeId}/wp/media?${qs.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || `Media fetch failed (${res.status})`);
    (error as Error & { code?: string }).code = err.code;
    throw error;
  }
  return (await res.json()) as WpMediaListResult;
}

export async function uploadWpMedia(storeId: string, file: File): Promise<WpMediaItem> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api/stores/${storeId}/wp/media`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.error || err.message || `Upload failed (${res.status})`);
    (error as Error & { code?: string }).code = err.code;
    throw error;
  }
  const data = (await res.json()) as WpMediaItem;
  console.log("uploadWpMedia:", { data });
  return data;
}