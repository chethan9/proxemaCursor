import Handlebars from "handlebars";

/** Safe PDF filename from optional pattern; falls back to template name + entity id. */
export function renderPdfFilename(
  pattern: string | undefined,
  context: Record<string, unknown>,
  fallbackBase: string,
  entityId: string,
): string {
  const base = fallbackBase.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "document";
  if (!pattern?.trim()) return `${base}-${entityId}.pdf`;
  try {
    const t = Handlebars.compile(pattern, { noEscape: true, strict: false });
    const name = t(context);
    const safe = name
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    if (!safe) return `${base}-${entityId}.pdf`;
    return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  } catch {
    return `${base}-${entityId}.pdf`;
  }
}
