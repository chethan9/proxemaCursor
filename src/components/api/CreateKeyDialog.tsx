import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ClientWithStats } from "@/services/clientService";

const SCOPES = [
  { id: "read", label: "Read", description: "Read products, orders, customers" },
  { id: "write", label: "Write", description: "Create and update records" },
  { id: "delete", label: "Delete", description: "Delete records" },
  { id: "webhooks", label: "Webhooks", description: "Manage webhooks" },
  { id: "sync", label: "Sync", description: "Trigger sync operations" },
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [rateLimit, setRateLimit] = useState(1000);
  const [expiresAt, setExpiresAt] = useState("");
  const [origins, setOrigins] = useState("");
  const [creating, setCreating] = useState(false);

  const toggleScope = (id: string) => {
    setScopes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!clientId) {
      toast({ title: "Client required", variant: "destructive" });
      return;
    }
    if (scopes.length === 0) {
      toast({ title: "At least one scope required", variant: "destructive" });
      return;
    }
    setCreating(true);
    const originsArr = origins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    await onCreate({
      name: name.trim(),
      clientId,
      scopes,
      rateLimit,
      allowedOrigins: originsArr.length > 0 ? originsArr : undefined,
      expiresAt: expiresAt || null,
    });
    setCreating(false);
    setOpen(false);
    setName("");
    setClientId("");
    setScopes(["read"]);
    setRateLimit(1000);
    setExpiresAt("");
    setOrigins("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          Create API Key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>Generate a bearer token for downstream app access</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Flutter App Production"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="key-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="grid grid-cols-2 gap-2">
              {SCOPES.map((s) => {
                const checked = scopes.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer transition-colors ${
                      checked ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleScope(s.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-none">{s.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-snug">
                        {s.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="key-rate">Rate Limit (req/hr)</Label>
              <Input
                id="key-rate"
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(parseInt(e.target.value) || 1000)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key-expires">Expires</Label>
              <Input
                id="key-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="key-origins">Allowed Origins</Label>
            <Input
              id="key-origins"
              placeholder="app.example.com, *.example.com"
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Leave empty to allow all.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={creating}>
              {creating ? "Creating..." : "Create Key"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}