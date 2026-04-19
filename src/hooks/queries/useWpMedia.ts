import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listWpMedia, uploadWpMedia, WpMediaItem, WpMediaPage } from "@/services/wpMediaService";

export type { WpMediaItem };

type MediaOptions = { search?: string; per_page?: number; enabled?: boolean };

export function useInfiniteWpMedia(storeId: string, opts: MediaOptions = {}) {
  const { search = "", per_page = 28, enabled = true } = opts;
  return useInfiniteQuery({
    queryKey: ["wp", "media", "infinite", storeId, search, per_page] as const,
    queryFn: ({ pageParam = 1 }) =>
      listWpMedia(storeId, { search, page: pageParam as number, perPage: per_page }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: WpMediaPage) => lastPage.nextPage ?? undefined,
    enabled: enabled && !!storeId,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });
}

export function useUploadWpMedia(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file }: { file: File; alt?: string }) => uploadWpMedia(storeId, file),
    onSuccess: (item: WpMediaItem) => {
      qc.invalidateQueries({ queryKey: ["wp", "media", "infinite", storeId] });
      return item;
    },
  });
}