/** Persist which bulk-job download artifacts the user has opened or downloaded (per store). */

export const DOWNLOADS_ARTIFACTS_ACK_STORAGE_KEY = "downloads-artifacts-ack-v1";

type StoreAckMap = Record<string, string[]>;

function readMap(): StoreAckMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DOWNLOADS_ARTIFACTS_ACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoreAckMap;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: StoreAckMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DOWNLOADS_ARTIFACTS_ACK_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

function emitAck(storeId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("downloads-artifacts-ack", { detail: { storeId } }));
}

export function getAcknowledgedArtifactIds(storeId: string): Set<string> {
  const map = readMap();
  const ids = map[storeId];
  return new Set(Array.isArray(ids) ? ids : []);
}

/** Mark artifact job IDs as seen (visited Downloads or downloaded file). */
export function acknowledgeDownloadArtifacts(storeId: string, artifactJobIds: string[]): void {
  if (typeof window === "undefined" || artifactJobIds.length === 0) return;
  const map = readMap();
  const cur = new Set(map[storeId] || []);
  for (const id of artifactJobIds) {
    if (id) cur.add(id);
  }
  map[storeId] = Array.from(cur);
  writeMap(map);
  emitAck(storeId);
}

export function countUnacknowledgedArtifacts(storeId: string, artifactJobIds: string[]): number {
  if (artifactJobIds.length === 0) return 0;
  const ack = getAcknowledgedArtifactIds(storeId);
  return artifactJobIds.filter((id) => id && !ack.has(id)).length;
}
