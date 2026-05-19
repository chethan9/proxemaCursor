/**
 * HTTP header values (including `Content-Disposition` filenames) must be ByteString (Latin-1).
 * `fetch()` throws when a header contains code points > 255 — common with “smart” punctuation
 * (e.g. en dash U+2013) in user file names.
 *
 * Returns an ASCII-only filename safe for `attachment; filename="..."`, preserving a sensible extension.
 */
export function asciiFilenameForContentDisposition(original: string, fallbackBase = "upload"): string {
  const strippedPath = (original || "").trim().replace(/\\/g, "/").split("/").pop()?.trim() || "";
  const raw = strippedPath || `${fallbackBase}.jpg`;

  const lastDot = raw.lastIndexOf(".");
  const hasExt = lastDot > 0 && lastDot < raw.length - 1;
  const extRaw = hasExt ? raw.slice(lastDot + 1) : "";
  const baseRaw = hasExt ? raw.slice(0, lastDot) : raw;

  const mapped = (baseRaw || fallbackBase)
    .replace(/\u2013|\u2014|\u2212|\uFE58|\uFE63|\uFF0D/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  let safeBase = mapped
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\:*?|<>/]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/\.+$/g, "");

  if (!safeBase) safeBase = fallbackBase;

  if (!hasExt) return safeBase;

  const extClean = extRaw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 8);

  const ext = extClean || "jpg";
  return `${safeBase}.${ext}`;
}
