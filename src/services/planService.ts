import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/helpers";

export type Plan = Tables<"plans">;
export type PlanInsert = TablesInsert<"plans">;
export type PlanUpdate = TablesUpdate<"plans">;

export const SUPPORTED_CURRENCIES = ["USD", "INR", "KWD", "SAR", "AED", "BHD", "OMR", "QAR", "JOD"] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];

export const CURRENCY_LABELS: Record<string, string> = {
  USD: "US Dollar",
  INR: "Indian Rupee",
  KWD: "Kuwaiti Dinar",
  SAR: "Saudi Riyal",
  AED: "UAE Dirham",
  BHD: "Bahraini Dinar",
  OMR: "Omani Rial",
  QAR: "Qatari Riyal",
  JOD: "Jordanian Dinar",
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  KWD: "KD",
  SAR: "SAR",
  AED: "AED",
  BHD: "BD",
  OMR: "OMR",
  QAR: "QR",
  JOD: "JD",
};

const THREE_DECIMAL_CURRENCIES = new Set(["KWD", "BHD", "OMR"]);

export function formatPrice(amountMinor: number, currency: string): string {
  const divisor = THREE_DECIMAL_CURRENCIES.has(currency) ? 1000 : 100;
  const decimals = THREE_DECIMAL_CURRENCIES.has(currency) ? 3 : 2;
  const value = amountMinor / divisor;
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym} ${value.toFixed(decimals)}`;
}

export function getPlanPrice(plan: Plan, currency: string): number | null {
  const prices = (plan.prices as Record<string, number>) || {};
  const v = prices[currency];
  return typeof v === "number" ? v : null;
}

export async function fetchAllPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as Plan[];
}

export async function fetchActivePlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as Plan[];
}

export async function createPlan(input: PlanInsert): Promise<Plan> {
  const { data, error } = await supabase.from("plans").insert(input).select().single();
  if (error) throw error;
  return data as Plan;
}

export async function updatePlan(id: string, updates: PlanUpdate): Promise<Plan> {
  const { data, error } = await supabase.from("plans").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as Plan;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
}