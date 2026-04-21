import { useRouter } from "next/router";
import Link from "next/link";
import { useState } from "react";
import { SitePageShell, useSiteFromRoute, SiteLoadingSkeleton } from "@/components/site/shared";
import { createCustomer } from "@/services/customerService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function NewCustomerInner() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { id: siteId, store, loading } = useSiteFromRoute();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: "", first_name: "", last_name: "", username: "", password: "",
    billing: { first_name: "", last_name: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "", phone: "", email: "" } as Record<string, string>,
    shipping: { first_name: "", last_name: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "" } as Record<string, string>,
  });

  const copyBillingToShipping = () => setForm(p => ({ ...p, shipping: { first_name: p.billing.first_name, last_name: p.billing.last_name, address_1: p.billing.address_1, address_2: p.billing.address_2, city: p.billing.city, state: p.billing.state, postcode: p.billing.postcode, country: p.billing.country } }));

  const handleSave = async () => {
    if (!form.email) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomer(siteId, {
        email: form.email, first_name: form.first_name || undefined, last_name: form.last_name || undefined,
        username: form.username || undefined, password: form.password || undefined,
        billing: form.billing, shipping: form.shipping,
      });
      toast({ title: "Customer created" });
      await qc.invalidateQueries({ queryKey: ["customers", siteId] });
      router.push(`/sites/${siteId}/customers/${created.id}`);
    } catch (e) {
      const err = e as { message?: string };
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
      setSaving(false);
    }
  };

  if (loading) return <SiteLoadingSkeleton />;
  if (!store) return <div className="p-6">Store not found</div>;

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Link href={`/sites/${siteId}/customers`} className="mt-1 h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-semibold">New Customer</h1>
            <div className="text-xs text-primary mt-0.5">Customers / New</div>
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          {saving ? "Creating…" : "Create customer"}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-background p-5 space-y-5">
        <div>
          <div className="text-sm font-semibold mb-3">Account</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Email <span className="text-destructive">*</span></Label><Input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Username</Label><Input value={form.username} onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">First Name</Label><Input value={form.first_name} onChange={(e) => setForm(p => ({ ...p, first_name: e.target.value }))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Last Name</Label><Input value={form.last_name} onChange={(e) => setForm(p => ({ ...p, last_name: e.target.value }))} className="h-8 text-sm" /></div>
            <div className="md:col-span-2"><Label className="text-xs">Password (optional)</Label><Input type="password" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Leave empty to auto-generate" className="h-8 text-sm" /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border">
          <div>
            <div className="text-sm font-semibold mb-3">Billing Address</div>
            <AddressFields data={form.billing} onChange={(k, v) => setForm(p => ({ ...p, billing: { ...p.billing, [k]: v } }))} withContact />
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Shipping Address</div>
              <Button variant="ghost" size="sm" onClick={copyBillingToShipping} className="h-6 text-[11px]">Copy from billing</Button>
            </div>
            <AddressFields data={form.shipping} onChange={(k, v) => setForm(p => ({ ...p, shipping: { ...p.shipping, [k]: v } }))} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressFields({ data, onChange, withContact }: { data: Record<string, string>; onChange: (k: string, v: string) => void; withContact?: boolean }) {
  const fields: Array<{ k: string; l: string; full?: boolean }> = [
    { k: "first_name", l: "First name" }, { k: "last_name", l: "Last name" },
    { k: "address_1", l: "Address 1", full: true }, { k: "address_2", l: "Address 2", full: true },
    { k: "city", l: "City" }, { k: "state", l: "State / Region" },
    { k: "postcode", l: "Postcode" }, { k: "country", l: "Country (ISO)" },
  ];
  if (withContact) fields.push({ k: "phone", l: "Phone" }, { k: "email", l: "Email" });
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map(f => (
        <div key={f.k} className={f.full ? "col-span-2" : ""}>
          <Label className="text-[10px] text-muted-foreground">{f.l}</Label>
          <Input value={data[f.k] || ""} onChange={(e) => onChange(f.k, e.target.value)} className="h-8 text-xs" />
        </div>
      ))}
    </div>
  );
}

export default function NewCustomerPage() {
  return <SitePageShell><NewCustomerInner /></SitePageShell>;
}