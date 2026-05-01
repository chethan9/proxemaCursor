import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Cloud, FlaskConical } from "lucide-react";

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

type SettingsResponse = {
  row: {
    enabled: boolean;
    prefer_database_over_env: boolean;
    account_id: string | null;
    images_account_hash: string | null;
    api_token_configured: boolean;
    variant_thumb: string;
    variant_card: string;
    variant_edit: string;
    variant_zoom: string;
    mirror_metrics_enabled: boolean;
    repair_batch_size: number | null;
    updated_at: string | null;
  } | null;
  resolvedSource: "database" | "env" | null;
  resolvedActive: boolean;
  envFallbackAvailable: boolean;
};

function Inner() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [apiToken, setApiToken] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cloudflare-images-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-settings", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<SettingsResponse>;
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [preferDb, setPreferDb] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [accountHash, setAccountHash] = useState("");
  const [vThumb, setVThumb] = useState("thumb");
  const [vCard, setVCard] = useState("card");
  const [vEdit, setVEdit] = useState("edit");
  const [vZoom, setVZoom] = useState("zoom");
  const [metrics, setMetrics] = useState(false);
  const [repairBatch, setRepairBatch] = useState<number | "">("");

  useEffect(() => {
    const r = data?.row;
    if (!r) return;
    setEnabled(r.enabled);
    setPreferDb(r.prefer_database_over_env);
    setAccountId(r.account_id || "");
    setAccountHash(r.images_account_hash || "");
    setVThumb(r.variant_thumb || "thumb");
    setVCard(r.variant_card || "card");
    setVEdit(r.variant_edit || "edit");
    setVZoom(r.variant_zoom || "zoom");
    setMetrics(r.mirror_metrics_enabled);
    setRepairBatch(r.repair_batch_size ?? "");
  }, [data?.row]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          enabled,
          prefer_database_over_env: preferDb,
          account_id: accountId || null,
          images_account_hash: accountHash || null,
          api_token: apiToken.trim() || undefined,
          variant_thumb: vThumb,
          variant_card: vCard,
          variant_edit: vEdit,
          variant_zoom: vZoom,
          mirror_metrics_enabled: metrics,
          repair_batch_size: repairBatch === "" ? null : Number(repairBatch),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Save failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cloudflare-images-settings"] });
      setApiToken("");
      toast({ title: t("cloudflareImages.saved", "Settings saved") });
    },
    onError: (e) =>
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  const testConn = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloudflare-images-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ action: "test" }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(j.error || "Test failed");
      return j;
    },
    onSuccess: (j) => {
      toast({
        title: j.ok ? t("cloudflareImages.testOk", "Connection OK") : "Failed",
        variant: j.ok ? "default" : "destructive",
      });
    },
    onError: (e) =>
      toast({
        title: "Test failed",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      }),
  });

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Cloud className="h-7 w-7 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">{t("cloudflareImages.title", "Cloudflare Images")}</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {t(
            "cloudflareImages.subtitle",
            "Configure platform-wide product image mirroring. Credentials are encrypted in the database; environment variables are still supported as a fallback."
          )}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {data && (
        <Alert>
          <AlertTitle>{t("cloudflareImages.statusTitle", "Runtime status")}</AlertTitle>
          <AlertDescription className="text-sm space-y-1">
            <div>
              {t("cloudflareImages.active", "Mirroring active")}:{" "}
              <strong>{data.resolvedActive ? t("common.yes", "Yes") : t("common.no", "No")}</strong>
              {data.resolvedSource ? ` (${data.resolvedSource})` : ""}
            </div>
            <div className="text-muted-foreground">
              {t("cloudflareImages.envFallback", "Environment fallback available")}:{" "}
              {data.envFallbackAvailable ? t("common.yes", "Yes") : t("common.no", "No")}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("cloudflareImages.flags", "Feature flags")}</CardTitle>
          <CardDescription>
            {t("cloudflareImages.flagsHint", "Turn on only after API token and account details are set.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="en">{t("cloudflareImages.enableIntegration", "Enable Cloudflare Images mirroring")}</Label>
            <Switch id="en" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pdb">{t("cloudflareImages.preferDb", "Prefer database credentials over environment")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("cloudflareImages.preferDbHint", "When off, Vercel/host env vars take priority if set.")}
              </p>
            </div>
            <Switch id="pdb" checked={preferDb} onCheckedChange={setPreferDb} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="met">{t("cloudflareImages.metrics", "Emit JSON mirror metrics to logs")}</Label>
            <Switch id="met" checked={metrics} onCheckedChange={setMetrics} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cloudflareImages.credentials", "API credentials")}</CardTitle>
          <CardDescription>
            {t(
              "cloudflareImages.credentialsHint",
              "Account ID and Images delivery hash are non-secret. API token is stored encrypted (same key as payment credentials)."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aid">{t("cloudflareImages.accountId", "Cloudflare account ID")}</Label>
            <Input id="aid" value={accountId} onChange={(e) => setAccountId(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hash">{t("cloudflareImages.imagesHash", "Images account hash (imagedelivery.net)")}</Label>
            <Input id="hash" value={accountHash} onChange={(e) => setAccountHash(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tok">
              {t("cloudflareImages.apiToken", "API token")}{" "}
              {data?.row?.api_token_configured ? (
                <span className="text-muted-foreground font-normal">({t("cloudflareImages.configured", "configured")})</span>
              ) : null}
            </Label>
            <Input
              id="tok"
              type="password"
              autoComplete="new-password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={t("cloudflareImages.tokenPlaceholder", "Leave blank to keep existing")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cloudflareImages.variants", "Variant names")}</CardTitle>
          <CardDescription>
            {t("cloudflareImages.variantsHint", "Must match variants defined in your Cloudflare Images dashboard.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vt">thumb</Label>
            <Input id="vt" value={vThumb} onChange={(e) => setVThumb(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vc">card</Label>
            <Input id="vc" value={vCard} onChange={(e) => setVCard(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ve">edit</Label>
            <Input id="ve" value={vEdit} onChange={(e) => setVEdit(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vz">zoom</Label>
            <Input id="vz" value={vZoom} onChange={(e) => setVZoom(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cloudflareImages.repair", "Repair cron")}</CardTitle>
          <CardDescription>{t("cloudflareImages.repairHint", "Max rows processed per repair cron run (10–500).")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="rb">{t("cloudflareImages.repairBatch", "Repair batch size")}</Label>
            <Input
              id="rb"
              type="number"
              min={10}
              max={500}
              value={repairBatch}
              onChange={(e) => setRepairBatch(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>{t("cloudflareImages.clientEnvTitle", "Storefront / catalog")}</AlertTitle>
        <AlertDescription>
          {t(
            "cloudflareImages.clientEnvBody",
            "Set NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES=true on Vercel so the product grid and editor use mirrored URLs when available."
          )}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {t("cloudflareImages.save", "Save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => testConn.mutate()} disabled={testConn.isPending}>
          {testConn.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
          {t("cloudflareImages.test", "Test connection")}
        </Button>
      </div>
    </div>
  );
}

export default function AdminCloudflareImagesPage() {
  return (
    <SettingsLayout title="Cloudflare Images" requireSuperAdmin>
      <Inner />
    </SettingsLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
