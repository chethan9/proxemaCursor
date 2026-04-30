import { useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Copy, Check, Share2, Wallet, Users2, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format-number";
import {
  useReferralProfile,
  useReferralEvents,
  useReferralPayouts,
  useEnrollReferral,
  useRequestPayout,
  useCancelPayout,
  type ReferralEvent,
  type ReferralPayout,
} from "@/hooks/queries/useReferrals";

function minorToMajor(minor: number) {
  return Math.round(minor) / 100;
}

function formatMinor(minor: number, currency: string, locale?: string) {
  return formatCurrency(minorToMajor(minor), currency || "USD", locale);
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ReferralPayout["status"] }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    approved: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    rejected: "bg-rose-100 text-rose-800 hover:bg-rose-100",
    paid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    canceled: "bg-muted text-muted-foreground hover:bg-muted",
  };
  return <Badge className={map[status] || ""}>{status}</Badge>;
}

export default function ReferralsPage() {
  const { t, i18n } = useTranslation(["referrals", "common"]);
  const { toast } = useToast();
  const profileQuery = useReferralProfile();
  const eventsQuery = useReferralEvents();
  const payoutsQuery = useReferralPayouts();
  const enroll = useEnrollReferral();
  const requestPayout = useRequestPayout();
  const cancelPayout = useCancelPayout();
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [details, setDetails] = useState("");
  const [notes, setNotes] = useState("");

  const data = profileQuery.data;
  const profile = data?.profile;
  const settings = data?.settings;
  const balance = useMemo(() => {
    if (!data) return null;
    const cur = settings?.payout_currency || "USD";
    return data.balances.find((b) => b.currency === cur) || data.balances[0] || null;
  }, [data, settings]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = profile ? `${baseUrl}/auth/signup?ref=${encodeURIComponent(profile.referral_code)}` : "";

  async function copyLink() {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  function handleEnroll() {
    enroll.mutate(undefined, {
      onSuccess: () => toast({ title: t("enroll.joined") }),
      onError: (err) => toast({ title: t("enroll.failed"), description: (err as Error).message, variant: "destructive" }),
    });
  }

  function handleSubmitPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || !balance) return;
    const minor = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) {
      toast({ title: t("withdraw.errors.generic"), variant: "destructive" });
      return;
    }
    requestPayout.mutate(
      {
        amount_minor: minor,
        currency: balance.currency,
        payout_method: method || undefined,
        payout_details: details ? { description: details } : undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: t("withdraw.success") });
          setAmount("");
          setNotes("");
        },
        onError: (err) => {
          const e = err as Error & { details?: { error?: string; min_payout_minor?: number; available_minor?: number; currency?: string } };
          const code = e.details?.error || "generic";
          if (code === "amount_below_minimum") {
            toast({
              title: t("withdraw.errors.amount_below_minimum", {
                min: formatMinor(e.details?.min_payout_minor || 0, e.details?.currency || balance.currency, i18n.language),
                currency: e.details?.currency || balance.currency,
              }),
              variant: "destructive",
            });
          } else if (code === "insufficient_balance") {
            toast({
              title: t("withdraw.errors.insufficient_balance", {
                available: formatMinor(e.details?.available_minor || 0, e.details?.currency || balance.currency, i18n.language),
                currency: e.details?.currency || balance.currency,
              }),
              variant: "destructive",
            });
          } else if (code === "withdrawal_requires_paid_purchase") {
            toast({ title: t("withdraw.errors.withdrawal_requires_paid_purchase"), variant: "destructive" });
          } else {
            toast({ title: t("withdraw.errors.generic"), description: e.message, variant: "destructive" });
          }
        },
      },
    );
  }

  function handleCancelPayout(p: ReferralPayout) {
    cancelPayout.mutate(p.id, {
      onSuccess: () => toast({ title: t("payouts.canceling") + "…" }),
      onError: (err) => toast({ title: (err as Error).message, variant: "destructive" }),
    });
  }

  if (profileQuery.isLoading) {
    return (
      <AppLayout title={t("title")}>
        <div className="p-6 space-y-4 max-w-6xl mx-auto">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (data && !data.enabled) {
    return (
      <AppLayout title={t("title")}>
        <div className="p-6 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />{t("title")}</CardTitle>
              <CardDescription>{t("disabledTitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("disabledBody")}</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout title={t("title")}>
        <div className="p-6 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />{t("enroll.title")}</CardTitle>
              <CardDescription>{t("enroll.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <div className="font-medium">{t("rewards.title")}</div>
                  {settings.signup_bonus_minor > 0 && (
                    <div>• {t("rewards.signupBonus", { amount: formatMinor(settings.signup_bonus_minor, settings.payout_currency, i18n.language) })}</div>
                  )}
                  {settings.paid_percentage_bps > 0 && (
                    <div>• {t("rewards.paidPercentage", { percent: (settings.paid_percentage_bps / 100).toFixed(1) })}</div>
                  )}
                  <div>• {t("rewards.minPayout", { amount: formatMinor(settings.min_payout_minor, settings.payout_currency, i18n.language) })}</div>
                  {settings.require_referrer_paid && <div className="text-xs text-muted-foreground pt-1">{t("rewards.eligibilityNote")}</div>}
                </div>
              )}
              <Button onClick={handleEnroll} disabled={enroll.isPending}>
                {enroll.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("enroll.joining")}</> : t("enroll.cta")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const stats = data!.stats;
  const events = eventsQuery.data?.data || [];
  const payouts = payoutsQuery.data?.data || [];

  return (
    <AppLayout title={t("title")}>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />{t("title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
          </div>
          {settings?.require_referrer_paid && !profile.has_paid_purchase && (
            <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900 max-w-md">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm font-medium">{t("withdraw.errors.withdrawal_requires_paid_purchase")}</AlertTitle>
              <AlertDescription className="text-xs">{t("rewards.eligibilityNote")}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatTile label={t("stats.referrals")} value={String(stats.total)} />
          <StatTile label={t("stats.converted")} value={String(stats.converted)} />
          <StatTile
            label={t("stats.lifetimeEarned")}
            value={formatMinor(balance?.lifetime_earned_minor || 0, balance?.currency || settings?.payout_currency || "USD", i18n.language)}
          />
          <StatTile
            label={t("stats.available")}
            value={formatMinor(balance?.available_minor || 0, balance?.currency || settings?.payout_currency || "USD", i18n.language)}
          />
          <StatTile
            label={t("stats.pendingPayout")}
            value={formatMinor(balance?.pending_payout_minor || 0, balance?.currency || settings?.payout_currency || "USD", i18n.language)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Share2 className="h-4 w-4" />{t("shareCard.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-[120px_1fr_auto] items-center gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("shareCard.codeLabel")}</Label>
              <code className="text-base font-mono bg-muted/40 rounded px-2 py-1 inline-block w-fit">{profile.referral_code}</code>
              <span />
            </div>
            <div className="grid sm:grid-cols-[120px_1fr_auto] items-center gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("shareCard.linkLabel")}</Label>
              <Input readOnly value={referralLink} className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copied ? <><Check className="h-3.5 w-3.5 mr-1.5" />{t("shareCard.copied")}</> : <><Copy className="h-3.5 w-3.5 mr-1.5" />{t("shareCard.copy")}</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" />{t("withdraw.title")}</CardTitle>
              <CardDescription>{t("withdraw.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmitPayout}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("withdraw.amount")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={requestPayout.isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("withdraw.currency")}</Label>
                    <Input value={balance?.currency || settings?.payout_currency || "USD"} readOnly className="bg-muted/40" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("withdraw.method")}</Label>
                  <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Bank transfer / UPI / PayPal" disabled={requestPayout.isPending} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("withdraw.details")}</Label>
                  <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("withdraw.detailsPlaceholder")} rows={2} disabled={requestPayout.isPending} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("withdraw.notes")}</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("withdraw.notesPlaceholder")} rows={2} disabled={requestPayout.isPending} />
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" size="sm" disabled={requestPayout.isPending}>
                    {requestPayout.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t("withdraw.submitting")}</> : t("withdraw.submit")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Users2 className="h-4 w-4" />{t("events.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {eventsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">{t("events.empty")}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("withdraw.amount")}</TableHead>
                      <TableHead>{t("payouts.status")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("payouts.requested")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((evt: ReferralEvent) => (
                      <TableRow key={evt.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{t(`events.type.${evt.event_type}`, { defaultValue: evt.event_type })}</div>
                          <div className={`text-xs tabular-nums ${evt.amount_minor < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                            {formatMinor(evt.amount_minor, evt.currency, i18n.language)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={evt.status === "reversed" ? "outline" : "secondary"}>{t(`events.status.${evt.status}`)}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{formatDate(evt.created_at, i18n.language)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("payouts.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {payoutsQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : payouts.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">{t("payouts.empty")}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("payouts.amount")}</TableHead>
                    <TableHead>{t("payouts.status")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("payouts.method")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("payouts.requested")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("payouts.paid")}</TableHead>
                    <TableHead className="text-right">{t("payouts.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular-nums font-medium">{formatMinor(p.amount_minor, p.currency, i18n.language)}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.payout_method || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(p.created_at, i18n.language)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.paid_at ? formatDate(p.paid_at, i18n.language) : "—"}</TableCell>
                      <TableCell className="text-right">
                        {p.status === "pending" && (
                          <Button size="sm" variant="ghost" disabled={cancelPayout.isPending} onClick={() => handleCancelPayout(p)}>
                            {t("payouts.cancel")}
                          </Button>
                        )}
                        {p.status === "rejected" && p.rejected_reason && (
                          <span className="text-xs text-muted-foreground">{p.rejected_reason}</span>
                        )}
                        {p.status === "paid" && p.paid_reference && (
                          <span className="text-xs text-muted-foreground">{p.paid_reference}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "referrals"])),
  },
});
