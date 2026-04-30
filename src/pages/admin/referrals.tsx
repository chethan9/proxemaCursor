import { useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Award, Save, RefreshCw, Check, X, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format-number";
import {
  useAdminPayouts,
  useAdminPayoutDetail,
  useAdminPayoutAction,
  useAdminReferralSettings,
  useSaveAdminReferralSettings,
  useAdminReferralReconcile,
  type AdminPayoutWithClient,
} from "@/hooks/queries/useAdminReferrals";

type StatusKey = "pending" | "approved" | "paid" | "rejected" | "canceled" | "all";
const STATUS_KEYS: StatusKey[] = ["pending", "approved", "paid", "rejected", "canceled", "all"];

function minorToMajor(minor: number) {
  return Math.round(minor) / 100;
}

function formatMinor(minor: number, currency: string, locale?: string) {
  return formatCurrency(minorToMajor(minor || 0), currency || "USD", locale);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    approved: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    rejected: "bg-rose-100 text-rose-800 hover:bg-rose-100",
    paid: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    canceled: "bg-muted text-muted-foreground hover:bg-muted",
  };
  return <Badge className={map[status] || ""}>{status}</Badge>;
}

function PayoutTable({ data, onSelect, locale }: { data: AdminPayoutWithClient[]; onSelect: (id: string) => void; locale?: string }) {
  const { t } = useTranslation("referrals");
  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">{t("payouts.empty")}</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.table.client")}</TableHead>
          <TableHead className="text-right">{t("admin.table.amount")}</TableHead>
          <TableHead>{t("admin.table.method")}</TableHead>
          <TableHead>{t("admin.table.requested")}</TableHead>
          <TableHead>{t("admin.table.status")}</TableHead>
          <TableHead className="text-right">{t("admin.table.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((p) => (
          <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onSelect(p.id)}>
            <TableCell className="font-medium">{p.clients?.name || p.referrer_client_id.slice(0, 8)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMinor(p.amount_minor, p.currency, locale)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{p.payout_method || "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(p.created_at, locale)}</TableCell>
            <TableCell><StatusBadge status={p.status} /></TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onSelect(p.id); }}>
                {t("admin.actions.view")}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PayoutDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation(["referrals", "common"]);
  const { toast } = useToast();
  const detail = useAdminPayoutDetail(id);
  const action = useAdminPayoutAction();
  const [adminNotes, setAdminNotes] = useState("");
  const [reason, setReason] = useState("");
  const [paidRef, setPaidRef] = useState("");

  const open = !!id;
  const data = detail.data;
  const payout = data?.payout;

  function runAction(act: "approve" | "reject" | "mark_paid") {
    if (!payout) return;
    if (act === "reject" && !reason.trim()) {
      toast({ title: t("admin.drawer.rejectReason"), variant: "destructive" });
      return;
    }
    if (act === "mark_paid" && !paidRef.trim()) {
      toast({ title: t("admin.drawer.paidReference"), variant: "destructive" });
      return;
    }
    action.mutate(
      {
        id: payout.id,
        action: act,
        admin_notes: adminNotes || undefined,
        reason: act === "reject" ? reason : undefined,
        paid_reference: act === "mark_paid" ? paidRef : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: t(`admin.actions.${act === "mark_paid" ? "markPaid" : act}`) });
          onClose();
          setAdminNotes(""); setReason(""); setPaidRef("");
        },
        onError: (err) => toast({ title: (err as Error).message, variant: "destructive" }),
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("admin.drawer.title")}</SheetTitle>
          <SheetDescription>{payout ? `${payout.clients?.name || payout.referrer_client_id.slice(0, 8)} · ${formatMinor(payout.amount_minor, payout.currency, i18n.language)}` : ""}</SheetDescription>
        </SheetHeader>

        {detail.isLoading ? (
          <div className="space-y-3 py-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !data ? (
          <div className="py-8 text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t("admin.drawer.balance")}</div>
                {data.balance ? (
                  <div className="space-y-0.5 text-sm">
                    <div className="flex justify-between"><span>{t("admin.drawer.available")}</span><span className="tabular-nums font-medium">{formatMinor(data.balance.available_minor, data.balance.currency, i18n.language)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>{t("admin.drawer.lifetime")}</span><span className="tabular-nums">{formatMinor(data.balance.lifetime_earned_minor, data.balance.currency, i18n.language)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>{t("admin.drawer.pending")}</span><span className="tabular-nums">{formatMinor(data.balance.pending_payout_minor, data.balance.currency, i18n.language)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>{t("admin.drawer.withdrawn")}</span><span className="tabular-nums">{formatMinor(data.balance.withdrawn_minor, data.balance.currency, i18n.language)}</span></div>
                  </div>
                ) : <div className="text-sm text-muted-foreground">No balance</div>}
              </div>
              <div className="rounded border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t("admin.drawer.client")}</div>
                <div className="text-sm font-medium">{payout?.clients?.name || payout?.referrer_client_id.slice(0, 8)}</div>
                {data.profile && (
                  <div className="text-xs mt-2 space-y-0.5">
                    <div>Code: <code className="font-mono">{data.profile.referral_code}</code></div>
                    <div>Has paid: {data.profile.has_paid_purchase ? "Yes" : "No"}</div>
                  </div>
                )}
                {data.requestedByEmail && <div className="text-xs text-muted-foreground mt-1">{data.requestedByEmail}</div>}
              </div>
            </div>

            {payout?.payout_method && (
              <div className="rounded border p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Method</div>
                <div className="font-medium">{payout.payout_method}</div>
                {payout.payout_details && Object.keys(payout.payout_details as object).length > 0 && (
                  <pre className="text-xs bg-muted/30 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(payout.payout_details, null, 2)}</pre>
                )}
                {payout.notes && <div className="text-xs mt-1 text-muted-foreground">{payout.notes}</div>}
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t("admin.drawer.history")}</div>
              {data.recentEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("events.empty")}</div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {data.recentEvents.map((evt) => (
                    <div key={evt.id} className="flex items-center justify-between py-1 border-b last:border-b-0">
                      <span>{t(`events.type.${evt.event_type}`, { defaultValue: evt.event_type })}</span>
                      <span className={`tabular-nums ${evt.amount_minor < 0 ? "text-rose-600" : "text-emerald-700"}`}>{formatMinor(evt.amount_minor, evt.currency, i18n.language)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {payout && (payout.status === "pending" || payout.status === "approved") && (
              <div className="space-y-3 border-t pt-4">
                <div className="space-y-1">
                  <Label className="text-xs">{t("admin.drawer.adminNotes")}</Label>
                  <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} placeholder={t("admin.drawer.adminNotesPlaceholder")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("admin.drawer.rejectReason")}</Label>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.drawer.rejectPlaceholder")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("admin.drawer.paidReference")}</Label>
                  <Input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder={t("admin.drawer.paidReferencePlaceholder")} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {payout.status === "pending" && (
                    <Button size="sm" disabled={action.isPending} onClick={() => runAction("approve")}>
                      <Check className="h-4 w-4 mr-1.5" />{action.isPending ? t("admin.actions.approving") : t("admin.actions.approve")}
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" disabled={action.isPending} onClick={() => runAction("reject")}>
                    <X className="h-4 w-4 mr-1.5" />{action.isPending ? t("admin.actions.rejecting") : t("admin.actions.reject")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => runAction("mark_paid")}>
                    <DollarSign className="h-4 w-4 mr-1.5" />{action.isPending ? t("admin.actions.marking") : t("admin.actions.markPaid")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SettingsForm() {
  const { t } = useTranslation("referrals");
  const { toast } = useToast();
  const settingsQuery = useAdminReferralSettings();
  const save = useSaveAdminReferralSettings();
  const reconcile = useAdminReferralReconcile();
  const settings = settingsQuery.data?.settings;
  const [draft, setDraft] = useState<Record<string, string | number | boolean | null>>({});

  function set<K extends string>(k: K, v: string | number | boolean | null) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function value<T>(k: string, fallback: T): T {
    if (k in draft) return draft[k] as unknown as T;
    return ((settings as unknown as Record<string, T>)?.[k]) ?? fallback;
  }

  async function handleSave() {
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(draft)) patch[k] = draft[k];
    if (Object.keys(patch).length === 0) return;
    save.mutate(patch as never, {
      onSuccess: () => {
        setDraft({});
        toast({ title: t("admin.settings.saved") });
      },
      onError: (err) => toast({ title: t("admin.settings.saveFailed"), description: (err as Error).message, variant: "destructive" }),
    });
  }

  const reconcileResult = reconcile.data;
  const driftCount = reconcileResult?.drift.length || 0;

  if (settingsQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.settings.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <div className="text-sm font-medium">{t("admin.settings.enabled")}</div>
              <div className="text-xs text-muted-foreground">{t("admin.settings.enabledHelp")}</div>
            </div>
            <Switch checked={value("is_enabled", false)} onCheckedChange={(v) => set("is_enabled", v)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.signupBonus")}</Label>
              <Input type="number" min="0" value={String(value("signup_bonus_minor", 0))} onChange={(e) => set("signup_bonus_minor", Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.payoutCurrency")}</Label>
              <Input value={String(value("payout_currency", "USD"))} onChange={(e) => set("payout_currency", e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.paidPercentage")}</Label>
              <Input type="number" min="0" max="10000" value={String(value("paid_percentage_bps", 0))} onChange={(e) => set("paid_percentage_bps", Number(e.target.value) || 0)} />
              <div className="text-[11px] text-muted-foreground">{t("admin.settings.paidPercentageHelp")}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.paidMax")}</Label>
              <Input type="number" min="0" value={String(value("paid_percentage_max_minor", 0) ?? 0)} onChange={(e) => set("paid_percentage_max_minor", Number(e.target.value) || null)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.recurringPercentage")}</Label>
              <Input type="number" min="0" max="10000" value={String(value("recurring_percentage_bps", 0))} onChange={(e) => set("recurring_percentage_bps", Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.recurringMaxCount")}</Label>
              <Input type="number" min="0" value={String(value("recurring_max_count", 0))} onChange={(e) => set("recurring_max_count", Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.minPayout")}</Label>
              <Input type="number" min="0" value={String(value("min_payout_minor", 0))} onChange={(e) => set("min_payout_minor", Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.eligibilityWindow")}</Label>
              <Input type="number" min="0" value={String(value("eligibility_window_days", 0))} onChange={(e) => set("eligibility_window_days", Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("admin.settings.reversalWindow")}</Label>
              <Input type="number" min="0" value={String(value("reversal_window_days", 0))} onChange={(e) => set("reversal_window_days", Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded border p-3">
            <div className="text-sm font-medium">{t("admin.settings.requirePaid")}</div>
            <Switch checked={value("require_referrer_paid", true)} onCheckedChange={(v) => set("require_referrer_paid", v)} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={Object.keys(draft).length === 0 || save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("admin.settings.saving")}</> : <><Save className="h-4 w-4 mr-2" />{t("admin.settings.save")}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.reconcile.title")}</CardTitle>
          <CardDescription>{t("admin.reconcile.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={reconcile.isPending} onClick={() => reconcile.mutate({ dryRun: true })}>
              <RefreshCw className="h-4 w-4 mr-1.5" />{t("admin.reconcile.dryRun")}
            </Button>
            <Button size="sm" disabled={reconcile.isPending} onClick={() => reconcile.mutate({ dryRun: false })}>
              {reconcile.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("admin.reconcile.running")}</> : t("admin.reconcile.run")}
            </Button>
          </div>
          {reconcileResult && (
            <Alert>
              <AlertTitle>
                {t("admin.reconcile.result", { count: reconcileResult.rowsChecked, drift: driftCount })}
              </AlertTitle>
              {driftCount === 0 && <AlertDescription>{t("admin.reconcile.noDrift")}</AlertDescription>}
              {driftCount > 0 && (
                <AlertDescription>
                  <pre className="text-xs whitespace-pre-wrap mt-2 max-h-72 overflow-y-auto">{JSON.stringify(reconcileResult.drift, null, 2)}</pre>
                </AlertDescription>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminReferralsPage() {
  const { t, i18n } = useTranslation(["referrals", "common"]);
  const [tab, setTab] = useState<StatusKey | "settings">("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const payouts = useAdminPayouts(tab === "settings" ? "pending" : tab);

  return (
    <AppLayout title={t("admin.title")} requireSuperAdmin>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Award className="h-5 w-5 text-primary" />{t("admin.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("admin.subtitle")}</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as StatusKey | "settings")}>
          <TabsList>
            {STATUS_KEYS.map((s) => (
              <TabsTrigger key={s} value={s}>{t(`admin.tabs.${s}`)}</TabsTrigger>
            ))}
            <TabsTrigger value="settings">{t("admin.tabs.settings")}</TabsTrigger>
          </TabsList>

          {STATUS_KEYS.map((s) => (
            <TabsContent key={s} value={s} className="mt-4">
              <Card>
                <CardContent className="pt-4">
                  {payouts.isLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <PayoutTable data={payouts.data?.data || []} onSelect={setSelectedId} locale={i18n.language} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          <TabsContent value="settings" className="mt-4">
            <SettingsForm />
          </TabsContent>
        </Tabs>
      </div>

      <PayoutDetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </AppLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "referrals"])),
  },
});
