"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import FilerobotImageEditor, {
  TABS,
  TOOLS,
  type FilerobotImageEditorConfig,
} from "react-filerobot-image-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizeProductImageSrc } from "@/lib/product-image-urls";
import { uploadWpMedia } from "@/services/wpMediaService";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "react-error-boundary";
import shellStyles from "./product-image-editor-shell.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  /** Current image (featured or gallery slot). */
  src: string;
  alt?: string;
  /** Called after a successful WP upload with the new media row. */
  onApply: (next: { id: number; src: string; alt: string }) => void;
};

type SavedImagePayload = Parameters<
  NonNullable<FilerobotImageEditorConfig["onSave"]>
>[0];

function extensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "jpg";
}

/** Turns Filerobot export payload into a File for multipart upload. */
async function savedImagePayloadToFile(data: SavedImagePayload): Promise<File> {
  const ext =
    (data.extension && String(data.extension).replace(/^\./, "")) ||
    extensionFromMime(data.mimeType || "image/jpeg");
  const mime =
    data.mimeType ||
    (ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`);
  const baseName = (data.name && data.name.replace(/\.[^/.]+$/, "")) || "product-image";
  const filename = data.fullName || `${baseName}.${ext}`;

  if (data.imageCanvas) {
    const canvas = data.imageCanvas;
    const quality = typeof data.quality === "number" ? data.quality : 0.92;
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob returned empty"));
            return;
          }
          resolve(new File([blob], filename, { type: mime }));
        },
        mime,
        /^image\/jpe?g$|^image\/webp$/i.test(mime) ? quality : undefined,
      );
    });
  }

  const raw = data.imageBase64;
  if (!raw || typeof raw !== "string") {
    throw new Error("Editor returned no image bytes");
  }

  const dataUrl = raw.startsWith("data:") ? raw : `data:${mime};base64,${raw}`;
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1).trim() : raw.trim();
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

const VIEW_EDGE = 16;
/**
 * Square workspace target so any aspect ratio fits with zoom; matches common editor sizing.
 * Width adds room for Filerobot’s left tab rail; height adds internal top/bottom bars.
 */
const WORKSPACE_SQUARE_PX = 1024;
/** Sidebar + horizontal gutters so Adjust → Resize tabs fit comfortably. */
const LEFT_RAIL_ALLOWANCE_PX = 112;
/** Filerobot top bar (save, zoom…) + bottom tool strip. */
const FIE_VERTICAL_CHROME_PX = 172;

type EditorShellLayout = {
  dialogWidthPx: number;
  shellHeightPx: number;
};

/** Fixed ~1024² editing viewport (clamped to screen); image aspect is handled inside the editor. */
function computeEditorShellLayout(vw: number, vh: number): EditorShellLayout {
  const safeVw = Math.max(360, vw);
  const safeVh = Math.max(480, vh);

  const dialogWidthPx = Math.round(
    Math.min(WORKSPACE_SQUARE_PX + LEFT_RAIL_ALLOWANCE_PX, safeVw - VIEW_EDGE),
  );

  const shellHeightPx = Math.round(
    Math.min(WORKSPACE_SQUARE_PX + FIE_VERTICAL_CHROME_PX, safeVh - VIEW_EDGE),
  );

  return {
    dialogWidthPx: Math.max(520, dialogWidthPx),
    shellHeightPx: Math.max(400, shellHeightPx),
  };
}

export function ProductImageEditorDialog({ open, onOpenChange, storeId, src, alt = "", onApply }: Props) {
  const { t } = useTranslation("site");
  const { toast } = useToast();

  const trimmedSrc = typeof src === "string" ? src.trim() : "";

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<{ message: string; detail?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const revokeRef = useRef<string | null>(null);
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1280, h: 900 },
  );

  const shellLayout = useMemo((): EditorShellLayout => {
    const { w: vw, h: vh } = viewport;
    return computeEditorShellLayout(vw, vh);
  }, [viewport]);

  const editorConfig = useMemo((): Omit<FilerobotImageEditorConfig, "source" | "onSave" | "onClose"> => {
    const preview =
      typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 2;
    return {
      /** Same order as Scaleflex “pro” layout: Adjust → … → Resize */
      tabsIds: [
        TABS.ADJUST,
        TABS.FINETUNE,
        TABS.FILTERS,
        TABS.WATERMARK,
        TABS.ANNOTATE,
        TABS.RESIZE,
      ],
      defaultTabId: TABS.ADJUST,
      /** Opens Adjust with crop handles + bottom Crop / Rotate / Flip strip like the reference */
      defaultToolId: TOOLS.CROP,
      useBackendTranslations: false,
      language: "en",
      closeAfterSave: true,
      avoidChangesNotSavedAlertOnLeave: true,
      showBackButton: false,
      useZoomPresetsMenu: true,
      /** Lets Adjust / Resize toolbars measure correctly after tab changes (required for aligned inputs). */
      observePluginContainerSize: true,
      savingPixelRatio: 2,
      previewPixelRatio: preview,
      defaultSavedImageType: "jpeg",
      defaultSavedImageQuality: 0.92,
      /** Light gray canvas pad behind the image (reference UI) */
      previewBgColor: "#eef2f7",
      theme: {
        typography: {
          fontFamily: "'Roboto', ui-sans-serif, system-ui, sans-serif",
        },
        palette: {
          "bg-primary": "#ffffff",
          "bg-secondary": "#f8fafc",
          "bg-primary-active": "#eff6ff",
          "accent-primary": "#2563eb",
          "accent-primary-active": "#1d4ed8",
          "icons-primary": "#0f172a",
          "icons-secondary": "#64748b",
          "borders-secondary": "#e2e8f0",
          "borders-primary": "#cbd5e1",
          "borders-strong": "#94a3b8",
          "light-shadow": "rgba(15, 23, 42, 0.06)",
          warning: "#f59e0b",
        },
      },
    };
  }, []);

  useEffect(() => {
    if (!open || !trimmedSrc) return;

    let cancelled = false;
    setImageLoadError(null);
    setLoading(true);

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setImageLoadError({ message: t("products.edit.imageEditor.loadFailed") });
          setLoading(false);
          return;
        }
        const u = normalizeProductImageSrc(trimmedSrc);
        const proxy = `/api/stores/${storeId}/image-proxy?url=${encodeURIComponent(u)}`;
        const r = await fetch(proxy, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) {
          let detail: string | undefined;
          try {
            const j = (await r.clone().json()) as { error?: string; upstreamStatus?: number };
            if (typeof j?.error === "string") detail = j.error;
            if (typeof j?.upstreamStatus === "number") {
              detail = detail ? `${detail} (HTTP ${j.upstreamStatus})` : `HTTP ${j.upstreamStatus}`;
            }
          } catch {
            /* non-JSON body */
          }
          const base = t("products.edit.imageEditor.loadFailed");
          setImageLoadError({ message: base, detail });
          if (detail) {
            toast({ title: base, description: detail, variant: "destructive" });
          }
          setLoading(false);
          return;
        }
        const blob = await r.blob();
        if (cancelled) return;
        if (revokeRef.current) {
          URL.revokeObjectURL(revokeRef.current);
          revokeRef.current = null;
        }
        const ou = URL.createObjectURL(blob);
        revokeRef.current = ou;
        setObjectUrl(ou);
      } catch {
        if (!cancelled) setImageLoadError({ message: t("products.edit.imageEditor.loadFailed") });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, trimmedSrc, storeId, t, toast]);

  useEffect(() => {
    if (!open) {
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
      setObjectUrl(null);
    }
  }, [open]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const showLoader = !!trimmedSrc && !imageLoadError && (loading || !objectUrl);

  const handleSave = useCallback(
    async (savedImageData: SavedImagePayload) => {
      try {
        const file = await savedImagePayloadToFile(savedImageData);
        const item = await uploadWpMedia(storeId, file);
        onApply({ id: item.id, src: item.source_url, alt: alt || item.alt || "" });
        toast({ title: t("products.edit.imageEditor.saved") });
      } catch (e) {
        toast({
          title: t("products.edit.imageEditor.uploadFailed"),
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
        throw e;
      }
    },
    [storeId, alt, onApply, t, toast],
  );

  const handleEditorClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        overlayClassName="z-[100]"
        className={cn(
          "!flex max-h-[min(96vh,1196px)] flex-col gap-0 overflow-hidden border-slate-200/90 bg-white p-0 shadow-xl",
          "min-h-0 z-[101] !w-auto max-w-none",
        )}
        style={{
          width: `min(${shellLayout.dialogWidthPx}px, calc(100vw - 1rem))`,
          maxWidth: `min(${shellLayout.dialogWidthPx}px, calc(100vw - 1rem))`,
        }}
      >
        <div className="relative z-[110] flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("products.edit.imageEditor.title")}</DialogTitle>
            <DialogDescription>{t("products.edit.imageEditor.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <span className="truncate text-sm font-medium text-slate-800">{t("products.edit.imageEditor.title")}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-slate-600 hover:text-slate-900"
            onClick={() => onOpenChange(false)}
            aria-label={t("products.edit.imageEditor.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!trimmedSrc && (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            {t("products.edit.imageEditor.noImageSelected")}
          </div>
        )}

        {trimmedSrc && showLoader && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("products.edit.imageEditor.loading")}
          </div>
        )}

        {trimmedSrc && imageLoadError && !showLoader && (
          <div className="space-y-1 px-4 py-6">
            <p className="text-sm text-destructive">{imageLoadError.message}</p>
            {imageLoadError.detail && (
              <p className="text-xs text-muted-foreground break-all">{imageLoadError.detail}</p>
            )}
          </div>
        )}

        {trimmedSrc && !showLoader && !imageLoadError && objectUrl && (
          <div
            className={cn(
              shellStyles.shell,
              "relative w-full overflow-y-auto overflow-x-hidden rounded-lg bg-[#e9eef5] overscroll-contain",
              "min-h-[280px]",
            )}
            style={{
              height: shellLayout.shellHeightPx,
              maxHeight: "min(calc(100vh - 2rem), 1196px)",
            }}
          >
            <ErrorBoundary
              fallbackRender={({ error }) => (
                <div className="space-y-2 px-4 py-6 text-sm">
                  <p className="font-medium text-destructive">
                    {t("products.edit.imageEditor.editorCrashed")}
                  </p>
                  <p className="text-muted-foreground break-all">
                    {error instanceof Error ? error.message : String(error)}
                  </p>
                </div>
              )}
            >
              <FilerobotImageEditor
                key={objectUrl}
                {...editorConfig}
                source={objectUrl}
                onSave={handleSave}
                onClose={handleEditorClose}
              />
            </ErrorBoundary>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
