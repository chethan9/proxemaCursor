import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Files, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listTemplates } from "@/services/templateService";
import { resolveDefaultTemplateForPrint } from "@/lib/template-resolve-default";
import { useAuth } from "@/contexts/AuthProvider";
import { createBulkJob } from "@/services/bulkJobService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const HARD_CAP = 500;
const SOFT_CAP = 100;

type OutputMode = "single-pdf" | "zip";

export function PrintInvoicesDialog({
  open,
  onOpenChange,
  storeId,
  orderIds,
  onQueued,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  orderIds: string[];
  onQueued?: () => void;
}) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const clientId = profile?.client_id ?? null;
  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ["templates", "invoice"],
    queryFn: () => listTemplates("invoice"),
    staleTime: 60_000,
    enabled: open,
  });

  const defaultTpl = useMemo(
    () => resolveDefaultTemplateForPrint(templates, "invoice", clientId),
    [templates, clientId],
  );

  const [templateId, setTemplateId] = useState<string>("");
  const [outputMode, setOutputMode] = useState<OutputMode>("single-pdf");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedLargeBatch, setConfirmedLargeBatch] = useState(false);

  useEffect(() => {
    if (open && defaultTpl && !templateId) setTemplateId(defaultTpl.id);
  }, [open, defaultTpl, templateId]);

  useEffect(() => {
    if (!open) {
      setConfirmedLargeBatch(false);
      setSubmitting(false);
    }
  }, [open]);

  const overHardCap = orderIds.length > HARD_CAP;
  const overSoftCap = orderIds.length > SOFT_CAP;
  const needsConfirmation = overSoftCap && !confirmedLargeBatch;

  const submit = async () => {
    if (!templateId || overHardCap) return;
    if (needsConfirmation) {
      setConfirmedLargeBatch(true);
      return;
    }
    setSubmitting(true);
    try {
      const job = await createBulkJob({
        store_id: storeId,
        job_type: "print_invoices_bulk",
        total: orderIds.length,
        payload: {
          type: "print_invoices_bulk",
          order_ids: orderIds,
          template_id: templateId,
          output_mode: outputMode,
        },
      });
      const tplName = templates.find((t) => t.id === templateId)?.name || "Invoice";
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) {
          await fetch("/api/activity/client-event", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "sites.invoice.print_queued",
              entity_type: "bulk_job",
              entity_id: job.id,
              store_id: storeId,
              module: "sites",
              metadata: {
                order_count: orderIds.length,
                template_id: templateId,
                template_name: tplName,
                output_mode: outputMode,
              },
            }),
          });
        }
      } catch {
        /* non-fatal */
      }
      toast({
        title: "Generating invoices…",
        description: `Processing ${orderIds.length} order${orderIds.length === 1 ? "" : "s"}. Download will appear when ready.`,
      });
      onQueued?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (typeof err === "object" && err !== null ? JSON.stringify(err) : String(err));
      console.error("Print job queue failed:", err);
      toast({
        title: "Failed to queue print job",
        description: msg || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Print invoices</DialogTitle>
          <DialogDescription>
            Generate invoices for {orderIds.length} selected order{orderIds.length === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Template</Label>
            {tplLoading ? (
              <div className="h-9 flex items-center text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded px-2 py-1.5">
                No invoice templates exist. Create one in Templates first.
              </div>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">
                      {t.name}
                      {t.is_default_for_type && <span className="ml-2 text-[10px] text-muted-foreground">(default)</span>}
                      {t.is_sample && <span className="ml-2 text-[10px] text-muted-foreground">(sample)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Output</Label>
            <RadioGroup value={outputMode} onValueChange={(v) => setOutputMode(v as OutputMode)} className="space-y-1.5">
              <label className="flex items-start gap-2.5 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/40 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="single-pdf" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium"><FileText className="h-3.5 w-3.5" />Single PDF</div>
                  <div className="text-[11px] text-muted-foreground">All invoices merged into one document with page breaks.</div>
                </div>
              </label>
              <label className="flex items-start gap-2.5 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/40 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="zip" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium"><Files className="h-3.5 w-3.5" />ZIP of PDFs</div>
                  <div className="text-[11px] text-muted-foreground">One PDF per order, packed into a single zip archive.</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {overHardCap && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>Maximum {HARD_CAP} orders per batch. Reduce your selection.</span>
            </div>
          )}
          {!overHardCap && overSoftCap && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 px-2.5 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
              <span className="text-amber-900 dark:text-amber-200">
                {confirmedLargeBatch
                  ? `Confirmed: generating ${orderIds.length} invoices may take several minutes.`
                  : `You selected ${orderIds.length} orders. This may take several minutes — click again to confirm.`}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || overHardCap || !templateId || templates.length === 0}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Queueing…</> : needsConfirmation ? "Confirm & generate" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}