#!/usr/bin/env node
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
const envPath = join(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SAMPLES = [
  {
    slug: "invoice-classic",
    name: "Classic Invoice",
    type: "invoice",
    description: "Traditional invoice with professional header and detailed line items",
    path: "../src/lib/templates/samples/invoice-classic.html",
  },
  {
    slug: "invoice-minimal",
    name: "Minimal Invoice",
    type: "invoice",
    description: "Clean and minimal invoice design with subtle typography",
    path: "../src/lib/templates/samples/invoice-minimal.html",
  },
  {
    slug: "invoice-modern",
    name: "Modern Invoice",
    type: "invoice",
    description: "Modern invoice with gradient header and card-style layout",
    path: "../src/lib/templates/samples/invoice-modern.html",
  },
  {
    slug: "pickslip-warehouse",
    name: "Warehouse Pick Slip",
    type: "pickslip",
    description: "Detailed pick slip with checkboxes, barcodes, and signature area",
    path: "../src/lib/templates/samples/pickslip-warehouse.html",
  },
  {
    slug: "pickslip-compact",
    name: "Compact Pick Slip",
    type: "pickslip",
    description: "Space-efficient pick slip for quick fulfillment",
    path: "../src/lib/templates/samples/pickslip-compact.html",
  },
];

async function seed() {
  console.log("🌱 Seeding template samples...\n");

  for (const sample of SAMPLES) {
    const htmlPath = join(__dirname, sample.path);
    const html = readFileSync(htmlPath, "utf8");

    // Upsert template
    const { data: tpl, error: tplErr } = await supabase
      .from("templates")
      .upsert(
        {
          slug: sample.slug,
          name: sample.name,
          type: sample.type,
          description: sample.description,
          is_sample: true,
        },
        { onConflict: "slug" }
      )
      .select()
      .single();

    if (tplErr) {
      console.error(`❌ Failed to upsert template ${sample.slug}:`, tplErr);
      continue;
    }

    console.log(`✅ Template: ${sample.name} (${tpl.id})`);

    // Create initial version
    const { error: verErr } = await supabase.from("template_versions").insert({
      template_id: tpl.id,
      html_content: html,
      version_number: 1,
      created_by: null,
    });

    if (verErr && verErr.code !== "23505") {
      // ignore duplicate
      console.error(`❌ Failed to create version for ${sample.slug}:`, verErr);
    } else if (!verErr) {
      console.log(`   📄 Version 1 created`);
    }
  }

  console.log("\n✨ Seeding complete!");
}

seed().catch(console.error);