import crypto from "crypto";

export function generateApiToken(): { plain: string; hash: string; prefix: string } {
  const plain = `wsk_${crypto.randomBytes(32).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  const prefix = plain.substring(0, 12);
  return { plain, hash, prefix };
}