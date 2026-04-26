import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Star } from "lucide-react";
import { listTemplates, setDefaultForType } from "@/services/templateService";
import { useToast } from "@/hooks/use-toast";

interface Props { clientId: string | null }

export function DefaultTemplatesCard({ clientId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: invoices = [] } = useQuery({
    queryKey: ["templates", "invoice", clientId],
    queryFn: () => listTemplates("invoice"),
    enabled: !!clientId,
  });
  const { data: pickslips = [] } = useQuery({
    queryKey: ["templates", "pickslip", clientId],
    queryFn: () => listTemplates("pickslip"),
    enabled: !!clientId,
  });

  const defaultInvoice = invoices.find((t) => t.is_default_for_type && !t.is_sample)?.id ?? "";
  const defaultPickslip = pickslips.find((t) => t.is_default_for_type && !t.is_sample)?.id ?? "";

  const setDefault = useMutation({
    mutationFn: async (vars: { id: string; type: "invoice" | "pickslip" }) => {
      if (!clientId) throw new Error("No client");
      await setDefaultForType(clientId, vars.type, vars.id);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["templates", vars.type] });
      toast({ title: "Default template updated" });
    },
    onError: (e) => toast({ title: "Failed", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const userInvoices = invoices.filter((t) => !t.is_sample);
  const userPickslips = pickslips.filter((t) => !t.is_sample);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold">Default templates</h2>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Star className="h-3 w-3 text-amber-500" /> Default invoice
            </Label>
            {userInvoices.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No custom invoice templates yet. Customize a sample on the <a href="/templates" className="underline">Templates page</a>.</p>
            ) : (
              <Select
                value={defaultInvoice}
                onValueChange={(v) => setDefault.mutate({ id: v, type: "invoice" })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Select invoice template" /></SelectTrigger>
                <SelectContent>
                  {userInvoices.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Star className="h-3 w-3 text-amber-500" /> Default pick slip
            </Label>
            {userPickslips.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No custom pick-slip templates yet.</p>
            ) : (
              <Select
                value={defaultPickslip}
                onValueChange={(v) => setDefault.mutate({ id: v, type: "pickslip" })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Select pick-slip template" /></SelectTrigger>
                <SelectContent>
                  {userPickslips.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Defaults apply across your account when downloading invoices or pick slips from order pages.</p>
        </div>
      </CardContent>
    </Card>
  );
}