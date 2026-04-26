<![CDATA[
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from
...
{
    console.error("[template-render]", e);
    return res.status(500).json({ error: e.message });
  }
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 3346 chars.]