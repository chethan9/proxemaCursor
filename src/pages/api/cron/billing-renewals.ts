import type { NextApiRequest, NextApiResponse } from "next";
export default async function h(req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({ ok: true });
}