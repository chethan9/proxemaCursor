import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { CurrentPlanCard } from "@/components/billing/CurrentPlanCard";
import { UsageMeterCard } from "@/components/billing/UsageMeterCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthProvider";
import { formatDate, formatCurrency } from "@/lib/format-number";
import { useBillingUsage } from "@/hooks/queries/useBillingUsage";
import { useSubscription } from "@/hooks/queries/useSubscription";
import { getClientQuota } from "@/lib/quota";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Download, RefreshCw, ExternalLink, Loader2, CreditCard, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/helpers";

type Invoice = Tables<"invoices">;

function BillingInner() {
  const { profile } = useAuth();
  const { subscription } = useSubscription();
  const { t, i18n } = useTranslation("billing");
  const usage = useBillingUsage(profile?.client_id || "");
  const { data: quota } = useQuery({
    queryKey: ["billing-quota", profile?.client_id],
    queryFn: () => (profile?.client_id ? getClientQuota(profile.client_id) : null),
    enabled: !!profile?.client_id,
    staleTime: 60_000,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvoices = async () => {
    if (!profile?.client_id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("client_id", profile.client_id)
      .order("created_at", { ascending: false })
      .limit(50);
    setInvoices((data as Invoice[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadInvoices(); }, [profile?.client_id]);

  const statusBadge = (s: string | null) => {
    const v = (s || "").toLowerCase();
    if (v === "paid") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t("status.paid")}</Badge>;
    if (v === "failed") return <Badge variant="destructive">{t("status.failed")}</Badge>;
    if (v === "pending") return <Badge variant="secondary">{t("status.pending")}</Badge>;
    if (v === "refunded") return <Badge variant="outline">{t("status.refunded")}</Badge>;
    return <Badge variant="outline">{s || "—"}</Badge>;
  };

  const usageQuotas = quota
    ? { maxSites: quota.max_sites, maxProducts: quota.max_products_per_site, maxUsers: quota.max_users }
    : { maxSites: 50, maxProducts: 50000, maxUsers: 25 };
  const usageData = { sites: usage?.data?.sites || 0, products: usage?.data?.products || 0, users: usage?.data?.users || 0 };
  const graceUntil = subscription?.quota_grace_until ?? null;

  return (
    <AppLayout>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link href="/settings/payment-methods"><CreditCard className="h-4 w-4 mr-1.5" />{t("paymentMethods")}</Link></Button>
            <Button variant="outline" size="sm" asChild><Link href="/pricing"><ExternalLink className="h-4 w-4 mr-1.5" />{t("changePlan")}</Link></Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <CurrentPlanCard />
          <UsageMeterCard usage={usageData} quotas={usageQuotas} graceUntil={graceUntil} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" />{t("history.title")}</CardTitle>
            <Button variant="outline" size="sm" onClick={loadInvoices} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />{t("history.refresh")}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />{t("history.loading")}</div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">{t("history.emptyTitle")}</p>
                <p className="text-xs mt-1">{t("history.emptyBody")}</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("history.columns.invoice")}</TableHead>
                      <TableHead>{t("history.columns.date")}</TableHead>
                      <TableHead>{t("history.columns.amount")}</TableHead>
                      <TableHead>{t("history.columns.status")}</TableHead>
                      <TableHead>{t("history.columns.gateway")}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const inv2 = inv as unknown as { id: string; invoice_number?: string; created_at: string; amount_minor?: number; currency?: string; status?: string; gateway?: string; pdf_url?: string };
                      return (
                        <TableRow key={inv2.id}>
                          <TableCell className="font-mono text-xs">{inv2.invoice_number || inv2.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm">{formatDate(inv2.created_at, i18n.language)}</TableCell>
                          <TableCell className="text-sm font-medium">{formatCurrency((inv2.amount_minor || 0) / 100, inv2.currency || "USD", i18n.language)}</TableCell>
                          <TableCell>{statusBadge(inv2.status || null)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground capitalize">{inv2.gateway || "—"}</TableCell>
                          <TableCell className="text-right">
                            {inv2.pdf_url ? (
                              <a href={inv2.pdf_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm"><Download className="h-3.5 w-3.5" /></Button>
                              </a>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function BillingPage() {
  return <AuthGuard><BillingInner /></AuthGuard>;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "billing"])),
  },
});