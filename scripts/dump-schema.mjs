import fs from "node:fs";
import pg from "pg";

const envText = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const password = env.SUPABASE_DB_PASSWORD;

const hosts = [
  `db.${ref}.supabase.co`,
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-us-east-2.pooler.supabase.com`,
  `aws-0-us-west-1.pooler.supabase.com`,
  `aws-0-eu-central-1.pooler.supabase.com`,
  `aws-0-eu-west-1.pooler.supabase.com`,
  `aws-0-ap-southeast-1.pooler.supabase.com`,
];

async function tryConnect() {
  for (const host of hosts) {
    const isPool = host.includes("pooler");
    const config = {
      host,
      port: isPool ? 6543 : 5432,
      user: isPool ? `postgres.${ref}` : "postgres",
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    };
    const client = new pg.Client(config);
    try {
      await client.connect();
      console.log(`CONNECTED: ${host}:${config.port} as ${config.user}`);
      return client;
    } catch (e) {
      console.log(`  FAIL ${host}: ${e.message}`);
      try { await client.end(); } catch {}
    }
  }
  throw new Error("No host worked");
}

const client = await tryConnect();
const r = await client.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`);
console.log("public tables:", r.rows[0].count);
await client.end();