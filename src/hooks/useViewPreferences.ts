import { useEffect, useRef, useState, useCallback } from "react";
import { fetchPreferences, savePreferences, type ViewPreferences } from "@/services/viewPreferencesService";

export function useViewPreferences<T extends ViewPreferences>(viewKey: string, defaults: T) {
  const storageKey = `view-pref:${viewKey}`;
  const [prefs, setPrefs] = useState<T>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return defaults;
  });
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (!local) {
        const remote = await fetchPreferences(viewKey);
        if (!cancelled && remote) {
          setPrefs((cur) => ({ ...cur, ...(remote as Partial<T>) }));
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [viewKey, storageKey]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (typeof window === "undefined") return;
    try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch { /* ignore */ }
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePreferences(viewKey, prefs).catch(() => { /* ignore */ });
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [prefs, storageKey, viewKey, hydrated]);

  const update = useCallback((patch: Partial<T> | ((cur: T) => Partial<T>)) => {
    setPrefs((cur) => ({ ...cur, ...(typeof patch === "function" ? patch(cur) : patch) }));
  }, []);

  return { prefs, update, setPrefs, hydrated };
}