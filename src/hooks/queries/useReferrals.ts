import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-client";

export interface ReferralProfile {
  id: string;
  client_id: string;
  user_id: string;
  referral_code: string;
  status: "active" | "suspended" | "disabled";
  has_paid_purchase: boolean;
  first_paid_at: string | null;
  payout_method: string | null;
  payout_details: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralBalance {
  referrer_client_id: string;
  currency: string;
  lifetime_earned_minor: number;
  reversed_minor: number;
  withdrawn_minor: number;
  pending_payout_minor: number;
  available_minor: number;
  updated_at: string;
}

export interface ReferralProfileResponse {
  enabled: boolean;
  profile: ReferralProfile | null;
  balances: ReferralBalance[];
  stats: { total: number; converted: number };
  settings: {
    signup_bonus_minor: number;
    paid_percentage_bps: number;
    min_payout_minor: number;
    payout_currency: string;
    require_referrer_paid: boolean;
    payout_methods: unknown;
  };
}

export interface ReferralEvent {
  id: string;
  event_type: string;
  amount_minor: number;
  currency: string;
  status: "posted" | "reversed";
  source: string;
  reason: string | null;
  created_at: string;
  attribution_id: string | null;
}

export interface ReferralPayout {
  id: string;
  referrer_client_id: string;
  currency: string;
  amount_minor: number;
  status: "pending" | "approved" | "rejected" | "paid" | "canceled";
  payout_method: string | null;
  payout_details: Record<string, unknown>;
  notes: string | null;
  admin_notes: string | null;
  rejected_reason: string | null;
  paid_reference: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });
}

export function useReferralProfile() {
  return useQuery<ReferralProfileResponse>({
    queryKey: queryKeys.referralProfile,
    queryFn: async () => {
      const r = await authFetch("/api/referrals/profile");
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Failed to load referral profile");
      return r.json();
    },
    staleTime: 30_000,
  });
}

export function useReferralEvents() {
  return useQuery<{ data: ReferralEvent[] }>({
    queryKey: queryKeys.referralEvents,
    queryFn: async () => {
      const r = await authFetch("/api/referrals/events?limit=50");
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Failed to load events");
      return r.json();
    },
    staleTime: 30_000,
  });
}

export function useReferralPayouts() {
  return useQuery<{ data: ReferralPayout[] }>({
    queryKey: queryKeys.referralPayouts,
    queryFn: async () => {
      const r = await authFetch("/api/referrals/payouts");
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Failed to load payouts");
      return r.json();
    },
    staleTime: 30_000,
  });
}

export function useEnrollReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await authFetch("/api/referrals/profile", { method: "POST" });
      const json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.error || "Failed to enroll");
      return json as { profile: ReferralProfile };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.referralProfile });
    },
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amount_minor: number; currency: string; payout_method?: string; payout_details?: Record<string, unknown>; notes?: string }) => {
      const r = await authFetch("/api/referrals/payouts", { method: "POST", body: JSON.stringify(input) });
      const json = await r.json().catch(() => null);
      if (!r.ok) {
        const err = new Error(json?.error || "Failed to submit payout") as Error & { details?: unknown };
        err.details = json;
        throw err;
      }
      return json as { payout: ReferralPayout };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.referralProfile });
      qc.invalidateQueries({ queryKey: queryKeys.referralPayouts });
    },
  });
}

export function useCancelPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await authFetch(`/api/referrals/payouts/${id}/cancel`, { method: "POST" });
      const json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.error || "Failed to cancel");
      return json as { payout: ReferralPayout };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.referralProfile });
      qc.invalidateQueries({ queryKey: queryKeys.referralPayouts });
    },
  });
}
