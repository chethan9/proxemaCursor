import type { GetServerSideProps } from "next";
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getDefaultCurrencyForCountry } from "@/lib/payments";
import { useAuth } from "@/contexts/AuthProvider";
import { useCheckout } from "@/hooks/useCheckout";
import { PlanCard } from "@/components/pricing/PlanCard";
import { CurrencySwitcher } from "@/components/pricing/CurrencySwitcher";
import type { Tables } from "@/integrations/supabase/types";

type P = { plans: Tables<"plans">[]; dc: string };

export const getServerSideProps: GetServerSideProps<P> = async ({ req }) => {
  const c = (req.headers["cf-ipcountry"] as string) || "US";
  const dc = getDefaultCurrencyForCountry(c);
  const { data } = await supabaseAdmin.from("plans").select("*").eq("is_active", true).order("sort_order");
  return { props: { plans: data || [], dc } };
};

export default function Pricing({ plans, dc }: P) {
  const { user } = useAuth();
  const router = useRouter();
  const { startCheckout, loading } = useCheckout();
  const [cur, setCur] = useState(dc);
  const go = (id: string) => { if (user) { startCheckout(id); } else { router.push(`/auth/signup?plan=${id}`); } };
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-semibold">WooSync</Link>
          <div className="flex gap-4 items-center"><CurrencySwitcher value={cur} onChange={setCur} />{user ? <Link href="/billing" className="text-sm">Billing</Link> : <Link href="/auth/login" className="text-sm">Log in</Link>}</div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-semibold text-center mb-12">Simple, transparent pricing</h1>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">{plans.map(p => <PlanCard key={p.id} plan={p} currency={cur} onSubscribe={() => go(p.id)} loading={loading} />)}</div>
      </main>
    </div>
  );
}