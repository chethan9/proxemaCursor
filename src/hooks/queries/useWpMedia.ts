import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWpMedia, uploadWpMedia, WpMediaItem } from "@/services/wpMediaService";

export type { WpMediaItem };

type MediaOptions = { search?: string; page?: number; per_page?: number; enabled?: boolean };

export function useWpMedia(storeId: string, opts: MediaOptions = {}) {
  const { search = "", page = 1, per_page = 28, enabled = true } = opts;
  return useQuery({
    queryKey: ["wp", "media", storeId, search, page, per_page] as const,
    queryFn: async () => {
      const res = await listWpMedia(storeId, { search, page, perPage: per_page });
      return res.data;
    },
    enabled: enabled && !!storeId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useUploadWpMedia(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file }: { file: File; alt?: string }) => uploadWpMedia(storeId, file),
    onSuccess: (item: WpMediaItem) => {
      qc.invalidateQueries({ queryKey: ["wp", "media", storeId] });
      return item;
    },
  });
}