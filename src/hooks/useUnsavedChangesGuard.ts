import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

const MESSAGE = "You have unsaved changes. Leave anyway?";

export function useUnsavedChangesGuard(enabled: boolean) {
  const router = useRouter();
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!enabledRef.current) return;
      e.preventDefault();
      e.returnValue = MESSAGE;
      return MESSAGE;
    };

    const onRouteChangeStart = (url: string) => {
      if (!enabledRef.current) return;
      if (router.asPath === url) return;
      const ok = window.confirm(MESSAGE);
      if (!ok) {
        router.events.emit("routeChangeError");
        throw "Route change aborted by unsaved changes guard.";
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    router.events.on("routeChangeStart", onRouteChangeStart);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      router.events.off("routeChangeStart", onRouteChangeStart);
    };
  }, [router]);
}

export function confirmIfDirty(dirty: boolean): boolean {
  if (!dirty) return true;
  return window.confirm("You have unsaved changes. Leave anyway?");
}