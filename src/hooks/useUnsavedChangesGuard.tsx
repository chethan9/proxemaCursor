import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MESSAGE = "You have unsaved changes. Leave anyway?";

type GuardProps = {
  dirty: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function UnsavedChangesGuard({
  dirty,
  title = "Unsaved changes",
  description = "You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?",
  confirmLabel = "Discard changes",
  cancelLabel = "Stay on page",
}: GuardProps) {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  const allowNavigateRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = MESSAGE;
      return MESSAGE;
    };

    const onRouteChangeStart = (url: string) => {
      if (!dirtyRef.current) return;
      if (allowNavigateRef.current) return;
      if (router.asPath === url) return;
      setPendingUrl(url);
      setOpen(true);
      router.events.emit("routeChangeError");
      throw new Error("Route change aborted by unsaved changes guard.");
    };

    window.addEventListener("beforeunload", beforeUnload);
    router.events.on("routeChangeStart", onRouteChangeStart);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      router.events.off("routeChangeStart", onRouteChangeStart);
    };
  }, [router]);

  const handleConfirm = useCallback(() => {
    if (!pendingUrl) {
      setOpen(false);
      return;
    }
    allowNavigateRef.current = true;
    setOpen(false);
    const url = pendingUrl;
    setPendingUrl(null);
    setTimeout(() => {
      router.push(url).finally(() => {
        allowNavigateRef.current = false;
      });
    }, 50);
  }, [pendingUrl, router]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    setPendingUrl(null);
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useUnsavedChangesGuard(_enabled: boolean) {
  // Deprecated: use <UnsavedChangesGuard dirty={...} /> component instead.
  // Kept as no-op for backwards compatibility.
  void _enabled;
}

export function confirmIfDirty(dirty: boolean): boolean {
  if (!dirty) return true;
  return window.confirm(MESSAGE);
}