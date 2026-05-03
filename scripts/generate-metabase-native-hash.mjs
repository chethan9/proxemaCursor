#!/usr/bin/env node
/**
 * Print a Metabase "New question" URL hash for native SQL + {{store_id}} (Proxema embed).
 *
 * Usage:
 *   node scripts/generate-metabase-native-hash.mjs analytics/metabase/sql/02_sales_by_product.sql bar
 *
 * Args: <path-to.sql> [display]   display defaults to table (also: line | bar)
 *
 * Paste store_id in Metabase before Run; after Save, register question id in Proxima Standard reports.
 */
import fs from "fs";

const [, , sqlPath, displayArg = "table"] = process.argv;
if (!sqlPath) {
  console.error("Usage: node scripts/generate-metabase-native-hash.mjs <sql-file> [line|bar|table]");
  process.exit(1);
}

const STORE_TAG_ID = "b8f9f9e8-0011-0011-0011-001100110011";

function stripLeadingComments(sql) {
  return sql
    .replace(/^--[^\n]*\n/gm, "")
    .trim();
}

const sql = stripLeadingComments(fs.readFileSync(sqlPath, "utf8"));
const display = ["line", "bar", "table"].includes(displayArg) ? displayArg : "table";

const dataset_query = {
  database: 3,
  type: "native",
  native: {
    query: sql,
    "template-tags": {
      store_id: {
        id: STORE_TAG_ID,
        name: "store_id",
        "display-name": "Store ID",
        type: "text",
        required: true,
      },
    },
  },
};

const state = {
  dataset_query,
  display,
  parameters: [],
  visualization_settings: {},
};

const hash = Buffer.from(JSON.stringify(state)).toString("base64url");
const base = process.env.METABASE_SITE_URL || "https://metabase-server-ninq.onrender.com";
console.log(`${base}/question#${hash}`);
