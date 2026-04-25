import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { CurrentPlanCard } from "@/components/billing/CurrentPlanCard";
import { UsageMeterCard } from "@/components/billing/UsageMeterCard";
import { SubscriptionStatusBanner } from "@/components/billing/SubscriptionStatusBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthProvider";
import { useBillingUsage } from "@/hooks/queries/useBillingUsage";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Download, RefreshCw, ExternalLink, Loader2, CreditCard, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/helpers";

type Invoice = Tables<"invoices">;

function BillingInner() {
  const { profile } = useAuth();
  const usage = useBillingUsage(profile?.client_id || "");
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
    if (v === "paid") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>;
    if (v === "failed") return <Badge variant="destructive">Failed</Badge>;
    if (v === "pending") return <Badge variant="secondary">Pending</Badge>;
    if (v === "refunded") return <Badge variant="outline">Refunded</Badge>;
    return <Badge variant="outline">{s || "—"}</Badge>;
  };

  const usageQuotas = { maxSites: 50, maxProducts: 50000, maxUsers: 25 };
  const usageData = { sites: usage?.data?.sites || 0, products: usage?.data?.products || 0, users: usage?.data?.users || 0 };

  return (
    <AppLayout>
      <SubscriptionStatusBanner />
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Billing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription, payment methods, and invoices.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link href="/settings/payment-methods"><CreditCard className="h-4 w-4 mr-1.5" />Payment methods</Link></Button>
            <Button variant="outline" size="sm" asChild><Link href="/pricing"><ExternalLink className="h-4 w-4 mr-1.5" />Change plan</Link></Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <CurrentPlanCard />
          <UsageMeterCard usage={usageData} quotas={usageQuotas} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" />Payment history</CardTitle>
            <Button variant="outline" size="sm" onClick={loadInvoices} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading…</div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No invoices yet</p>
                <p className="text-xs mt-1">Invoices will appear here after your first payment.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => {
                      const inv2 = inv as unknown as { id: string; invoice_number?: string; created_at: string; amount_minor?: number; currency?: string; status?: string; gateway?: string; pdf_url?: string };
                      return (
                        <TableRow key={inv2.id}>
                          <TableCell className="font-mono text-xs">{inv2.invoice_number || inv2.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm">{new Date(inv2.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm font-medium">{((inv2.amount_minor || 0) / 100).toFixed(2)} {inv2.currency || "USD"}</TableCell>
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
