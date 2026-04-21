import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Copy, Shield, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import type { WafFix } from "@/lib/waf-fixes";
import type { BlockingService } from "@/lib/sync-error";

interface ProbeResult {
  name: string;
  label: string;
  url: string;
  status: number | null;
  ok: boolean;
  duration_ms: number;
  blocking_service: BlockingService | null;
  blocking_hint: string | null;
  body_preview: string;
  error: string | null;
}

interface DiagnosticReport {
  overall_status: "ok" | "auth_failed" | "blocked" | "unreachable";
  detected_service: BlockingService | null;
  probes: ProbeResult[];
  fix: WafFix | null;
  tested_at: string;
}

interface Props {
  storeId: string;
  autoRun?: boolean;
  onResolved?: () => void;
  compact?: boolean;
}

export function ConnectionDiagnostic({ storeId, autoRun = false, onResolved }: Props) {
  const { toast } = useToast();
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSteps, setShowSteps] = useState(true);
  const [ranOnce, setRanOnce] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/diagnose`, { method: "POST" });
      if (res.status === 429) {
        const body = await res.json();
        toast({ title: "Too fast", description: body.error, variant: "destructive" });
        return;
      }
      const json = (await res.json()) as DiagnosticReport;
      setReport(json);
      setRanOnce(true);
      if (json.overall_status === "ok") {
        toast({ title: "Connection healthy", description: "All probes passed." });
        onResolved?.();
      }
    } catch (e) {
      toast({ title: "Diagnostic failed", description: e instanceof Error ? e.message : "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    if (autoRun && !ranOnce) runDiagnostic();
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `${label} copied to clipboard` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (!report && !loading && !ranOnce) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Connection Diagnostic</p>
              <p className="text-xs text-muted-foreground">Run 3 probes to check what&apos;s blocking connectivity</p>
            </div>
          </div>
          <Button onClick={runDiagnostic} size="sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Run Test
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading && !report) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-6 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Running diagnostic probes...</p>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  const { overall_status, probes, fix, detected_service } = report;
  const isHealthy = overall_status === "ok";

  const statusColor = isHealthy ? "border-emerald-500/40 bg-emerald-50/50" : overall_status === "blocked" ? "border-amber-500/40 bg-amber-50/50" : "border-red-500/40 bg-red-50/50";
  const statusIcon = isHealthy ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : overall_status === "blocked" ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <XCircle className="h-5 w-5 text-red-600" />;
  const statusTitle = isHealthy
    ? "Connection is healthy"
    : overall_status === "blocked"
      ? fix?.title || "Connection is blocked"
      : overall_status === "auth_failed"
        ? "Authentication failed"
        : "Site is unreachable";

  return (
    <Card className={statusColor}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          {statusIcon}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{statusTitle}</p>
            {detected_service && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Detected: <span className="font-medium capitalize">{detected_service.replace("-", " ")}</span>
                {fix?.vendorUrl && (
                  <>
                    {" "}•{" "}
                    <a href={fix.vendorUrl} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-0.5 hover:underline">
                      Open {fix.vendorName} <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={runDiagnostic} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            {!loading && "Run again"}
          </Button>
        </div>

        <div className="grid gap-1.5">
          {probes.map((p) => (
            <div key={p.name} className="flex items-center gap-2 rounded-md bg-white/60 px-2.5 py-1.5">
              {p.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              ) : p.blocking_service ? (
                <Shield className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
              )}
              <span className="text-xs font-medium flex-1 truncate">{p.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{p.duration_ms}ms</span>
              <StatusBadge variant={p.ok ? "success" : p.blocking_service ? "warning" : "error"}>
                {p.status ? `HTTP ${p.status}` : p.error ? "Error" : "No response"}
              </StatusBadge>
            </div>
          ))}
        </div>

        {!isHealthy && fix && (
          <div className="rounded-lg border bg-white/60 overflow-hidden">
            <button
              onClick={() => setShowSteps((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">How to fix — {fix.vendorName}</span>
              </div>
              {showSteps ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showSteps && (
              <div className="px-3 pb-3 space-y-3 border-t">
                <ol className="text-xs space-y-1.5 pt-3 list-decimal pl-4">
                  {fix.steps.map((step, i) => (
                    <li key={i} className="text-foreground/80 leading-relaxed">{step}</li>
                  ))}
                </ol>

                {fix.copyableExpression && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">{fix.copyableExpressionLabel || "Paste this"}:</p>
                    <div className="relative">
                      <pre className="text-[11px] bg-slate-900 text-slate-100 rounded p-2.5 pr-10 overflow-x-auto font-mono whitespace-pre-wrap break-all">{fix.copyableExpression}</pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1 h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
                        onClick={() => copyToClipboard(fix.copyableExpression!, "Expression")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => copyToClipboard(fix.adminMessage, "Admin message")}
                    className="gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy fix for site admin
                  </Button>
                  <span className="text-[11px] text-muted-foreground">Paste this into email/Slack for your site admin</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}