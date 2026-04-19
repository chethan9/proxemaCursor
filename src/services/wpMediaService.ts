export type WpMediaItem = {
  id: number;
  source_url: string;
  thumbnail_url: string;
  alt: string;
  title: string;
  mime_type: string;
  date: string;
};

export type WpMediaPage = {
  data: WpMediaItem[];
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  nextPage: number | null;
};

export async function listWpMedia(
  storeId: string,
  params: { search?: string; page?: number; perPage?: number } = {}
): Promise<WpMediaPage> {
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
  return (await res.json()) as WpMediaPage;
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
  return (await res.json()) as WpMediaItem;
}