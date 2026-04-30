import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type DiffRow = {
  id: string;
  field_path: string;
  before_value: unknown;
  after_value: unknown;
};

export function ActivityDetailSheet({
  activityId,
  open,
  onOpenChange,
}: {
  activityId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [fieldDiffs, setFieldDiffs] = useState<DiffRow[]>([]);
  const [metaJson, setMetaJson] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !activityId) return;
    let cancelled = false;
    setLoading(true);
    setFieldDiffs([]);
    setMetaJson(null);
    void (async () => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      const res = await fetch(`/api/activity/${activityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        activity?: { metadata?: unknown };
        fieldDiffs?: DiffRow[];
      };
      if (cancelled) return;
      setFieldDiffs(json.fieldDiffs ?? []);
      setMetaJson(
        json.activity?.metadata != null ? JSON.stringify(json.activity.metadata, null, 2) : null
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activityId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activity detail</DialogTitle>
        </DialogHeader>
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && fieldDiffs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No stored field-level rows for this event (e.g. auth-only or summary-only log).
          </p>
        )}
        {!loading && fieldDiffs.length > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2 font-medium">Field</th>
                  <th className="text-left p-2 font-medium">Before</th>
                  <th className="text-left p-2 font-medium">After</th>
                </tr>
              </thead>
              <tbody>
                {fieldDiffs.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="p-2 font-mono align-top whitespace-nowrap">{r.field_path}</td>
                    <td className="p-2 align-top break-all max-w-[200px]">{fmt(r.before_value)}</td>
                    <td className="p-2 align-top break-all max-w-[200px]">{fmt(r.after_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {metaJson && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Metadata</div>
            <pre className="text-[11px] bg-muted/50 p-3 rounded-md overflow-x-auto">{metaJson}</pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
