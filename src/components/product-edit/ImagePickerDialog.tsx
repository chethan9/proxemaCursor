import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useInfiniteWpMedia, useUploadWpMedia, type WpMediaItem } from "@/hooks/queries/useWpMedia";
import { cn } from "@/lib/utils";
import { Search, Upload, ImageOff, Loader2, AlertCircle, Settings } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export type SelectedImage = { id: number; src: string; alt: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  mode?: "single" | "multi";
  maxSelection?: number;
  initialSelectedIds?: number[];
  onConfirm: (images: SelectedImage[]) => void;
  title?: string;
};

export function ImagePickerDialog({
  open,
  onOpenChange,
  storeId,
  mode = "multi",
  maxSelection,
  initialSelectedIds = [],
  onConfirm,
  title = "Select Images",
}: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Map<number, WpMediaItem>>(new Map());
  const [justUploadedIds, setJustUploadedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteWpMedia(storeId, { search: debouncedSearch, per_page: 28, enabled: open });

  const upload = useUploadWpMedia(storeId);

  const items = useMemo<WpMediaItem[]>(() => {
    if (!data) return [];
    const flat = data.pages.flatMap((p) => p.data);
    const seen = new Set<number>();
    return flat.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
  }, [data]);

  const wpMissing = useMemo(() => {
    const msg = error instanceof Error ? error.message : "";
    return /wp credentials/i.test(msg) || /missing wp/i.test(msg) || /412/.test(msg);
  }, [error]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, open]);

  useEffect(() => {
    if (!open) {
      setSelected(new Map());
      setJustUploadedIds(new Set());
      setSearch("");
      setDebouncedSearch("");
    }
  }, [open]);

  useEffect(() => {
    if (open && initialSelectedIds.length && items.length && selected.size === 0) {
      const sel = new Map<number, WpMediaItem>();
      for (const id of initialSelectedIds) {
        const it = items.find((i) => i.id === id);
        if (it) sel.set(id, it);
      }
      if (sel.size) setSelected(sel);
    }
  }, [open, initialSelectedIds, items, selected.size]);

  const toggleItem = (item: WpMediaItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        if (mode === "single") {
          next.clear();
          next.set(item.id, item);
        } else {
          if (maxSelection && next.size >= maxSelection) return prev;
          next.set(item.id, item);
        }
      }
      return next;
    });
  };

  const selectAll = () => {
    if (mode === "single") return;
    setSelected((prev) => {
      if (prev.size === items.length) return new Map();
      const next = new Map<number, WpMediaItem>();
      for (const it of items) {
        if (maxSelection && next.size >= maxSelection) break;
        next.set(it.id, it);
      }
      return next;
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploadedIds: number[] = [];
    const failures: { name: string; reason: string }[] = [];
    for (const file of Array.from(files)) {
      try {
        const res = await upload.mutateAsync({ file, alt: file.name });
        uploadedIds.push(res.id);
      } catch (e) {
        const reason = e instanceof Error ? e.message : "Unknown error";
        console.error("Upload failed", file.name, e);
        failures.push({ name: file.name, reason });
      }
    }
    if (uploadedIds.length) {
      setJustUploadedIds(new Set(uploadedIds));
      setTimeout(() => setJustUploadedIds(new Set()), 3000);
    }
    if (failures.length) {
      toast({
        title: uploadedIds.length ? `${uploadedIds.length} uploaded · ${failures.length} failed` : `Upload failed (${failures.length})`,
        description: failures.slice(0, 3).map((f) => `${f.name}: ${f.reason}`).join(" · "),
        variant: "destructive",
      });
    } else if (uploadedIds.length) {
      toast({ title: `Uploaded ${uploadedIds.length} ${uploadedIds.length === 1 ? "image" : "images"}` });
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      fetchNextPage();
    }
  };

  const handleConfirm = () => {
    const images: SelectedImage[] = Array.from(selected.values()).map((it) => ({
      id: it.id,
      src: it.source_url,
      alt: it.alt || it.title,
      name: it.title,
    }));
    onConfirm(images);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-lg">{title}</DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type name to search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-full bg-muted/50 border-0"
              />
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="h-10 rounded-full px-5 bg-foreground text-background hover:bg-foreground/90"
              disabled={upload.isPending}
            >
              {upload.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload New
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto px-6 py-4"
        >
          {wpMissing && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <AlertCircle className="h-10 w-10 text-warning" />
              <div>
                <div className="font-semibold">WordPress credentials missing</div>
                <div className="text-sm text-muted-foreground mt-1 max-w-md">
                  To browse and upload images, connect your WordPress account via site settings.
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/sites/${storeId}/settings`}>
                  <Settings className="h-4 w-4 mr-2" />
                  Open site settings
                </Link>
              </Button>
            </div>
          )}

          {!wpMissing && isError && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Failed to load media"}
              </div>
            </div>
          )}

          {!wpMissing && !isError && items.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <ImageOff className="h-10 w-10 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">No images yet. Upload to get started.</div>
            </div>
          )}

          {!wpMissing && items.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
              {items.map((item) => {
                const isSelected = selected.has(item.id);
                const isNew = justUploadedIds.has(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all group",
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/30",
                      isNew && "ring-2 ring-warning animate-pulse"
                    )}
                  >
                    <img
                      src={item.thumbnail_url}
                      alt={item.alt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div
                      className={cn(
                        "absolute top-1.5 right-1.5 h-5 w-5 rounded border-2 flex items-center justify-center bg-background/90 transition-opacity",
                        isSelected ? "opacity-100 border-primary" : "opacity-0 group-hover:opacity-100 border-muted-foreground"
                      )}
                    >
                      {isSelected && <div className="h-2.5 w-2.5 rounded-sm bg-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {(isLoading || isFetchingNextPage) && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!hasNextPage && items.length > 0 && !isLoading && (
            <div className="text-center text-xs text-muted-foreground py-4">
              {items.length} {items.length === 1 ? "image" : "images"} total
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            {mode === "multi" && items.length > 0 && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selected.size === items.length && items.length > 0}
                  onCheckedChange={selectAll}
                />
                Select All ({items.length} loaded)
              </label>
            )}
            {selected.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {selected.size} {selected.size === 1 ? "image" : "images"} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Add to album
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}