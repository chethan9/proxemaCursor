import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { ClientWithStats } from "@/services/clientService";

const SCOPES = [
  { id: "read", label: "Read", desc: "Read products, orders, customers" },
  { id: "write", label: "Write", desc: "Create and update records" },
  { id: "delete", label: "Delete", desc: "Delete records" },
  { id: "webhooks", label: "Webhooks", desc: "Manage webhooks" },
  { id: "sync", label: "Sync", desc: "Trigger sync operations" },
];

interface CreateKeyDialogProps {
  clients: ClientWithStats[];
  onCreate: (data: {
    name: string;
    clientId: string;
    scopes: string[];
    rateLimit: number;
    allowedOrigins?: string[];
    expiresAt: string | null;
  }) => Promise<void>;
}

export function CreateKeyDialog({ clients, onCreate }: CreateKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [rateLimit, setRateLimit] = useState("1000");
  const [origins, setOrigins] = useState("");
  const [expiry, setExpiry] = useState("");
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setName("");
    setClientId("");
    setScopes(["read"]);
    setRateLimit("1000");
    setOrigins("");
    setExpiry("");
  };

  const handleCreate = async () => {
    if (!name || !clientId) return;
    setCreating(true);
    try {
      await onCreate({
        name,
        clientId,
        scopes,
        rateLimit: parseInt(rateLimit) || 1000,
        allowedOrigins: origins ? origins.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        expiresAt: expiry || null,
      });
      reset();
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Create API Key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>Generate a bearer token for downstream app access</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Key Name</Label>
            <Input placeholder="e.g. Flutter App Production" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Scopes</Label>
            <div className="grid grid-cols-2 gap-2">
              {SCOPES.map((s) => (
                <label key={s.id} className="flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Checkbox
                    className="mt-0.5"
                    checked={scopes.includes(s.id)}
                    onCheckedChange={(v) => setScopes((prev) => v ? [...prev, s.id] : prev.filter((x) => x !== s.id))}
                  />
                  <div className="leading-tight">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rate Limit (req/hr)</Label>
              <Input type="number" value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Expires</Label>
              <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Allowed Origins</Label>
            <Input placeholder="app.example.com, *.example.com" value={origins} onChange={(e) => setOrigins(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Comma-separated. Leave empty to allow all.</p>
          </div>

          <Button onClick={handleCreate} className="w-full" disabled={!name || !clientId || creating}>
            {creating ? "Creating..." : "Create Key"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}