<![CDATA[
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "
...
ted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
]]>

[Tool result trimmed: kept first 100 chars and last 100 chars of 2074 chars.]