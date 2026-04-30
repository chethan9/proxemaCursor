import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { ProductRow } from "@/services/productService";
import type { ProductSortField, SortDirection } from "@/services/productService";
import {
  applyProductCatalogFilters,
  applyProductCatalogOrder,
  getCategoryFilterMeta,
} from "@/lib/products-list-query";
import { normalizeSelectFilter } from "@/lib/normalize-explorer-filters";
import {
  EXPORT_META_HEADERS,
  PRODUCT_CATALOG_COLUMNS,
  type CatalogColumnKey,
} from "@/lib/product-catalog-columns";
import {
  rowToCellStrings,
  type ExportRowKind,
  type ProductVariationForExport,
} from "@/lib/product-export-cells";
import {
  encodeProductExportCsv,
  encodeProductExportPdf,
  encodeProductExportXlsx,
} from "@/lib/product-export-encoding";

const BATCH = 250;
const MAX_EXPORT_ROWS = 50_000;
const MAX_PDF_ROWS = 2_500;

const VALID_COL = new Set(PRODUCT_CATALOG_COLUMNS.map((c) => c.key));

function parseColumnKeys(raw: string | undefined): CatalogColumnKey[] {
  if (!raw?.trim()) {
    return PRODUCT_CATALOG_COLUMNS.map((c) => c.key).filter((k) => k !== "image");
  }
  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter((k): k is CatalogColumnKey => VALID_COL.has(k as CatalogColumnKey) && k !== "image");
  return keys.length > 0 ? keys : PRODUCT_CATALOG_COLUMNS.map((c) => c.key).filter((k) => k !== "image");
}

type StoreAccess = { allowed: true } | { allowed: false; status: number; message: string };

