import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation, Trans } from "next-i18next";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listPaymentMethods, type PaymentMethodRow as PaymentMethod } from "@/services/paymentMethodService";
import { supabase } from "@/integrations/supabase/client";

type FormState = { id?: string; key: string; label: string; icon_url: string; description: string };
const empty: FormState = { key: "", label: "", icon_url: "", description: "" };

export default function PaymentMethodsPage() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(empty);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setMethods(await listPaymentMethods());
    } catch (e) {
      toast({ title: t("paymentMethods.toast.loadFailed"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startCreate = () => { setForm(empty); setOpen(true); };
  const startEdit = (m: PaymentMethod) => {
    setForm({ id: m.id, key: m.key, label: m.label, icon_url: m.icon_url ?? "", description: m.description ?? "" });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.key.trim() || !form.label.trim()) {
      toast({ title: t("paymentMethods.toast.keyLabelRequired"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { key: form.key.trim(), label: form.label.trim(), icon_url: form.icon_url || null, description: form.description || null };
      if (form.id) {
        const { error } = await supabase.from("payment_methods").update(payload).eq("id", form.id);
        if (error) throw error;
        toast({ title: t("paymentMethods.toast.updated") });
      } else {
        const { error } = await supabase.from("payment_methods").insert(payload);
        if (error) throw error;
        toast({ title: t("paymentMethods.toast.created") });
      }
      setOpen(false);
      load();
    } catch (e) {
      toast({ title: t("paymentMethods.toast.saveFailed"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("payment_methods").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: t("paymentMethods.toast.deleted") });
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast({ title: t("paymentMethods.toast.deleteFailed"), description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <AuthGuard requireSuperAdmin>
      <SettingsLayout title={t("paymentMethods.title")}>
        <div className="p-6 max-w-5xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-lg font-semibold">{t("paymentMethods.title")}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Trans i18nKey="paymentMethods.subtitle" ns="settings" components={{ code: <code className="px-1 py-0.5 rounded bg-muted text-foreground" /> }} />
              </p>
            </div>
            <Button size="sm" onClick={startCreate}><Plus className="h-3.5 w-3.5 mr-1.5" />{t("paymentMethods.addMethod")}</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-10 text-center text-sm text-muted-foreground">{t("translations.loading")}</div>
              ) : methods.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  {t("paymentMethods.empty")}
                  <div className="mt-3"><Button size="sm" variant="outline" onClick={startCreate}>{t("paymentMethods.addFirst")}</Button></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">{t("paymentMethods.columns.icon")}</TableHead>
                      <TableHead>{t("paymentMethods.columns.label")}</TableHead>
                      <TableHead>{t("paymentMethods.columns.key")}</TableHead>
                      <TableHead>{t("paymentMethods.columns.description")}</TableHead>
                      <TableHead className="w-24 text-right">{t("paymentMethods.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {methods.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          {m.icon_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.icon_url} alt={m.label} className="h-6 w-6 object-contain" />
                          ) : (
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{m.label}</TableCell>
                        <TableCell><code className="text-xs px-1.5 py-0.5 rounded bg-muted">{m.key}</code></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.description || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(m)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{form.id ? t("paymentMethods.dialog.editTitle") : t("paymentMethods.dialog.addTitle")}</DialogTitle>
                <DialogDescription>
                  <Trans i18nKey="paymentMethods.dialog.description" ns="settings" components={{ strong: <strong />, code: <code className="px-1 py-0.5 rounded bg-muted text-foreground" /> }} />
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">{t("paymentMethods.dialog.keyLabel")}</Label>
                  <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder={t("paymentMethods.dialog.keyPlaceholder")} />
                </div>
                <div>
                  <Label className="text-xs">{t("paymentMethods.dialog.labelLabel")}</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={t("paymentMethods.dialog.labelPlaceholder")} />
                </div>
                <div>
                  <Label className="text-xs">{t("paymentMethods.dialog.iconUrlLabel")}</Label>
                  <Input value={form.icon_url} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} placeholder={t("paymentMethods.dialog.iconUrlPlaceholder")} />
                </div>
                <div>
                  <Label className="text-xs">{t("paymentMethods.dialog.descriptionLabel")}</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("paymentMethods.dialog.cancel")}</Button>
                <Button onClick={submit} disabled={saving}>{form.id ? t("paymentMethods.dialog.update") : t("paymentMethods.dialog.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("paymentMethods.delete.title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("paymentMethods.delete.body", { label: deleteTarget?.label })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("paymentMethods.delete.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">{t("paymentMethods.delete.confirm")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SettingsLayout>
    </AuthGuard>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "settings"])),
  },
});