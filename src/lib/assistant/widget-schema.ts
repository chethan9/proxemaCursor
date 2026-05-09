import { z } from "zod";

/** Max JSON chars inside a fenced proxima-widget block */
export const PROXIMA_WIDGET_MAX_JSON = 48_000;

const metricStripSchema = z.object({
  v: z.literal(1),
  kind: z.literal("metric_strip"),
  title: z.string().max(200).optional(),
  currency: z.string().max(8).optional(),
  metrics: z
    .array(
      z.object({
        label: z.string().max(120),
        value: z.union([z.string().max(500), z.number()]),
        delta_pct: z.number().nullable().optional(),
        hint: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(16),
});

const productGridSchema = z.object({
  v: z.literal(1),
  kind: z.literal("product_grid"),
  title: z.string().max(200).optional(),
  currency: z.string().max(8).optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().max(500),
        sku: z.string().max(120).nullable().optional(),
        subtitle: z.string().max(400).optional(),
        thumbnail_url: z.string().max(2000).nullable().optional(),
        units: z.number().optional(),
        revenue: z.number().optional(),
        href: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(24),
});

const orderListSchema = z.object({
  v: z.literal(1),
  kind: z.literal("order_list"),
  title: z.string().max(200).optional(),
  orders: z
    .array(
      z.object({
        id: z.string().max(80).optional(),
        order_number: z.string().max(80).nullable().optional(),
        status: z.string().max(80).nullable().optional(),
        total: z.union([z.string().max(40), z.number()]).nullable().optional(),
        currency: z.string().max(8).nullable().optional(),
        date_created: z.string().max(80).nullable().optional(),
        href: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(40),
});

const kvTableSchema = z.object({
  v: z.literal(1),
  kind: z.literal("kv_table"),
  title: z.string().max(200).optional(),
  rows: z
    .array(
      z.object({
        key: z.string().max(200),
        value: z.union([z.string().max(2000), z.number()]),
      }),
    )
    .min(1)
    .max(40),
});

const alertListSchema = z.object({
  v: z.literal(1),
  kind: z.literal("alert_list"),
  title: z.string().max(200).optional(),
  alerts: z
    .array(
      z.object({
        severity: z.enum(["info", "warning", "danger"]).optional(),
        message: z.string().max(1000),
      }),
    )
    .min(1)
    .max(24),
});

export const proximaWidgetSchema = z.discriminatedUnion("kind", [
  metricStripSchema,
  productGridSchema,
  orderListSchema,
  kvTableSchema,
  alertListSchema,
]);

/** Explicit union — z.infer on discriminatedUnion can collapse to `never` in some TS/Zod combos */
export type ProximaWidget =
  | z.infer<typeof metricStripSchema>
  | z.infer<typeof productGridSchema>
  | z.infer<typeof orderListSchema>
  | z.infer<typeof kvTableSchema>
  | z.infer<typeof alertListSchema>;

export type AssistantMessagePart =
  | { type: "markdown"; text: string }
  | { type: "widget"; widget: ProximaWidget };

const WIDGET_FENCE = /```\s*proxima-widget\s*\r?\n([\s\S]*?)\r?\n```/g;

export function parseAssistantMessageParts(raw: string): AssistantMessagePart[] {
  const parts: AssistantMessagePart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = WIDGET_FENCE.exec(raw)) !== null) {
    const before = raw.slice(last, m.index);
    if (before.trim()) parts.push({ type: "markdown", text: before });
    const inner = (m[1] ?? "").trim();
    if (inner.length > PROXIMA_WIDGET_MAX_JSON) {
      parts.push({
        type: "markdown",
        text: "\n\n*(Widget omitted: payload too large.)*\n\n",
      });
    } else {
      try {
        const json = JSON.parse(inner) as unknown;
        const parsed = proximaWidgetSchema.safeParse(json);
        if (parsed.success) parts.push({ type: "widget", widget: parsed.data as ProximaWidget });
        else {
          parts.push({
            type: "markdown",
            text: `\n\n*(Invalid proxima-widget: ${parsed.error.message.slice(0, 140)})*\n\n`,
          });
        }
      } catch {
        parts.push({ type: "markdown", text: "\n\n*(Invalid JSON in proxima-widget.)*\n\n" });
      }
    }
    last = m.index + m[0].length;
  }
  const tail = raw.slice(last);
  if (tail.trim()) parts.push({ type: "markdown", text: tail });
  if (parts.length === 0 && raw.trim()) parts.push({ type: "markdown", text: raw });
  return parts;
}

/** Drop an incomplete trailing ```proxima-widget … fence while streaming */
export function stripTrailingIncompleteProximaWidget(raw: string): string {
  const marker = "```proxima-widget";
  const pos = raw.lastIndexOf(marker);
  if (pos === -1) return raw;
  const rest = raw.slice(pos);
  if (/^```\s*proxima-widget\s*\r?\n[\s\S]*\r?\n```\s*$/.test(rest)) return raw;
  return raw.slice(0, pos).replace(/\s+$/, "");
}
