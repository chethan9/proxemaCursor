import { useEffect, useState } from "react";

const KEY = "cf_debug_badge";
const EVT = "cf-debug-badge-changed";

/** When true, product grid can show a small Cloudflare badge on thumbnails delivered via imagedelivery.net. */
export function useCfDebugBadge(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setOn(typeof window !== "undefined" && localStorage.getItem(KEY) === "1");
      } catch {
        setOn(false);
      }
    };
    read();
    window.addEventListener(EVT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return on;
}

export function setCfDebugBadge(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* ignore */
  }
}
