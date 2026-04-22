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

export async function uploadWpMedia(storeId: string, file: File, signal?: AbortSignal): Promise<WpMediaItem> {
  const formData = new FormData();
  formData.append("file", file);

  // 90s timeout for large image uploads; abort releases the hung request.
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 90_000);
  const upstream = signal;
  if (upstream) {
    if (upstream.aborted) ctrl.abort();
    else upstream.addEventListener("abort", () => ctrl.abort(), { once: true });
  }

  try {
    const res = await fetch(`/api/stores/${storeId}/wp/media`, {
      method: "POST",
      body: formData,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.error || err.message || `Upload failed (${res.status})`);
      (error as Error & { code?: string }).code = err.code;
      throw error;
    }
    return (await res.json()) as WpMediaItem;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Upload timed out after 90s for "${file.name}"`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}