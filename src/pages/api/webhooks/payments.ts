import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integr
...
).slice(0, 500) },
      actorType: "system",
    });
    return res.status(400).json({ error: msg });
  }
}


[Tool result trimmed: kept first 100 chars and last 100 chars of 4017 chars.]