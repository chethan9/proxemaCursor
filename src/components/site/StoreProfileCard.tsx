import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, RefreshCw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateStore, type Store } from "@/services/storeService";

interface AddressShape {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
}

interface Props {
  store: Store;
  onSaved: () => void;
}

export function StoreProfileCard({ store, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string>(store.support_email ?? "");
  const [phone, setPhone] = useState<string>(store.phone ?? "");
  const [website, setWebsite] = useState<string>(store.website ?? "");
  const [addr, setAddr] = useState<AddressShape>((store.address as AddressShape | null) ?? {});

  useEffect(() => {
    setEmail(store.support_email ?? "");
    setPhone(store.phone ?? "");
    setWebsite(store.website ?? "");
    setAddr((store.address as AddressShape | null) ?? {});
  }, [store.id, store.support_email, store.phone, store.website, store.address]);

  const update = (k: keyof AddressShape, v: string) => setAddr((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateStore(store.id, {
        support_email: email || null,
        phone: phone || null,
        website: website || null,
        address: addr as never,
      });
      toast({ title: "Store profile saved" });
      onSaved();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">Store Profile</h2>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          Used in invoice headers, footers, and contact details on printed documents.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px]">Support email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@store.com" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" className="h-8 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Website</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className="h-8 text-sm" />
        </div>

        <div className="pt-2 border-t space-y-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Store Address</p>
          <div className="space-y-1">
            <Label className="text-[11px]">Line 1</Label>
            <Input value={addr.line1 ?? ""} onChange={(e) => update("line1", e.target.value)} placeholder="100 Main Street" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Line 2</Label>
            <Input value={addr.line2 ?? ""} onChange={(e) => update("line2", e.target.value)} placeholder="Suite 200" className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px]">City</Label>
              <Input value={addr.city ?? ""} onChange={(e) => update("city", e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">State</Label>
              <Input value={addr.state ?? ""} onChange={(e) => update("state", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px]">Country</Label>
              <Input value={addr.country ?? ""} onChange={(e) => update("country", e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Zip / Postcode</Label>
              <Input value={addr.zip ?? ""} onChange={(e) => update("zip", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8">
            {saving ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}