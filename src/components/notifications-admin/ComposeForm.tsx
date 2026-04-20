import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotificationPreview } from "./NotificationPreview";
import { sendNotification, fetchProfilesLite, fetchClientsLite, fetchRolesLite, type ComposePayload, type NotificationType } from "@/services/notificationAdminService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Search, Loader2 } from "lucide-react";

const TYPES: { value: NotificationType; label: string; desc: string }[] = [
  { value: "celebration", label: "Celebration", desc: "Full-screen confetti + modal" },
  { value: "announcement", label: "Announcement", desc: "Centered modal with image/animation" },
  { value: "ad", label: "Ad / Promo", desc: "Bottom-right corner banner" },
  { value: "milestone", label: "Milestone", desc: "Top-right toast with trophy" },
  { value: "info", label: "Info toast", desc: "Quick info toast" },
  { value: "warning", label: "Warning toast", desc: "Destructive-styled toast" },
];

export function ComposeForm({ prefill, onSent }: { prefill?: Partial<ComposePayload>; onSent?: () => void }) {
  const { toast } = useToast();
  const [type, setType] = useState<NotificationType>(prefill?.type || "announcement");
  const [title, setTitle] = useState(prefill?.title || "");
  const [body, setBody] = useState(prefill?.body || "");
  const [ctaLabel, setCtaLabel] = useState(prefill?.cta_label || "");
  const [ctaUrl, setCtaUrl] = useState(prefill?.cta_url || "");
  const [imageUrl, setImageUrl] = useState(prefill?.image_url || "");
  const [lottieUrl, setLottieUrl] = useState(prefill?.lottie_url || "");
  const [priority, setPriority] = useState(prefill?.priority ?? 50);
  const [expiresAt, setExpiresAt] = useState("");
  const [targeting, setTargeting] = useState<ComposePayload["targeting"]>(prefill?.targeting || "broadcast");
  const [targetUserIds, setTargetUserIds] = useState<string[]>(prefill?.target_user_ids || []);
  const [targetClientId, setTargetClientId] = useState<string>(prefill?.target_client_id || "");
  const [targetRole, setTargetRole] = useState<string>(prefill?.target_role || "");
  const [userSearch, setUserSearch] = useState("");
  const [sending, setSending] = useState(false);

  const { data: profiles = [] } = useQuery({ queryKey: ["admin-profiles-lite"], queryFn: fetchProfilesLite });
  const { data: clients = [] } = useQuery({ queryKey: ["admin-clients-lite"], queryFn: fetchClientsLite });
  const { data: roles = [] } = useQuery({ queryKey: ["admin-roles-lite"], queryFn: fetchRolesLite });

  const filteredProfiles = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return profiles;
    return profiles.filter((p) => (p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q));
  }, [profiles, userSearch]);

  const toggleUser = (id: string) => {
    setTargetUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSend = async () => {
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    setSending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type, title, body: body || undefined, cta_label: ctaLabel || undefined, cta_url: ctaUrl || undefined,
          image_url: imageUrl || undefined, lottie_url: lottieUrl || undefined,
          priority, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          targeting, target_user_ids: targetUserIds, target_client_id: targetClientId || undefined, target_role: targetRole || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error);
      }
      const json = await res.json();
      toast({ title: "Notification sent", description: `Delivered to ${json.count} recipient${json.count === 1 ? "" : "s"}` });
      setTitle(""); setBody(""); setCtaLabel(""); setCtaUrl(""); setImageUrl(""); setLottieUrl("");
      setTargetUserIds([]);
      onSent?.();
    } catch (e) {
      toast({ title: "Send failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
      <div className="space-y-5">
        <Card className="p-5 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`text-left p-3 rounded-lg border transition ${type === t.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your notification title" />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Optional body text" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>CTA label</Label><Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Learn more" /></div>
            <div className="space-y-2"><Label>CTA URL</Label><Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Image URL</Label><Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></div>
            <div className="space-y-2"><Label>Lottie JSON URL</Label><Input value={lottieUrl} onChange={(e) => setLottieUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority: {priority}</Label>
              <Slider value={[priority]} onValueChange={(v) => setPriority(v[0])} min={0} max={100} step={1} />
            </div>
            <div className="space-y-2">
              <Label>Expires at</Label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Targeting</Label>
          <div className="grid grid-cols-4 gap-2">
            {(["broadcast", "users", "client", "role"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setTargeting(v)}
                className={`p-2 text-sm rounded-lg border capitalize ${targeting === v ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                {v}
              </button>
            ))}
          </div>
          {targeting === "broadcast" && <p className="text-xs text-muted-foreground">Will create one broadcast row visible to every logged-in user.</p>}
          {targeting === "users" && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search users..." className="pl-8" />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {filteredProfiles.map((p) => {
                  const selected = targetUserIds.includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggleUser(p.id)}
                      className="w-full flex items-center justify-between p-2 text-sm hover:bg-accent text-left">
                      <div>
                        <p className="font-medium">{p.full_name || p.email}</p>
                        <p className="text-xs text-muted-foreground">{p.email} · {p.role}</p>
                      </div>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{targetUserIds.length} selected</p>
            </div>
          )}
          {targeting === "client" && (
            <Select value={targetClientId} onValueChange={setTargetClientId}>
              <SelectTrigger><SelectValue placeholder="Pick client" /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {targeting === "role" && (
            <Select value={targetRole} onValueChange={setTargetRole}>
              <SelectTrigger><SelectValue placeholder="Pick role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">super_admin</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="user">user</SelectItem>
                {roles.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleSend} disabled={sending || !title.trim()} size="lg">
            {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : "Send now"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</Label>
          <Badge variant="secondary">{type}</Badge>
        </div>
        <div className="sticky top-4">
          <div className="bg-muted/30 rounded-2xl p-6 flex items-center justify-center min-h-[420px]">
            <NotificationPreview type={type} title={title} body={body} cta_label={ctaLabel} image_url={imageUrl} lottie_url={lottieUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}