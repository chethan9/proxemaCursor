import Handlebars from "handlebars";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ASCII-safe single segment for filenames (no path separators). */
export function slugifyFilenameSegment(raw: string, maxLen = 96): string {
  const s = raw
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
  return s || "file";
}

/** Store / site names for bulk download prefixes. */
export function slugifyStoreNameForFile(storeName: string): string {
  return slugifyFilenameSegment(storeName.replace(/\.+$/g, "").trim(), 48);
}

function slugifyTemplateBase(fallbackBase: string): string {
  return fallbackBase.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "document";
}

function shortEntitySuffix(entityId: string): string {
  if (UUID_RE.test(entityId)) return entityId.slice(0, 8);
  return slugifyFilenameSegment(entityId, 24);
}

function inferDefaultPdfFilename(
  context: Record<string, unknown>,
  fallbackBase: string,
  entityId: string,
  templateType?: string,
): string {
  const base = slugifyTemplateBase(fallbackBase);
  const t = (templateType || "").toLowerCase();

  const order = context.order as Record<string, unknown> | undefined;
  if (order && typeof order === "object") {
    const ref =
      String(order.invoice_number ?? "").trim() ||
      String(order.woo_order_id ?? "").trim() ||
      String(order.number ?? "").trim();
    const safeRef = ref ? slugifyFilenameSegment(ref) : shortEntitySuffix(entityId);
    const prefix = t === "pickslip" || t === "pick_slip" ? "pick-slip" : "invoice";
    return `${prefix}-${safeRef}.pdf`;
  }

  const report = context.report as Record<string, unknown> | undefined;
  if (report && typeof report === "object") {
    const title = slugifyFilenameSegment(String(report.title || "report"));
    const ga = String(report.generated_at || "");
    const d = ga ? new Date(ga) : new Date();
    const dateStr = !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    return `${title}-${dateStr}.pdf`;
  }

  if (entityId === "sample") {
    return `${base}-preview.pdf`;
  }

  return `${base}-${shortEntitySuffix(entityId)}.pdf`;
}

/** Safe PDF filename from optional pattern; falls back to invoice/report-aware defaults (not raw UUIDs). */
export function renderPdfFilename(
  pattern: string | undefined,
  context: Record<string, unknown>,
  fallbackBase: string,
  entityId: string,
  templateType?: string,
): string {
  if (!pattern?.trim()) {
    return inferDefaultPdfFilename(context, fallbackBase, entityId, templateType);
  }
  try {
    const compiled = Handlebars.compile(pattern, { noEscape: true, strict: false });
    const name = compiled(context);
    const safe = name
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    if (!safe) return inferDefaultPdfFilename(context, fallbackBase, entityId, templateType);
    return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
  } catch {
    return inferDefaultPdfFilename(context, fallbackBase, entityId, templateType);
  }
}
