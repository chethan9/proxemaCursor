import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { openRazorpayCheckout } from "@/lib/razorpay-client";
import { formatCurrency } from "@/lib/format-number";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

const PRICE_MINOR_DEFAULT = parseInt(process.env.NEXT_PUBLIC_AI_CREDIT_PRICE_MINOR_PER_UNIT || "10", 10) || 10;

type PurchaseRow = {
  id: string;
  credits: number;
  amount_minor: number;
  currency: string;
  status: string;
  gateway: string | null;
  created_at: string;
};

export default function AICreditsPage() {
  const { t, i18n } = useTranslation("site");
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [creditsToBuy, setCreditsToBuy] = useState(100);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: async () => {
      const res = await fetch("/api/ai/usage", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        credits: {
          monthlyAllowance: number;
          usedThisPeriod: number;
          monthlyRemaining: number;
          topupBalance: number;
          totalAvailable: number;
          planName: string;
        } | null;
        features: Array<{ slug: string; name: string; credit_cost_per_output: number }>;
        purchases?: PurchaseRow[];
      }>;
    },
  });

  useEffect(() => {
    const q = router.query;
    if (q.ai_topup === "1") {
      let tries = 0;
      const id = setInterval(() => {
        tries += 1;
        void refetch();
        if (tries >= 8) clearInterval(id);
      }, 2000);
      return () => clearInterval(id);
    }
  }, [router.query.ai_topup, refetch]);

  const c = data?.credits;
  const pct =
    c && c.monthlyAllowance > 0 ? Math.min(100, Math.round((c.usedThisPeriod / c.monthlyAllowance) * 100)) : 0;

  const estimateMinor = Math.max(1, creditsToBuy) * PRICE_MINOR_DEFAULT;

  const startTopup = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/ai/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ credits: creditsToBuy }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || t("settingsAi.checkoutError"));

      if (j.gateway === "tap" && j.payload?.redirectUrl) {
        await router.push(j.payload.redirectUrl as string);
        return;
      }

      if (j.gateway === "myfatoorah" && j.payload?.paymentUrl) {
        window.location.href = j.payload.paymentUrl as string;
        return;
      }

      if (j.gateway === "razorpay" && j.payload?.type === "inline") {
        const p = j.payload as {
          orderId: string;
          keyId: string;
          amount: number;
          currency: string;
          prefill?: { email: string; name?: string };
        };
        await openRazorpayCheckout({
          orderId: p.orderId,
          keyId: p.keyId,
          amount: p.amount,
          currency: p.currency,
          name: "Proxima",
          description: t("settingsAi.title"),
          prefill: p.prefill || { email: "" },
          onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["ai-usage"] });
            toast({ title: t("settingsAi.topupProcessing") });
            void router.replace("/settings/ai-credits?ai_topup=1", undefined, { shallow: true });
          },
        });
        return;
      }

      toast({ title: t("settingsAi.checkoutError") });
    } catch (e) {
      toast({
        title: t("settingsAi.checkoutError"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const purchases = data?.purchases ?? [];

  return (
    <SettingsLayout title={t("settingsAi.title")}>
      <div className="p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("settingsAi.title")}</CardTitle>
            <CardDescription>{t("settingsAi.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            {!isLoading && !c && <p className="text-sm text-muted-foreground">{t("settingsAi.noSub")}</p>}
            {c && (
              <>
                <div className="text-sm">
                  <span className="text-muted-foreground">{t("settingsAi.plan")}</span>{" "}
                  <span className="font-medium">{c.planName}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("settingsAi.monthlyUsed", { used: c.usedThisPeriod, allowance: c.monthlyAllowance })}</span>
                  </div>
                  <Progress value={pct} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-muted-foreground text-xs">{t("settingsAi.topupBalance")}</div>
                    <div className="text-2xl font-semibold">{c.topupBalance}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-muted-foreground text-xs">{t("settingsAi.totalAvailable")}</div>
                    <div className="text-2xl font-semibold">{c.totalAvailable}</div>
                  </div>
                </div>
              </>
            )}

            {c && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <Label htmlFor="buy">{t("settingsAi.creditsPack")}</Label>
                <div className="flex flex-wrap gap-2 items-end">
                  <Input
                    id="buy"
                    type="number"
                    min={10}
                    max={50000}
                    className="w-32"
                    value={creditsToBuy}
                    onChange={(e) => setCreditsToBuy(parseInt(e.target.value, 10) || 0)}
                  />
                  <Button onClick={() => void startTopup()} disabled={checkoutLoading || creditsToBuy < 10}>
                    {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("settingsAi.buyCredits")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("settingsAi.priceEstimate")}: ~{formatCurrency(estimateMinor / 100, "USD", i18n.language)} ({creditsToBuy} credits)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {data?.features && data.features.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("settingsAi.featureCosts")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {data.features.map((f) => (
                <div key={f.slug} className="flex justify-between border-b border-border/60 pb-2 last:border-0">
                  <span>{f.name}</span>
                  <span className="text-muted-foreground">{f.credit_cost_per_output} cr</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {purchases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("settingsAi.recentPurchases")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settingsAi.creditsPack")}</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.credits}</TableCell>
                      <TableCell>{formatCurrency(p.amount_minor / 100, p.currency || "USD", i18n.language)}</TableCell>
                      <TableCell>
                        {p.status === "paid"
                          ? t("settingsAi.purchasePaid")
                          : p.status === "pending"
                            ? t("settingsAi.purchasePending")
                            : t("settingsAi.purchaseFailed")}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "site"])),
  },
});
