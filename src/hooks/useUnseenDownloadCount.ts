import { useEffect, useMemo, useState } from "react";
import { useSiteDownloads } from "@/hooks/queries/useSiteDownloads";
import {
  countUnacknowledgedArtifacts,
  DOWNLOADS_ARTIFACTS_ACK_STORAGE_KEY,
} from "@/lib/downloads-artifacts-ack";

/** Sidebar badge: completed bulk artifacts not yet acknowledged (visit Downloads or download). */
export function useUnseenDownloadCount(storeId: string | undefined) {
  const { data: files = [] } = useSiteDownloads(storeId);
  const [ackEpoch, setAckEpoch] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setAckEpoch((n) => n + 1);
    const onAck = () => bump();
    const onStorage = (e: StorageEvent) => {
      if (e.key === DOWNLOADS_ARTIFACTS_ACK_STORAGE_KEY) bump();
    };
    window.addEventListener("downloads-artifacts-ack", onAck);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("downloads-artifacts-ack", onAck);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return useMemo(() => {
    void ackEpoch;
    if (!storeId) return 0;
    const ids = files.map((f) => f.id).filter(Boolean);
    return countUnacknowledgedArtifacts(storeId, ids);
  }, [storeId, files, ackEpoch]);
}
