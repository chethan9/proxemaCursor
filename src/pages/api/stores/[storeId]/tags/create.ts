<![CDATA[import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from
...
message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Failed to create tag", message });
  }
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 1617 chars.]