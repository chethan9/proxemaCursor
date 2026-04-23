import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/helpers";

export type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];

export async function listPaymentMethods(): Promise<PaymentMethodRow[]> {
  const { data, error } = await supabase.from("payment_methods").select("*").order("label");
  if (error) throw error;
  return data || [];
}

export async function createPaymentMethod(input: { key: string; label: string; description?: string | null; icon_url?: string | null }): Promise<PaymentMethodRow> {
  const { data, error } = await supabase.from("payment_methods").insert(input).select("*").single();
  if (error) throw error;
  return data;
}

export async function updatePaymentMethod(id: string, input: { key?: string; label?: string; description?: string | null; icon_url?: string | null }): Promise<PaymentMethodRow> {
  const { data, error } = await supabase.from("payment_methods").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) throw error;
}