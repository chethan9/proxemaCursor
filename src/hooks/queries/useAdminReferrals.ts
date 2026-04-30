import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-client";
import type { ReferralPayout } from "@/hooks/queries/useReferrals";

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

export interface AdminPayoutWithClient extends ReferralPayout {
  clients?: { id: string; name: string } | null;
}

export function useAdminPayouts(status: string) {
  return useQuery<{ data: AdminPayoutWithClient[] }>({
    queryKey: queryKeys.adminReferralPayouts(status),
    queryFn: async () => {
      const r = await authFetch(`/api/admin/referrals/payouts?status=${encodeURIComponent(status)}`);
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Failed to load payouts");
      return r.json();
    },
    staleTime: 15_000,
  });
}

export interface AdminPayoutDetail {
  payout: AdminPayoutWithClient;
  balance: {
    referrer_client_id: string;
    currency: string;
    lifetime_earned_minor: number;
    reversed_minor: number;
    withdrawn_minor: number;
    pending_payout_minor: number;
    available_minor: number;
  } | null;
  profile: {
    referral_code: string;
    has_paid_purchase: boolean;
    payout_method: string | null;
    payout_details: Record<string, unknown>;
  } | null;
  recentEvents: Array<{ id: string; event_type: string; amount_minor: number; currency: string; status: string; source: string; created_at: string }>;
  requestedByEmail: string | null;
}

export function useAdminPayoutDetail(id: string | null) {
  return useQuery<AdminPayoutDetail>({
    queryKey: queryKeys.adminReferralPayout(id || ""),
    queryFn: async () => {
      const r = await authFetch(`/api/admin/referrals/payouts/${id}`);
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Failed to load");
      return r.json();
    },
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useAdminPayoutAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; action: "approve" | "reject" | "mark_paid"; reason?: string; admin_notes?: string; paid_reference?: string }) => {
      const r = await authFetch(`/api/admin/referrals/payouts/${input.id}/action`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.error || "Action failed");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "referrals"] });
    },
  });
}

export interface ReferralSettings {
  is_enabled: boolean;
  signup_bonus_minor: number;
  paid_percentage_bps: number;
  paid_percentage_max_minor: number | null;
  recurring_percentage_bps: number;
  recurring_max_count: number;
  min_payout_minor: number;
  payout_currency: string;
  eligibility_window_days: number;
  reversal_window_days: number;
  require_referrer_paid: boolean;
  payout_methods: unknown;
  notes: string | null;
  updated_at: string;
}

export function useAdminReferralSettings() {
  return useQuery<{ settings: ReferralSettings }>({
    queryKey: queryKeys.adminReferralSettings,
    queryFn: async () => {
      const r = await authFetch("/api/admin/referrals/settings");
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Failed to load settings");
      return r.json();
    },
    staleTime: 30_000,
  });
}

export function useSaveAdminReferralSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ReferralSettings>) => {
      const r = await authFetch("/api/admin/referrals/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.error || "Failed to save");
      return json as { settings: ReferralSettings };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.adminReferralSettings });
    },
  });
}

export interface ReconcileResult {
  dryRun: boolean;
  rowsChecked: number;
  drift: Array<{
    referrer_client_id: string;
    currency: string;
    drift_minor: number;
    was: { available_minor: number; lifetime_earned_minor: number; withdrawn_minor: number; pending_payout_minor: number };
    now: { available_minor: number; lifetime_earned_minor: number; withdrawn_minor: number; pending_payout_minor: number };
  }>;
}

export function useAdminReferralReconcile() {
  return useMutation({
    mutationFn: async (opts: { dryRun: boolean }) => {
      const url = opts.dryRun
        ? "/api/admin/referrals/reconcile?dryRun=1"
        : "/api/admin/referrals/reconcile";
      const r = await authFetch(url, { method: opts.dryRun ? "GET" : "POST", body: opts.dryRun ? undefined : JSON.stringify({}) });
      const json = await r.json().catch(() => null);
      if (!r.ok) throw new Error(json?.error || "Reconcile failed");
      return json as ReconcileResult;
    },
  });
}
