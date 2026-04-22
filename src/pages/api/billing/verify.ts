import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integ
...
  return res.status(500).json({ error: msg });
  }
}