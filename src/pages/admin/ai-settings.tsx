import { useState } from "react";
import type { GetStaticProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}` };
}

function Inner() {
  const { t } = useTranslation("admin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [gemini, setGemini] = useState("");
  const [openai, setOpenai] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-ai-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai-settings", { headers: await authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        providers: Record<string, { configured: boolean; isActive: boolean; updatedAt: string | null }>;
      }>;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          google_gemini: gemini.trim() ? { apiKey: gemini.trim() } : undefined,
          openai_image: openai.trim() ? { apiKey: openai.trim() } : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Save failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ai-settings"] });
      setGemini("");
      setOpenai("");
      toast({ title: t("ai.saved") });
    },
    onError: (e) => toast({ title: "Error", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("ai.settingsTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("ai.settingsSubtitle")}</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>google_gemini</CardTitle>
          <CardDescription>
            {data?.providers?.google_gemini?.configured ? "Configured" : "Not configured"}
            {data?.providers?.google_gemini?.updatedAt ? ` · ${data.providers.google_gemini.updatedAt}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="gem">{t("ai.geminiKey")}</Label>
          <Input id="gem" type="password" autoComplete="off" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder="••••••••" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>openai_image</CardTitle>
          <CardDescription>
            {data?.providers?.openai_image?.configured ? "Configured" : "Not configured"}
            {data?.providers?.openai_image?.updatedAt ? ` · ${data.providers.openai_image.updatedAt}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="oai">{t("ai.openaiKey")}</Label>
          <Input id="oai" type="password" autoComplete="off" value={openai} onChange={(e) => setOpenai(e.target.value)} placeholder="••••••••" />
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending || (!gemini.trim() && !openai.trim())}>
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {t("ai.save")}
      </Button>
    </div>
  );
}

export default function AdminAiSettingsPage() {
  return (
    <AppLayout title="AI providers" requireSuperAdmin bypassBillingGate>
      <Inner />
    </AppLayout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common", "admin"])),
  },
});
