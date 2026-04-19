import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listWpMedia, uploadWpMedia, WpMediaItem } from "@/services/wpMediaService";

export function useWpMedia(storeId: string, search: string, page: number, perPage = 28) {
  return useQuery({
    queryKey: ["wp", "media", storeId, search, page, perPage] as const,
    queryFn: () => listWpMedia(storeId, { search, page, perPage }),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useUploadWpMedia(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadWpMedia(storeId, file),
    onSuccess: (item: WpMediaItem) => {
      qc.invalidateQueries({ queryKey: ["wp", "media", storeId] });
      return item;
    },
  });
}