async function assertStoreAccess(userId: string, storeId: string): Promise<StoreAccess> {
  const { data: profile } = await supabaseAdmin.from("profiles").select("role, client_id").eq("id", userId).single();
  if (!profile) return { allowed: false, status: 403, message: "Profile not found" };
  const { data: store } = await supabaseAdmin.from("stores").select("id, client_id").eq("id", storeId).single();
  if (!store) return { allowed: false, status: 404, message: "Store not found" };
  const isSuperAdmin = profile.role === "super_admin";
  if (!isSuperAdmin && store.client_id !== profile.client_id) {
    return { allowed: false, status: 403, message: "Forbidden" };
  }
  return { allowed: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  if (!storeId) return res.status(400).json({ error: "Missing storeId" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) {
    return res.status(gate.status).json({ error: gate.message });
  }

  const formatRaw = (req.query.format as string) || "csv";
  const format = formatRaw.toLowerCase();
  if (!["csv", "xlsx", "pdf"].includes(format)) {
    return res.status(400).json({ error: "Invalid format (use csv, xlsx, or pdf)" });
  }

  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const statusFilter = typeof req.query.status === "string" ? req.query.status : "all";
  const stockStatusFilter = typeof req.query.stock === "string" ? req.query.stock : "all";
  const excludeOutOfStock = req.query.exclude_out_of_stock === "1" || req.query.exclude_out_of_stock === "true";
  const categoryFilter = normalizeSelectFilter(typeof req.query.cat === "string" ? req.query.cat : undefined);
  const priceMin = req.query.pmin != null && req.query.pmin !== "" ? Number(req.query.pmin) : undefined;
  const priceMax = req.query.pmax != null && req.query.pmax !== "" ? Number(req.query.pmax) : undefined;
  const ptypeRaw = typeof req.query.ptype === "string" ? req.query.ptype : "";
  const productTypeFilter = ptypeRaw === "simple" || ptypeRaw === "variable" ? ptypeRaw : undefined;
  const sortField = (typeof req.query.sort_field === "string" ? req.query.sort_field : "woo_date_created") as ProductSortField;
  const sortDirection = (typeof req.query.sort_direction === "string" ? req.query.sort_direction : "desc") as SortDirection;
  const columnKeys = parseColumnKeys(typeof req.query.cols === "string" ? req.query.cols : undefined);

  const categoryMeta = categoryFilter ? await getCategoryFilterMeta(supabaseAdmin, storeId, categoryFilter) : null;
  const categoryContainsJson = categoryMeta
    ? JSON.stringify(categoryMeta.wooId !== undefined ? [{ id: categoryMeta.wooId }] : [{ name: categoryMeta.name }])
    : null;

  const labelByKey = new Map(PRODUCT_CATALOG_COLUMNS.map((c) => [c.key, c.label] as const));
  const headers = [...EXPORT_META_HEADERS, ...columnKeys.map((k) => labelByKey.get(k) || k)];

  const outRows: string[][] = [];
  let pageIdx = 0;
  let totalLogicalRows = 0;
  let truncated = false;

  while (!truncated) {
    let q = supabaseAdmin
      .from("products")
      .select("*")
      .eq("store_id", storeId);
    q = applyProductCatalogFilters(q, {
      search,
      statusFilter,
      excludeOutOfStock,
      stockStatusFilter,
      priceMin,
      priceMax,
      categoryContainsJson,
      productTypeFilter,
    });
    q = applyProductCatalogOrder(q, sortField, sortDirection);
    q = q.range(pageIdx * BATCH, (pageIdx + 1) * BATCH - 1);
    const { data: batch, error } = await q;
    if (error) {
      console.error("[products/export]", error);
      return res.status(500).json({ error: error.message });
    }
    const parents = (batch || []) as unknown as ProductRow[];
    if (parents.length === 0) break;

    const variableWooIds = parents.filter((p) => p.type === "variable" && p.woo_id != null).map((p) => p.woo_id as number);
    const varMap = new Map<number, ProductVariationForExport[]>();

    if (variableWooIds.length > 0) {
      const { data: vars, error: vErr } = await supabaseAdmin
        .from("product_variations")
        .select(
          "woo_id, woo_parent_id, sku, regular_price, sale_price, price, stock_quantity, stock_status, manage_stock, attributes"
        )
        .eq("store_id", storeId)
        .in("woo_parent_id", variableWooIds);
      if (vErr) {
        console.error("[products/export] variations", vErr);
        return res.status(500).json({ error: vErr.message });
      }
      for (const row of vars || []) {
        const wid = row.woo_parent_id as number;
        const list = varMap.get(wid) || [];
        list.push(row as unknown as ProductVariationForExport);
        varMap.set(wid, list);
      }
    }

    for (const parent of parents) {
      if (parent.type === "variable" && parent.woo_id != null) {
        const vars = varMap.get(parent.woo_id) || [];
        if (vars.length === 0) {
          totalLogicalRows += 1;
          if (totalLogicalRows > MAX_EXPORT_ROWS) {
            truncated = true;
            break;
          }
          outRows.push(rowToCellStrings(columnKeys, parent, null, "parent_only"));
        } else {
          for (const v of vars) {
            totalLogicalRows += 1;
            if (totalLogicalRows > MAX_EXPORT_ROWS) {
              truncated = true;
              break;
            }
            outRows.push(rowToCellStrings(columnKeys, parent, v, "variation"));
          }
        }
      } else {
        totalLogicalRows += 1;
        if (totalLogicalRows > MAX_EXPORT_ROWS) {
          truncated = true;
          break;
        }
        outRows.push(rowToCellStrings(columnKeys, parent, null, "simple"));
      }
      if (truncated) break;
    }

    if (truncated || parents.length < BATCH) break;
    pageIdx += 1;
  }

  if (format === "pdf" && outRows.length > MAX_PDF_ROWS) {
    return res.status(400).json({
      error: `PDF export is limited to ${MAX_PDF_ROWS} rows. Use CSV or Excel for this catalog size, or narrow filters.`,
      code: "pdf_row_limit",
      maxRows: MAX_PDF_ROWS,
    });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  let body: Buffer;
  let contentType: string;
  let filename: string;

  if (format === "csv") {
    body = encodeProductExportCsv(headers, outRows);
    contentType = "text/csv; charset=utf-8";
    filename = `products-${storeId}-${stamp}.csv`;
  } else if (format === "xlsx") {
    body = await encodeProductExportXlsx(headers, outRows);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    filename = `products-${storeId}-${stamp}.xlsx`;
  } else {
    body = await encodeProductExportPdf(headers, outRows);
    contentType = "application/pdf";
    filename = `products-${storeId}-${stamp}.pdf`;
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Export-Row-Count", String(outRows.length));
  res.setHeader("X-Export-Truncated", truncated ? "1" : "0");
  res.setHeader("X-Export-Row-Limit", String(MAX_EXPORT_ROWS));
  return res.status(200).send(body);
}
