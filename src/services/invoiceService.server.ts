import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Tables, TablesInsert } from "@/integrations/supabase/helpers";

export type Invoice = Tables<"invoices">;

export { supabaseAdmin };

export async function insertInvoice(input: TablesInsert<"invoices">): Promise<Invoice> {
  const { data, error } = await supabaseAdmin.from("invoices").insert(input).select().single();
  if (error) throw error;
  return data;
}