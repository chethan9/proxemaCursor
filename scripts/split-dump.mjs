import fs from "node:fs";

const MAX = 400 * 1024;
const content = fs.readFileSync("supabase/prod_full_dump.sql", "utf8");

// Split into statements by semicolon at line end (keeping simple)
const lines = content.split("\n");
const chunks = [];
let buf = "";
for (const line of lines) {
  if (buf.length + line.length + 1 > MAX && buf.length > 0) {
    chunks.push(buf);
    buf = "";
  }
  buf += line + "\n";
}
if (buf) chunks.push(buf);

for (const f of fs.readdirSync("supabase").filter((x) => x.startsWith("dump_"))) {
  fs.unlinkSync("supabase/" + f);
}

chunks.forEach((c, i) => {
  const name = `supabase/dump_${String(i + 1).padStart(2, "0")}.sql`;
  fs.writeFileSync(name, c);
  console.log(name, (c.length / 1024).toFixed(1) + "KB");
});
console.log(`Total: ${chunks.length} files`);