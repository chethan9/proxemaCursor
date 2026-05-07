import type { TFunction } from "i18next";
import { useRouter } from "next/router";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "next-i18next";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { createCustomer } from "@/services/customerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useSiteMutation } from "@/hooks/useSiteMutation";
import { useToast } from "@/hooks/use-toast";

function NewCustomerInner() {
  const { t } = useTranslation("site");
  const router = useRouter();
  const { toast } = useToast();
  const { id: siteId, store, loading } = useSiteFromRoute();

  const [form, setForm] = useState({
    email: "", first_name: "", last_name: "", username: "", password: "",
    billing: { first_name: "", last_name: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "", phone: "", email: "" } as Record<string, string>,
    shipping: { first_name: "", last_name: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "" } as Record<string, string>,
  });

  const copyBillingToShipping = () => setForm(p => ({ ...p, shipping: { first_name: p.billing.first_name, last_name: p.billing.last_name, address_1: p.billing.address_1, address_2: p.billing.address_2, city: p.billing.city, state: p.billing.state, postcode: p.billing.postcode, country: p.billing.country } }));

  const create = useSiteMutation<{ id: string }, void>({
    mutationFn: () => createCustomer(siteId, {
      email: form.email, first_name: form.first_name || undefined, last_name: form.last_name || undefined,
      username: form.username || undefined, password: form.password || undefined,
      billing: form.billing, shipping: form.shipping,
    }),
    invalidateKeys: [["customers", siteId]],
    siteName: store?.name,
    onSuccessExtra: (created) => {
      toast({
        title: store?.name
          ? t("customers.newPage.savedToStore", { siteName: store.name })
          : t("customers.newPage.saved"),
        description: t("customers.newPage.toastCreated"),
      });
      router.push(`/sites/${siteId}/customers/${created.id}`);
    },
  });

  const handleSave = () => {
    if (!form.email) {
      toast({ title: t("customers.newPage.emailRequired"), variant: "destructive" });
      return;
    }
    create.mutate();
  };

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">{t("customers.newPage.storeNotFound")}</div>;

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Link href={`/sites/${siteId}/customers`} className="mt-1 h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-semibold">{t("customers.newPage.title")}</h1>
            <div className="text-xs text-primary mt-0.5">{t("customers.newPage.breadcrumb")}</div>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          {create.isPending ? t("customers.newPage.creating") : t("customers.newPage.create")}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-background p-5 space-y-5">
        <div>
          <div className="text-sm font-semibold mb-3">{t("customers.newPage.account")}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">{t("customerDetail.form.email")} <span className="text-destructive">*</span></Label><Input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">{t("customerDetail.form.username")}</Label><Input value={form.username} onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">{t("customerDetail.form.firstName")}</Label><Input value={form.first_name} onChange={(e) => setForm(p => ({ ...p, first_name: e.target.value }))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">{t("customerDetail.form.lastName")}</Label><Input value={form.last_name} onChange={(e) => setForm(p => ({ ...p, last_name: e.target.value }))} className="h-8 text-sm" /></div>
            <div className="md:col-span-2"><Label className="text-xs">{t("customers.newPage.passwordOptional")}</Label><Input type="password" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} placeholder={t("customers.newPage.passwordPlaceholder")} className="h-8 text-sm" /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border">
          <div>
            <div className="text-sm font-semibold mb-3">{t("customerDetail.address.billingTitle")}</div>
            <AddressFields t={t} data={form.billing} onChange={(k, v) => setForm(p => ({ ...p, billing: { ...p.billing, [k]: v } }))} withContact />
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">{t("customerDetail.address.shippingTitle")}</div>
              <Button variant="ghost" size="sm" onClick={copyBillingToShipping} className="h-6 text-[11px]">{t("customers.newPage.copyFromBilling")}</Button>
            </div>
            <AddressFields t={t} data={form.shipping} onChange={(k, v) => setForm(p => ({ ...p, shipping: { ...p.shipping, [k]: v } }))} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressFields({
  t,
  data,
  onChange,
  withContact,
}: {
  t: TFunction;
  data: Record<string, string>;
  onChange: (k: string, v: string) => void;
  withContact?: boolean;
}) {
  const fields: Array<{ k: string; label: string; full?: boolean }> = [
    { k: "first_name", label: t("customerDetail.address.firstName") },
    { k: "last_name", label: t("customerDetail.address.lastName") },
    { k: "address_1", label: t("customerDetail.address.address1"), full: true },
    { k: "address_2", label: t("customerDetail.address.address2"), full: true },
    { k: "city", label: t("customerDetail.address.city") },
    { k: "state", label: t("customerDetail.address.stateRegion") },
    { k: "postcode", label: t("customerDetail.address.postcode") },
    { k: "country", label: t("customers.newPage.countryIso") },
  ];
  if (withContact) {
    fields.push({ k: "phone", label: t("customerDetail.address.phone") }, { k: "email", label: t("customerDetail.address.email") });
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((f) => (
        <div key={f.k} className={f.full ? "col-span-2" : ""}>
          <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
          <Input value={data[f.k] || ""} onChange={(e) => onChange(f.k, e.target.value)} className="h-8 text-xs" />
        </div>
      ))}
    </div>
  );
}

export default function NewCustomerPage() {
  return <SitePageShell><NewCustomerInner /></SitePageShell>;
}
