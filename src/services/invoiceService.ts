import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrat
...
created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

[Tool result trimmed: kept first 100 chars and last 100 chars of 1057 chars.]